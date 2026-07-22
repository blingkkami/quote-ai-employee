-- 블링빌 사용자별 데이터 저장 스키마 (v1)
-- Supabase SQL Editor에 전체 붙여넣고 Run 하면 됩니다.

-- 사용자별 앱 데이터 (사용자 1명당 1행, JSON 통째 저장)
create table if not exists public.app_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 행 단위 보안(RLS): 각 사용자는 자기 행만 읽고 쓸 수 있음
alter table public.app_data enable row level security;

drop policy if exists "select own data" on public.app_data;
create policy "select own data" on public.app_data
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "insert own data" on public.app_data;
create policy "insert own data" on public.app_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "update own data" on public.app_data;
create policy "update own data" on public.app_data
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "delete own data" on public.app_data;
create policy "delete own data" on public.app_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 익명 사용자는 테이블에 접근하지 못하고, 로그인 사용자만 RLS 범위 안에서 접근
revoke all on table public.app_data from anon;
grant select, insert, update, delete on table public.app_data to authenticated;

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_data_updated_at on public.app_data;
create trigger app_data_updated_at
  before update on public.app_data
  for each row execute function public.set_updated_at();

-- 사용자별 팝빌 연결정보. 비밀번호와 SecretKey는 이 테이블에 저장하지 않습니다.
create table if not exists public.popbill_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  corp_num text not null unique check (corp_num ~ '^\d{10}$'),
  popbill_user_id text,
  corp_name text not null,
  ceo_name text not null,
  address text not null,
  biz_type text not null,
  biz_class text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.popbill_connections enable row level security;
drop policy if exists "select own popbill connection" on public.popbill_connections;
create policy "select own popbill connection" on public.popbill_connections
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.popbill_connections from anon;
revoke insert, update, delete on table public.popbill_connections from authenticated;
grant select on table public.popbill_connections to authenticated;

-- 사용자별 발신메일 연결정보. OAuth 토큰과 SMTP 비밀번호는 서버에서 암호화한 뒤 저장합니다.
create table if not exists public.email_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft', 'naver', 'smtp')),
  email text not null,
  display_name text not null default '',
  credentials_encrypted text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_connections enable row level security;
revoke all on table public.email_connections from anon;
revoke all on table public.email_connections from authenticated;

-- OAuth state는 10분 동안 한 번만 사용하며 서비스 역할만 접근합니다.
create table if not exists public.email_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists email_oauth_states_expires_at_idx on public.email_oauth_states (expires_at);
alter table public.email_oauth_states enable row level security;
revoke all on table public.email_oauth_states from anon;
revoke all on table public.email_oauth_states from authenticated;

-- 고객센터 문의. 사용자는 자신의 문의만 등록하고 확인할 수 있습니다.
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_email text not null check (char_length(contact_email) between 3 and 320),
  category text not null check (category in ('bug', 'suggestion', 'billing', 'popbill', 'account', 'other')),
  subject text not null check (char_length(subject) between 2 and 80),
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'answered', 'closed')),
  page_path text not null default '',
  context jsonb not null default '{}'::jsonb,
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_user_created_idx
  on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_status_created_idx
  on public.support_tickets (status, created_at desc);

alter table public.support_tickets enable row level security;

drop policy if exists "insert own support ticket" on public.support_tickets;
create policy "insert own support ticket" on public.support_tickets
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "select own support tickets" on public.support_tickets;
create policy "select own support tickets" on public.support_tickets
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.support_tickets from anon;
revoke update, delete on table public.support_tickets from authenticated;
grant select, insert on table public.support_tickets to authenticated;

drop trigger if exists support_tickets_updated_at on public.support_tickets;
create trigger support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();
