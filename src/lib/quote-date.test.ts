import { describe, expect, it } from "vitest";
import type { QuoteRecord } from "../types";
import { quoteRecordDate } from "./quote-date";

const quote = (patch: Partial<QuoteRecord> = {}): QuoteRecord => ({
  id: "quote-1",
  status: "draft",
  paymentStatus: "unpaid",
  form: {
    quoteDate: "",
    validDuration: "",
    issuerName: "",
    projectName: "",
    deliveryFormat: "",
    deliverySchedule: "",
    finalCategory: "",
    finalDescription: "",
    notes: "",
    message: "",
    signOffSender: "",
    signOffDate: ""
  },
  items: [],
  invoiceIssuanceMode: "auto",
  invoiceType: { issueInvoice: true, issueCashReceipt: false },
  createdAt: "2026-07-10T03:00:00.000Z",
  updatedAt: "2026-07-10T03:00:00.000Z",
  ...patch
});

describe("quoteRecordDate", () => {
  it("uses the written quote date first", () => {
    expect(quoteRecordDate(quote({
      form: { ...quote().form, quoteDate: "2026-07-14" },
      approvedAt: "2026-07-12T01:00:00.000Z"
    }))).toBe("2026-07-14");
  });

  it("falls back to approval and creation dates when the quote date is blank", () => {
    expect(quoteRecordDate(quote({ approvedAt: "2026-07-12T01:00:00.000Z" }))).toBe("2026-07-12");
    expect(quoteRecordDate(quote())).toBe("2026-07-10");
  });
});
