-- 블링빌 요금제/크레딧 원장. 결제 PG 확정 후 webhook만 이 원장을 변경해야 합니다.
create table if not exists public.billing_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  business_number text,
  plan_id text not null default 'free' check (plan_id in ('free', 'starter', 'pro50', 'pro100')),
  status text not null default 'active' check (status in ('active', 'past_due', 'cancelled')),
  credit_balance integer not null default 0 check (credit_balance >= 0),
  included_invoice_used integer not null default 0 check (included_invoice_used >= 0),
  allowance_started_at timestamptz not null default date_trunc('month', now()),
  allowance_ends_at timestamptz not null default date_trunc('month', now()) + interval '1 month',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists billing_accounts_business_number_once_idx
  on public.billing_accounts (business_number) where business_number is not null;

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  balance_after integer not null check (balance_after >= 0),
  reason text not null check (reason in ('signup', 'purchase', 'tax_invoice', 'quote_pdf', 'transaction_statement', 'email', 'unpaid_notice', 'refund', 'adjustment')),
  reference_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('tax_invoice', 'quote_pdf', 'transaction_statement', 'email', 'unpaid_notice')),
  reference_id text not null,
  source text not null check (source in ('credit', 'included', 'unlimited')),
  units integer not null default 0 check (units >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, feature, reference_id)
);

create table if not exists public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_type text not null check (product_type in ('subscription', 'credits')),
  product_id text not null check (product_id in ('starter', 'pro50', 'pro100', 'credits20', 'credits50', 'credits100', 'credits300')),
  amount integer not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  provider text,
  provider_order_id text unique,
  is_renewal boolean not null default false,
  scheduled_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_orders
  add column if not exists is_renewal boolean not null default false;
alter table public.billing_orders
  add column if not exists scheduled_at timestamptz;

create unique index if not exists billing_orders_one_pending_renewal_idx
  on public.billing_orders (user_id) where is_renewal and status = 'pending';

