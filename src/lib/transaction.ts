import type { AppData, Customer, QuoteRecord, SaleRecord } from "../types";

// 거래 중심 개편(P1): app_data(견적·수금·고객)를 하나의 "거래"로 묶어 상태를 자동 계산하는 순수 레이어.
// 저장 구조는 바꾸지 않는다. 모든 함수는 부수효과가 없어 테스트로 고정한다.

export type DocStage = "draft" | "delivered" | "approved" | "issued" | "cancelled";
export type PaymentState = "unpaid" | "partial" | "paid";
export type AgeState = "none" | "scheduled" | "review" | "overdue" | "long_overdue";
export type CommState = "none" | "sent" | "resend";

export const docStageLabel: Record<DocStage, string> = {
  draft: "작성중",
  delivered: "발송완료",
  approved: "승인완료",
  issued: "발행완료",
  cancelled: "취소"
};
export const paymentStateLabel: Record<PaymentState, string> = {
  unpaid: "미수",
  partial: "부분수금",
  paid: "수금완료"
};
export const ageStateLabel: Record<AgeState, string> = {
  none: "-",
  scheduled: "예정",
  review: "확인 필요",
  overdue: "지연",
  long_overdue: "장기 미수"
};
export const commStateLabel: Record<CommState, string> = {
  none: "안내 없음",
  sent: "안내 완료",
  resend: "재안내 필요"
};

// 경과 상태 임계값(일). 추후 사업장 설정으로 뺄 수 있도록 상수로 둔다.
export const AGE_THRESHOLDS = { scheduled: 7, review: 14, overdue: 30 } as const;

export type Transaction = {
  quote: QuoteRecord;
  sale?: SaleRecord;
  customer?: Customer;
  customerName: string;
  billed: number;
  paid: number;
  outstanding: number;
  lastPaymentAt?: string;
  baseDate?: string;
  daysElapsed: number;
  docStage: DocStage;
  paymentState: PaymentState;
  ageState: AgeState;
  commState: CommState;
};

const MS_PER_DAY = 86_400_000;

const toTime = (value?: string) => {
  if (!value) return NaN;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? NaN : time;
};

export const daysBetween = (from: string | undefined, now: Date) => {
  const start = toTime(from);
  if (Number.isNaN(start)) return 0;
  return Math.floor((now.getTime() - start) / MS_PER_DAY);
};

export function computeDocStage(quote: QuoteRecord): DocStage {
  if (quote.status === "cancelled") return "cancelled";
  if (quote.invoiceStatus === "issued" || quote.invoiceStatus === "sent" || quote.cashReceiptStatus === "issued") {
    return "issued";
  }
  if (quote.status === "approved") return "approved";
  if (quote.status === "delivered" || quote.documentEmailStatus === "sent") return "delivered";
  return "draft";
}

export function computePaymentState(billed: number, paid: number): PaymentState {
  if (billed > 0 && paid >= billed) return "paid";
  if (paid > 0 && paid < billed) return "partial";
  return "unpaid";
}

export function computeAgeState(outstanding: number, daysElapsed: number): AgeState {
  if (outstanding <= 0) return "none";
  if (daysElapsed < AGE_THRESHOLDS.scheduled) return "scheduled";
  if (daysElapsed < AGE_THRESHOLDS.review) return "review";
  if (daysElapsed < AGE_THRESHOLDS.overdue) return "overdue";
  return "long_overdue";
}

export function computeCommState(quote: QuoteRecord, customer: Customer | undefined, outstanding: number, ageState: AgeState): CommState {
  if (quote.documentEmailStatus === "failed") return outstanding > 0 ? "resend" : "none";
  if (outstanding > 0 && (ageState === "overdue" || ageState === "long_overdue")) return "resend";
  if (quote.documentEmailStatus === "sent" || customer?.unpaidNoticeSentAt) return "sent";
  return "none";
}

// 견적 기준일: 발행일 > 승인일 > 견적 생성일 순으로 채택한다.
const transactionBaseDate = (quote: QuoteRecord, sale?: SaleRecord) =>
  quote.invoiceDate || quote.approvedAt || sale?.createdAt || quote.form.quoteDate || undefined;

