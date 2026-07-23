import { afterEach, describe, expect, it } from "vitest";
import { billingProducts, requireBillingProduct } from "../../server/billing/products.js";
import { decryptBillingKey, encryptBillingKey } from "../../server/billing/encryption.js";
import { nextMonthlyChargeAt } from "../../server/billing/dates.js";
import { billingCustomerId } from "../../server/billing/customer.js";

const originalEncryptionKey = process.env.BILLING_TOKEN_ENCRYPTION_KEY;

afterEach(() => {
  if (originalEncryptionKey === undefined) delete process.env.BILLING_TOKEN_ENCRYPTION_KEY;
  else process.env.BILLING_TOKEN_ENCRYPTION_KEY = originalEncryptionKey;
});

describe("server billing products", () => {
  it("keeps the document prices on the server", () => {
    expect(billingProducts).toMatchObject({
      starter: { type: "subscription", amount: 9_900 },
      pro50: { type: "subscription", amount: 29_000 },
      pro100: { type: "subscription", amount: 49_000 },
      credits20: { type: "credits", amount: 4_300 },
      credits50: { type: "credits", amount: 9_900 },
      credits100: { type: "credits", amount: 18_900 },
      credits300: { type: "credits", amount: 54_900 }
    });
  });

  it("rejects a client-invented product", () => {
    expect(() => requireBillingProduct("credits999")).toThrow("선택한 결제 상품을 찾을 수 없습니다.");
  });
});

describe("billing key encryption", () => {
  it("round-trips a billing key with authenticated encryption", () => {
    process.env.BILLING_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptBillingKey("billing-key-secret");
    expect(encrypted).not.toContain("billing-key-secret");
    expect(decryptBillingKey(encrypted)).toBe("billing-key-secret");
  });

  it("rejects a tampered encrypted billing key", () => {
    process.env.BILLING_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64");
    const encrypted = encryptBillingKey("billing-key-secret");
    const parts = encrypted.split(".");
    parts[3] = `${parts[3].slice(0, -1)}${parts[3].endsWith("A") ? "B" : "A"}`;
    expect(() => decryptBillingKey(parts.join("."))).toThrow();
  });
});

describe("monthly billing dates", () => {
  it("uses the same day in the next month", () => {
    expect(nextMonthlyChargeAt("2026-07-15T03:30:00.000Z")).toBe("2026-08-15T03:30:00.000Z");
  });

  it("clamps month-end renewals instead of skipping a month", () => {
    expect(nextMonthlyChargeAt("2026-01-31T03:30:00.000Z")).toBe("2026-02-28T03:30:00.000Z");
    expect(nextMonthlyChargeAt("2028-01-31T03:30:00.000Z")).toBe("2028-02-29T03:30:00.000Z");
  });
});

describe("billing customer identifiers", () => {
  it("does not expose an email and stays within common PG length limits", () => {
    expect(billingCustomerId("12345678-1234-1234-1234-123456789012")).toBe("12345678123412341234");
    expect(billingCustomerId("12345678-1234-1234-1234-123456789012")).toHaveLength(20);
  });
});