create table if not exists public.billing_payment_methods (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null,
  billing_key_encrypted text not null,
  status text not null default 'active' check (status in ('active', 'deleted', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists credit_ledger_idempotency_idx
  on public.credit_ledger (user_id, reason, reference_id) where reference_id is not null;

alter table public.billing_accounts enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.billing_usage_events enable row level security;
alter table public.billing_orders enable row level security;
alter table public.billing_payment_methods enable row level security;

drop policy if exists "read own billing account" on public.billing_accounts;
create policy "read own billing account" on public.billing_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "read own credit ledger" on public.credit_ledger;
create policy "read own credit ledger" on public.credit_ledger
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "read own billing usage" on public.billing_usage_events;
create policy "read own billing usage" on public.billing_usage_events
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "read own billing orders" on public.billing_orders;
create policy "read own billing orders" on public.billing_orders
  for select to authenticated using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.billing_accounts from authenticated;
revoke insert, update, delete on public.credit_ledger from authenticated;
revoke insert, update, delete on public.billing_usage_events from authenticated;
revoke insert, update, delete on public.billing_orders from authenticated;
revoke all on public.billing_payment_methods from anon;
revoke all on public.billing_payment_methods from authenticated;
grant select on public.billing_accounts, public.credit_ledger, public.billing_usage_events, public.billing_orders to authenticated;

drop trigger if exists billing_accounts_updated_at on public.billing_accounts;
create trigger billing_accounts_updated_at
  before update on public.billing_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists billing_orders_updated_at on public.billing_orders;
create trigger billing_orders_updated_at
  before update on public.billing_orders
  for each row execute function public.set_updated_at();

drop trigger if exists billing_payment_methods_updated_at on public.billing_payment_methods;
create trigger billing_payment_methods_updated_at
  before update on public.billing_payment_methods
  for each row execute function public.set_updated_at();

-- 가입 시 계정만 만들고, 무료 3cr은 검증된 사업자번호를 연결할 때 지급합니다.
create or replace function public.create_billing_account_for_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.billing_accounts (user_id, credit_balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_billing on auth.users;
create trigger on_auth_user_created_billing
  after insert on auth.users
  for each row execute function public.create_billing_account_for_new_user();

insert into public.billing_accounts (user_id, credit_balance)
select id, 0 from auth.users
on conflict (user_id) do nothing;

create or replace function public.grant_signup_credits(p_business_number text)
returns table (granted boolean, credit_balance integer, message text)
language plpgsql
security definer set search_path = public
as $$
declare
  normalized text := regexp_replace(coalesce(p_business_number, ''), '\D', '', 'g');
  account public.billing_accounts%rowtype;
begin
  if normalized !~ '^\d{10}$' then
    return query select false, 0, '올바른 사업자등록번호가 필요합니다.';
    return;
  end if;
  if not exists (
    select 1 from public.popbill_connections
    where user_id = auth.uid() and corp_num = normalized
  ) then
    return query select false, 0, '연결이 확인된 사업자등록번호만 가입 혜택을 받을 수 있습니다.';
    return;
  end if;
  select * into account from public.billing_accounts where user_id = auth.uid() for update;
  if not found then
    return query select false, 0, '요금 계정을 찾을 수 없습니다.';
    return;
  end if;
  if account.business_number is not null then
    return query select false, account.credit_balance, '이미 가입 혜택이 처리된 계정입니다.';
    return;
  end if;
  begin
    update public.billing_accounts
    set business_number = normalized, credit_balance = credit_balance + 3, updated_at = now()
    where user_id = auth.uid()
    returning * into account;
  exception when unique_violation then
    return query select false, account.credit_balance, '이 사업자등록번호는 이미 가입 혜택을 받았습니다.';
    return;
  end;
  insert into public.credit_ledger (user_id, delta, balance_after, reason, reference_id)
  values (auth.uid(), 3, account.credit_balance, 'signup', 'business:' || normalized);
  return query select true, account.credit_balance, '가입 혜택 3크레딧을 지급했습니다.';
end;
$$;

revoke all on function public.grant_signup_credits(text) from public;
grant execute on function public.grant_signup_credits(text) to authenticated;

-- 발행/발송 직전에 호출하는 원자적 사용 승인 함수입니다.
-- 동일 reference_id 재호출은 추가 차감 없이 최초 결과를 반환합니다.
-- 발행/발송 승인은 서버(service role)만 검증된 p_user_id로 호출합니다.
-- 사용자에게 직접 실행 권한을 주지 않아, 브라우저에서 임의 차감·복구를 할 수 없습니다.
create or replace function public.consume_billing_action(p_user_id uuid, p_feature text, p_reference_id text)
returns table (allowed boolean, source text, credit_balance integer, included_invoice_used integer, message text)
language plpgsql
security definer set search_path = public
as $$
declare
  account public.billing_accounts%rowtype;
  existing public.billing_usage_events%rowtype;
  cost integer;
  included_limit integer;
  chosen_source text;
  effective_plan text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role only';
  end if;
  if p_user_id is null then
    raise exception 'p_user_id가 필요합니다.';
  end if;
  if p_feature not in ('tax_invoice', 'quote_pdf', 'transaction_statement', 'email', 'unpaid_notice') then
    raise exception '지원하지 않는 과금 기능입니다.';
  end if;
  if coalesce(p_reference_id, '') = '' then
    raise exception 'reference_id가 필요합니다.';
  end if;

  select * into existing from public.billing_usage_events
  where user_id = p_user_id and feature = p_feature and reference_id = p_reference_id;
  if found then
    select * into account from public.billing_accounts where user_id = p_user_id;
    return query select true, existing.source, account.credit_balance, account.included_invoice_used, '이미 승인된 요청입니다.';
    return;
  end if;

  select * into account from public.billing_accounts where user_id = p_user_id for update;
  if not found then
    return query select false, 'credit'::text, 0, 0, '요금 계정을 찾을 수 없습니다.';
    return;
  end if;

  -- 미납·해지 계정은 저장된 plan_id와 무관하게 무료 권한만 사용합니다.
  effective_plan := case when account.status = 'active' then account.plan_id else 'free' end;

  -- 계정 잠금을 기다린 동시 요청이 먼저 처리됐는지 다시 확인합니다.
  select * into existing from public.billing_usage_events
  where user_id = p_user_id and feature = p_feature and reference_id = p_reference_id;
  if found then
    return query select true, existing.source, account.credit_balance, account.included_invoice_used, '이미 승인된 요청입니다.';
    return;
  end if;

  if effective_plan <> 'free' and p_feature <> 'tax_invoice' then
    chosen_source := 'unlimited';
    cost := 0;
  elsif p_feature = 'tax_invoice' and effective_plan <> 'free' then
    included_limit := case effective_plan when 'starter' then 10 when 'pro50' then 50 when 'pro100' then 100 else 0 end;
    if account.included_invoice_used < included_limit then
      chosen_source := 'included';
      cost := 0;
      update public.billing_accounts set included_invoice_used = included_invoice_used + 1, updated_at = now()
      where user_id = p_user_id;
      account.included_invoice_used := account.included_invoice_used + 1;
    else
      chosen_source := 'credit';
      cost := 2;
    end if;
  else
    chosen_source := 'credit';
    cost := case when p_feature = 'tax_invoice' then 2 else 1 end;
  end if;

  if cost > account.credit_balance then
    return query select false, chosen_source, account.credit_balance, account.included_invoice_used, '크레딧이 부족합니다. 자동 결제 없이 사용이 중단되었습니다.';
    return;
  end if;

  if cost > 0 then
    update public.billing_accounts set credit_balance = credit_balance - cost, updated_at = now()
    where user_id = p_user_id;
    account.credit_balance := account.credit_balance - cost;
    insert into public.credit_ledger (user_id, delta, balance_after, reason, reference_id)
    values (p_user_id, -cost, account.credit_balance, p_feature, p_reference_id);
  end if;

  insert into public.billing_usage_events (user_id, feature, reference_id, source, units)
  values (p_user_id, p_feature, p_reference_id, chosen_source, cost);
  return query select true, chosen_source, account.credit_balance, account.included_invoice_used, '사용이 승인되었습니다.';
end;
$$;

revoke all on function public.consume_billing_action(uuid, text, text) from public;
grant execute on function public.consume_billing_action(uuid, text, text) to service_role;

-- 외부 발행/발송이 실패했을 때 같은 reference_id의 승인 건을 복구합니다.
-- 서버(service role)만 호출합니다. 사용자가 직접 호출해 정상 발행 건의 크레딧을
-- 되돌려받는 악용을 막기 위해 authenticated 권한을 부여하지 않습니다.
create or replace function public.reverse_billing_action(p_user_id uuid, p_feature text, p_reference_id text)
returns table (reversed boolean, credit_balance integer, included_invoice_used integer, message text)
language plpgsql
security definer set search_path = public
as $$
declare
  account public.billing_accounts%rowtype;
  usage public.billing_usage_events%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role only';
  end if;
  if p_user_id is null then
    raise exception 'p_user_id가 필요합니다.';
  end if;
  select * into account from public.billing_accounts where user_id = p_user_id for update;
  if not found then
    return query select false, 0, 0, '요금 계정을 찾을 수 없습니다.';
    return;
  end if;
  select * into usage from public.billing_usage_events
  where user_id = p_user_id and feature = p_feature and reference_id = p_reference_id
  for update;
  if not found then
    return query select false, account.credit_balance, account.included_invoice_used, '복구할 승인 기록이 없습니다.';
    return;
  end if;

  if usage.source = 'credit' and usage.units > 0 then
    update public.billing_accounts
    set credit_balance = credit_balance + usage.units, updated_at = now()
    where user_id = p_user_id
    returning * into account;
    insert into public.credit_ledger (user_id, delta, balance_after, reason, reference_id)
    values (p_user_id, usage.units, account.credit_balance, 'refund', 'reverse:' || p_feature || ':' || p_reference_id);
  elsif usage.source = 'included' then
    update public.billing_accounts
    set included_invoice_used = greatest(0, included_invoice_used - 1), updated_at = now()
    where user_id = p_user_id
    returning * into account;
  end if;

  delete from public.billing_usage_events where id = usage.id;
  return query select true, account.credit_balance, account.included_invoice_used, '사용 승인을 복구했습니다.';
end;
$$;

revoke all on function public.reverse_billing_action(uuid, text, text) from public;
grant execute on function public.reverse_billing_action(uuid, text, text) to service_role;

-- 과거에 사용자에게 노출됐을 수 있는 2-인자 버전을 제거합니다(브라우저 직접 호출 차단).
drop function if exists public.consume_billing_action(text, text);
drop function if exists public.reverse_billing_action(text, text);

-- PortOne에서 결제 금액과 PAID 상태를 검증한 뒤 service role만 호출합니다.
create or replace function public.apply_paid_billing_order(p_order_id uuid, p_provider_order_id text)
returns table (applied boolean, product_id text, credit_balance integer, plan_id text)
language plpgsql
security definer set search_path = public
as $$
declare
  target public.billing_orders%rowtype;
  account public.billing_accounts%rowtype;
  credit_amount integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role only';
  end if;
  select * into target from public.billing_orders where id = p_order_id for update;
  if not found then raise exception '주문을 찾을 수 없습니다.'; end if;
  select * into account from public.billing_accounts where user_id = target.user_id for update;
  if not found then raise exception '요금 계정을 찾을 수 없습니다.'; end if;
  if target.status = 'paid' then
    return query select false, target.product_id, account.credit_balance, account.plan_id;
    return;
  end if;
  if target.status <> 'pending' then raise exception '결제 가능한 주문 상태가 아닙니다.'; end if;

  update public.billing_orders
  set status = 'paid', provider = 'portone', provider_order_id = p_provider_order_id, paid_at = now(), updated_at = now()
  where id = target.id;

  if target.product_type = 'credits' then
    credit_amount := case target.product_id
      when 'credits20' then 20 when 'credits50' then 50
      when 'credits100' then 100 when 'credits300' then 300 else 0 end;
    if credit_amount = 0 then raise exception '알 수 없는 크레딧 상품입니다.'; end if;
    update public.billing_accounts
    set credit_balance = credit_balance + credit_amount, updated_at = now()
    where user_id = target.user_id returning * into account;
    insert into public.credit_ledger (user_id, delta, balance_after, reason, reference_id)
    values (target.user_id, credit_amount, account.credit_balance, 'purchase', 'order:' || target.id::text);
  else
    update public.billing_accounts
    set plan_id = target.product_id,
        status = 'active',
        included_invoice_used = 0,
        allowance_started_at = now(),
        allowance_ends_at = now() + interval '1 month',
        updated_at = now()
    where user_id = target.user_id returning * into account;
  end if;
  return query select true, target.product_id, account.credit_balance, account.plan_id;
end;
$$;

revoke all on function public.apply_paid_billing_order(uuid, text) from public;
grant execute on function public.apply_paid_billing_order(uuid, text) to service_role;