export function buildTransaction(
  quote: QuoteRecord,
  sale: SaleRecord | undefined,
  customer: Customer | undefined,
  now: Date
): Transaction {
  const billed = sale ? sale.amount : 0;
  const paid = sale ? sale.paidAmount : 0;
  const outstanding = Math.max(0, billed - paid);
  const payments = sale?.payments ?? [];
  const lastPaymentAt = payments.length ? payments[payments.length - 1].date : undefined;
  const baseDate = transactionBaseDate(quote, sale);
  const daysElapsed = daysBetween(baseDate, now);
  const docStage = computeDocStage(quote);
  const paymentState = computePaymentState(billed, paid);
  const ageState = outstanding > 0 && docStage !== "cancelled" ? computeAgeState(outstanding, daysElapsed) : "none";
  const commState = computeCommState(quote, customer, docStage === "cancelled" ? 0 : outstanding, ageState);
  return {
    quote,
    sale,
    customer,
    customerName: customer?.name || quote.customerSnapshot?.name || "고객 미지정",
    billed,
    paid,
    outstanding,
    lastPaymentAt,
    baseDate,
    daysElapsed,
    docStage,
    paymentState,
    ageState,
    commState
  };
}

export function buildTransactions(data: Pick<AppData, "quotes" | "sales" | "customers">, now: Date = new Date()): Transaction[] {
  const saleByQuote = new Map(data.sales.map((sale) => [sale.quoteId, sale]));
  const customerById = new Map(data.customers.map((customer) => [customer.id, customer]));
  return data.quotes.map((quote) =>
    buildTransaction(quote, saleByQuote.get(quote.id), quote.customerId ? customerById.get(quote.customerId) : undefined, now)
  );
}

// 미수 거래: 취소 제외, 잔액>0, 경과일 내림차순(오래된 미수 우선).
export function receivableTransactions(transactions: Transaction[]): Transaction[] {
  return transactions
    .filter((tx) => tx.docStage !== "cancelled" && tx.outstanding > 0)
    .sort((a, b) => b.daysElapsed - a.daysElapsed);
}

export type ReceivableByCustomer = {
  customerId: string;
  customerName: string;
  outstanding: number;
  transactions: Transaction[];
  worstAge: AgeState;
  needsResend: boolean;
};

const AGE_RANK: Record<AgeState, number> = { none: 0, scheduled: 1, review: 2, overdue: 3, long_overdue: 4 };

export function receivablesByCustomer(transactions: Transaction[]): ReceivableByCustomer[] {
  const groups = new Map<string, ReceivableByCustomer>();
  for (const tx of receivableTransactions(transactions)) {
    const key = tx.customer?.id || tx.customerName;
    const existing = groups.get(key);
    if (existing) {
      existing.outstanding += tx.outstanding;
      existing.transactions.push(tx);
      if (AGE_RANK[tx.ageState] > AGE_RANK[existing.worstAge]) existing.worstAge = tx.ageState;
      existing.needsResend = existing.needsResend || tx.commState === "resend";
    } else {
      groups.set(key, {
        customerId: tx.customer?.id || "",
        customerName: tx.customerName,
        outstanding: tx.outstanding,
        transactions: [tx],
        worstAge: tx.ageState,
        needsResend: tx.commState === "resend"
      });
    }
  }
  return [...groups.values()].sort((a, b) => b.outstanding - a.outstanding);
}

export type TodoCounts = {
  reviewNeeded: number; // 경과 확인 필요(review 이상)
  resendNeeded: number; // 재안내 필요
  partial: number; // 부분수금 진행 중
  dueThisWeek: number; // 아직 예정 단계(7일 이내)인 미수
  totalOutstanding: number;
};

// 실행형 대시보드용 "지금 처리할 일" 집계.
export function todoCounts(transactions: Transaction[]): TodoCounts {
  const receivables = receivableTransactions(transactions);
  return {
    reviewNeeded: receivables.filter((tx) => tx.ageState === "review" || tx.ageState === "overdue" || tx.ageState === "long_overdue").length,
    resendNeeded: receivables.filter((tx) => tx.commState === "resend").length,
    partial: receivables.filter((tx) => tx.paymentState === "partial").length,
    dueThisWeek: receivables.filter((tx) => tx.ageState === "scheduled").length,
    totalOutstanding: receivables.reduce((sum, tx) => sum + tx.outstanding, 0)
  };
}
