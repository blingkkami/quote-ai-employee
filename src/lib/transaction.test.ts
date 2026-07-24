import { describe, expect, it } from "vitest";
import type { Customer, QuoteRecord, SaleRecord } from "../types";
import {
  buildTransaction,
  buildTransactions,
  computeAgeState,
  computeCommState,
  computeDocStage,
  computePaymentState,
  daysBetween,
  receivablesByCustomer,
  receivableTransactions,
  todoCounts
} from "./transaction";

const NOW = new Date("2026-07-24T00:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString().slice(0, 10);

const quote = (over: Partial<QuoteRecord> = {}): QuoteRecord => ({
  id: over.id ?? "q1",
  status: over.status ?? "approved",
  paymentStatus: over.paymentStatus ?? "unpaid",
  form: {
    quoteDate: "2026-07-01", validDuration: "", issuerName: "", projectName: "테스트", deliveryFormat: "",
    deliverySchedule: "", finalCategory: "", finalDescription: "", notes: "", message: "", signOffSender: "", signOffDate: "",
    ...(over.form ?? {})
  },
  items: over.items ?? [{ id: "i1", category: "디자인", description: "작업", price: 100000 }],
  customerId: over.customerId ?? "c1",
  customerSnapshot: over.customerSnapshot,
  approvedAt: over.approvedAt,
  invoiceDate: over.invoiceDate,
  invoiceIssuanceMode: over.invoiceIssuanceMode ?? "manual",
  invoiceType: over.invoiceType ?? { issueInvoice: true, issueCashReceipt: false },
  invoiceStatus: over.invoiceStatus,
  cashReceiptStatus: over.cashReceiptStatus,
  documentEmailStatus: over.documentEmailStatus,
  createdAt: over.createdAt ?? "2026-07-01T00:00:00.000Z",
  updatedAt: over.updatedAt ?? "2026-07-01T00:00:00.000Z"
});

const sale = (over: Partial<SaleRecord> = {}): SaleRecord => ({
  id: over.id ?? "s1",
  quoteId: over.quoteId ?? "q1",
  customerId: over.customerId ?? "c1",
  amount: over.amount ?? 110000,
  paidAmount: over.paidAmount ?? 0,
  paymentStatus: over.paymentStatus ?? "unpaid",
  payments: over.payments ?? [],
  createdAt: over.createdAt ?? "2026-07-01T00:00:00.000Z",
  updatedAt: over.updatedAt ?? "2026-07-01T00:00:00.000Z"
});

const customer = (over: Partial<Customer> = {}): Customer => ({
  id: over.id ?? "c1",
  name: over.name ?? "라이트 코스메틱",
  contactPerson: "", contact: "",
  paymentCycle: "per_transaction",
  invoicePreference: "tax_invoice_manual",
  firstQuoteAt: "", lastQuoteAt: "", totalSales: 0, unpaidAmount: 0,
  unpaidNoticeSentAt: over.unpaidNoticeSentAt,
  createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z",
  ...over
});

describe("daysBetween", () => {
  it("counts whole days and handles missing/invalid dates", () => {
    expect(daysBetween(daysAgo(10), NOW)).toBe(10);
    expect(daysBetween(undefined, NOW)).toBe(0);
    expect(daysBetween("not-a-date", NOW)).toBe(0);
  });
});

describe("computeDocStage", () => {
  it("prioritizes issued over approved over delivered", () => {
    expect(computeDocStage(quote({ status: "draft" }))).toBe("draft");
    expect(computeDocStage(quote({ status: "delivered" }))).toBe("delivered");
    expect(computeDocStage(quote({ status: "approved", documentEmailStatus: "sent" }))).toBe("approved");
    expect(computeDocStage(quote({ status: "approved", invoiceStatus: "issued" }))).toBe("issued");
    expect(computeDocStage(quote({ status: "approved", cashReceiptStatus: "issued" }))).toBe("issued");
    expect(computeDocStage(quote({ status: "cancelled", invoiceStatus: "issued" }))).toBe("cancelled");
  });
});

describe("computePaymentState", () => {
  it("classifies unpaid / partial / paid", () => {
    expect(computePaymentState(110000, 0)).toBe("unpaid");
    expect(computePaymentState(110000, 50000)).toBe("partial");
    expect(computePaymentState(110000, 110000)).toBe("paid");
    expect(computePaymentState(0, 0)).toBe("unpaid");
  });
});

describe("computeAgeState", () => {
  it("labels by elapsed days, only when outstanding", () => {
    expect(computeAgeState(0, 40)).toBe("none");
    expect(computeAgeState(1000, 3)).toBe("scheduled");
    expect(computeAgeState(1000, 10)).toBe("review");
    expect(computeAgeState(1000, 20)).toBe("overdue");
    expect(computeAgeState(1000, 45)).toBe("long_overdue");
  });
});

describe("computeCommState", () => {
  it("flags resend on failure or long-outstanding, sent when notified", () => {
    expect(computeCommState(quote({ documentEmailStatus: "failed" }), undefined, 1000, "overdue")).toBe("resend");
    expect(computeCommState(quote(), undefined, 1000, "long_overdue")).toBe("resend");
    expect(computeCommState(quote({ documentEmailStatus: "sent" }), undefined, 1000, "scheduled")).toBe("sent");
    expect(computeCommState(quote(), customer({ unpaidNoticeSentAt: "2026-07-10" }), 1000, "review")).toBe("sent");
    expect(computeCommState(quote(), undefined, 1000, "scheduled")).toBe("none");
  });
});

describe("buildTransaction", () => {
  it("joins quote+sale+customer and derives every status", () => {
    const tx = buildTransaction(
      quote({ invoiceDate: daysAgo(20), invoiceStatus: "issued" }),
      sale({ amount: 110000, paidAmount: 40000, payments: [{ date: daysAgo(5), amount: 40000 }] }),
      customer(),
      NOW
    );
    expect(tx.billed).toBe(110000);
    expect(tx.paid).toBe(40000);
    expect(tx.outstanding).toBe(70000);
    expect(tx.lastPaymentAt).toBe(daysAgo(5));
    expect(tx.daysElapsed).toBe(20);
    expect(tx.docStage).toBe("issued");
    expect(tx.paymentState).toBe("partial");
    expect(tx.ageState).toBe("overdue");
    expect(tx.customerName).toBe("라이트 코스메틱");
  });

  it("treats a draft quote without a sale as not billed", () => {
    const tx = buildTransaction(quote({ status: "draft" }), undefined, customer(), NOW);
    expect(tx.billed).toBe(0);
    expect(tx.outstanding).toBe(0);
    expect(tx.ageState).toBe("none");
    expect(tx.paymentState).toBe("unpaid");
  });

  it("never ages or flags a cancelled transaction", () => {
    const tx = buildTransaction(
      quote({ status: "cancelled", invoiceDate: daysAgo(90) }),
      sale({ amount: 110000, paidAmount: 0 }),
      customer(),
      NOW
    );
    expect(tx.docStage).toBe("cancelled");
    expect(tx.ageState).toBe("none");
    expect(tx.commState).toBe("none");
  });
});

describe("aggregates", () => {
  const data = {
    quotes: [
      quote({ id: "q1", customerId: "c1", invoiceDate: daysAgo(40), invoiceStatus: "issued", documentEmailStatus: "sent" }),
      quote({ id: "q2", customerId: "c1", invoiceDate: daysAgo(3), invoiceStatus: "issued" }),
      quote({ id: "q3", customerId: "c2", invoiceDate: daysAgo(20), invoiceStatus: "issued" }),
      quote({ id: "q4", customerId: "c2", status: "cancelled" }),
      quote({ id: "q5", customerId: "c1", status: "draft" })
    ],
    sales: [
      sale({ id: "s1", quoteId: "q1", customerId: "c1", amount: 100000, paidAmount: 0 }),
      sale({ id: "s2", quoteId: "q2", customerId: "c1", amount: 100000, paidAmount: 60000, payments: [{ date: daysAgo(1), amount: 60000 }] }),
      sale({ id: "s3", quoteId: "q3", customerId: "c2", amount: 100000, paidAmount: 100000 }),
      sale({ id: "s4", quoteId: "q4", customerId: "c2", amount: 100000, paidAmount: 0 })
    ],
    customers: [customer({ id: "c1", name: "라이트" }), customer({ id: "c2", name: "모노" })]
  };
  const txs = buildTransactions(data, NOW);

  it("selects only outstanding, non-cancelled receivables, oldest first", () => {
    const rec = receivableTransactions(txs);
    expect(rec.map((tx) => tx.quote.id)).toEqual(["q1", "q2"]); // q3 paid, q4 cancelled, q5 not billed
    expect(rec[0].daysElapsed).toBeGreaterThan(rec[1].daysElapsed);
  });

  it("groups receivables by customer and marks worst age / resend", () => {
    const byCustomer = receivablesByCustomer(txs);
    expect(byCustomer).toHaveLength(1);
    expect(byCustomer[0].customerName).toBe("라이트");
    expect(byCustomer[0].outstanding).toBe(140000); // 100000 + 40000
    expect(byCustomer[0].worstAge).toBe("long_overdue");
    expect(byCustomer[0].needsResend).toBe(true);
  });

  it("summarizes the execution to-do counts", () => {
    const todo = todoCounts(txs);
    expect(todo.reviewNeeded).toBe(1); // q1 long_overdue
    expect(todo.resendNeeded).toBe(1); // q1
    expect(todo.partial).toBe(1); // q2
    expect(todo.dueThisWeek).toBe(1); // q2 (3 days)
    expect(todo.totalOutstanding).toBe(140000);
  });
});
