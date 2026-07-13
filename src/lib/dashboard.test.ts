import { describe, expect, it } from "vitest";
import type { AppData, QuoteRecord } from "../types";
import { dashboardPeriodData } from "./dashboard";

const data: AppData = {
  quotes: [],
  customers: [],
  vendors: [],
  taxApiIntegration: { provider: "popbill", businessNumber: "", contactEmail: "", isConnected: false },
  sales: [
    {
      id: "sale-june",
      quoteId: "quote-june",
      customerId: "customer-1",
      amount: 500000,
      paidAmount: 200000,
      paymentStatus: "partial",
      payments: [{ date: "2026-07-03", amount: 200000 }],
      createdAt: "2026-06-28T12:00:00.000Z",
      updatedAt: "2026-07-03T12:00:00.000Z"
    },
    {
      id: "sale-july",
      quoteId: "quote-july",
      customerId: "customer-2",
      amount: 300000,
      paidAmount: 0,
      paymentStatus: "unpaid",
      payments: [],
      createdAt: "2026-07-10T12:00:00.000Z",
      updatedAt: "2026-07-10T12:00:00.000Z"
    }
  ],
  purchases: [
    {
      id: "purchase-july",
      vendorId: "vendor-1",
      purchaseDate: "2026-07-11",
      items: [{ category: "인쇄", description: "샘플", price: 100000 }],
      totalAmount: 100000,
      paymentStatus: "partial",
      payments: [
        { date: "2026-07-12", amount: 40000 },
        { date: "2026-08-01", amount: 60000 }
      ],
      createdAt: "2026-07-11T12:00:00.000Z",
      updatedAt: "2026-08-01T12:00:00.000Z"
    }
  ]
};

describe("dashboardPeriodData", () => {
  it("uses approval, payment and payout dates independently", () => {
    const july = dashboardPeriodData(data, "month", "2026-07");
    expect(july.totals.sales).toBe(300000);
    expect(july.totals.paid).toBe(200000);
    expect(july.totals.unpaid).toBe(300000);
    expect(july.totals.expense).toBe(40000);
    expect(july.totals.purchaseCost).toBe(100000);
    expect(july.totals.margin).toBe(200000);
  });

  it("uses the quote approval date instead of a later sale record creation date", () => {
    const quote: QuoteRecord = {
      id: "quote-july",
      status: "approved",
      paymentStatus: "unpaid",
      form: { quoteDate: "", validDuration: "", issuerName: "", projectName: "승인일 테스트", deliveryFormat: "", deliverySchedule: "", finalCategory: "", finalDescription: "", notes: "", message: "", signOffSender: "", signOffDate: "" },
      items: [],
      approvedAt: "2026-06-30",
      invoiceIssuanceMode: "manual",
      invoiceType: { issueInvoice: true, issueCashReceipt: false },
      createdAt: "2026-07-10T12:00:00.000Z",
      updatedAt: "2026-07-10T12:00:00.000Z"
    };
    const withApprovalDate = { ...data, quotes: [quote] };

    expect(dashboardPeriodData(withApprovalDate, "month", "2026-06").totals.sales).toBe(800000);
    expect(dashboardPeriodData(withApprovalDate, "month", "2026-07").totals.sales).toBe(0);
  });
});
