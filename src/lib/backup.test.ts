import { describe, expect, it } from "vitest";
import type { AppData } from "../types";
import { parseBackup } from "./backup";

const sample: AppData = {
  quotes: [],
  customers: [
    {
      id: "customer-1",
      name: "테스트 고객",
      contactPerson: "",
      contact: "",
      paymentCycle: "per_transaction",
      invoicePreference: "tax_invoice_manual",
      firstQuoteAt: "",
      lastQuoteAt: "",
      totalSales: 0,
      unpaidAmount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  ],
  vendors: [],
  sales: [],
  purchases: [],
  documentEmailSettings: { autoSendOnApproval: true },
  workspaceProfile: { businessName: "", paymentAccount: { bankName: "", accountNumber: "", accountHolder: "", showOnDocuments: false, showOnUnpaidNotices: true } },
  taxApiIntegration: {
    provider: "popbill",
    businessNumber: "",
    contactEmail: "",
    isConnected: false,
    memo: ""
  }
};

describe("parseBackup", () => {
  it("round-trips an envelope-shaped backup with arrays intact", () => {
    const text = JSON.stringify({ app: "blingbill", version: 1, exportedAt: new Date().toISOString(), data: sample });
    const result = parseBackup(text);
    expect(Array.isArray(result.quotes)).toBe(true);
    expect(Array.isArray(result.customers)).toBe(true);
    expect(Array.isArray(result.vendors)).toBe(true);
    expect(Array.isArray(result.sales)).toBe(true);
    expect(Array.isArray(result.purchases)).toBe(true);
    expect(result.customers).toHaveLength(1);
    expect(result.customers[0].name).toBe("테스트 고객");
  });

  it("accepts a bare AppData object (no envelope)", () => {
    const result = parseBackup(JSON.stringify(sample));
    expect(result.customers).toHaveLength(1);
    expect(Array.isArray(result.purchases)).toBe(true);
  });

  it("throws when required arrays are missing", () => {
    expect(() => parseBackup("{}")).toThrow("백업 파일 형식이 올바르지 않습니다.");
  });
});
