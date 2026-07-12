import { describe, expect, it } from "vitest";
import type { Customer, QuoteRecord, SaleRecord } from "../types";
import { syncCustomerTotals } from "./finance";

const customer: Customer = {
  id: "customer-1",
  name: "테스트 고객",
  contactPerson: "",
  contact: "",
  paymentCycle: "per_transaction",
  invoicePreference: "tax_invoice_manual",
  firstQuoteAt: "",
  lastQuoteAt: "",
  totalSales: 999,
  unpaidAmount: 999,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const quote = (id: string, date: string): QuoteRecord => ({
  id,
  customerId: customer.id,
  status: "approved",
  paymentStatus: "partial",
  form: { quoteDate: date, validDuration: "", issuerName: "", projectName: id, deliveryFormat: "", deliverySchedule: "", finalCategory: "", finalDescription: "", notes: "", message: "", signOffSender: "", signOffDate: "" },
  items: [{ id: `${id}-item`, category: "", description: "", price: 100 }],
  invoiceIssuanceMode: "manual",
  invoiceType: { issueInvoice: true, issueCashReceipt: false },
  createdAt: `${date}T00:00:00.000Z`,
  updatedAt: `${date}T00:00:00.000Z`
});

const sale = (id: string, amount: number, paidAmount: number): SaleRecord => ({
  id,
  quoteId: id,
  customerId: customer.id,
  amount,
  paidAmount,
  paymentStatus: paidAmount >= amount ? "paid" : paidAmount > 0 ? "partial" : "unpaid",
  payments: [],
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z"
});

describe("syncCustomerTotals", () => {
  it("실제 매출과 수금 기록에서 누적매출과 미수금을 다시 계산한다", () => {
    const [result] = syncCustomerTotals([customer], [sale("q1", 110000, 30000), sale("q2", 220000, 220000)], [quote("q1", "2026-07-10"), quote("q2", "2026-07-20")]);
    expect(result.totalSales).toBe(330000);
    expect(result.unpaidAmount).toBe(80000);
  });

  it("견적일을 기준으로 최초·최근 견적일을 계산한다", () => {
    const [result] = syncCustomerTotals([customer], [], [quote("q2", "2026-07-20"), quote("q1", "2026-06-01")]);
    expect(result.firstQuoteAt).toBe("2026-06-01");
    expect(result.lastQuoteAt).toBe("2026-07-20");
  });
});
