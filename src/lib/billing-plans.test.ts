import { describe, expect, it } from "vitest";
import { BILLING_ENABLED, billingPlans, canOpenView, creditCosts, creditPackages, planAllowsView, planFeatureAccess } from "./billing-plans";

describe("billing plans", () => {
  it("keeps Pro tiers feature-identical except for price and included invoices", () => {
    const pro50 = billingPlans.find((plan) => plan.id === "pro50")!;
    const pro100 = billingPlans.find((plan) => plan.id === "pro100")!;
    expect({ ledger: pro50.ledger, operationsDashboard: pro50.operationsDashboard }).toEqual({
      ledger: pro100.ledger,
      operationsDashboard: pro100.operationsDashboard
    });
  });

  it("uses the approved credit prices and tax invoice cost", () => {
    expect(creditPackages.map(({ credits, price }) => [credits, price])).toEqual([
      [20, 4_300],
      [50, 9_900],
      [100, 18_900],
      [300, 54_900]
    ]);
    expect(creditCosts.taxInvoice).toBe(2);
  });

  it("blocks management screens by plan while keeping credit-paid issuing available", () => {
    // 과금이 켜졌을 때의 등급 규칙(planAllowsView)을 검증한다.
    expect(planAllowsView("free", "issue")).toBe(true);
    expect(planAllowsView("free", "ledger")).toBe(false);
    expect(planAllowsView("starter", "ledger")).toBe(true);
    expect(planAllowsView("starter", "dashboard")).toBe(false);
    expect(planAllowsView("pro50", "dashboard")).toBe(true);
    expect(planFeatureAccess.free.taxInvoice).toBe("credit");
    expect(planFeatureAccess.starter.operationsDashboard).toBe("blocked");
  });

  it("opens every screen while billing is in safe mode (BILLING_ENABLED=false)", () => {
    expect(BILLING_ENABLED).toBe(false);
    expect(canOpenView("free", "ledger")).toBe(true);
    expect(canOpenView("free", "dashboard")).toBe(true);
  });

  it("matches every access row in the source document", () => {
    expect(planFeatureAccess.free).toEqual({
      customerManagement: "free",
      quoteDrafting: "free",
      businessSettings: "free",
      businessStatusCheck: "free",
      taxInvoice: "credit",
      quotePdf: "credit",
      transactionStatement: "credit",
      email: "credit",
      unpaidNotice: "credit",
      ledger: "blocked",
      receivablesAndPurchases: "blocked",
      operationsDashboard: "blocked"
    });
    expect(planFeatureAccess.starter.ledger).toBe("included");
    expect(planFeatureAccess.starter.receivablesAndPurchases).toBe("included");
    expect(planFeatureAccess.starter.operationsDashboard).toBe("blocked");
    expect(planFeatureAccess.pro50).toEqual(planFeatureAccess.pro100);
  });
});
