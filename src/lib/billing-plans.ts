// 요금제·크레딧 과금을 실제로 켤지 여부. PortOne 계약·환불정책·DB 적용이 끝나기 전에는 false로 두어
// 모든 기능을 무료로 열어 두고(잠금 없음), 결제 화면은 "준비 중"으로만 노출한다.
export const BILLING_ENABLED = false;

export type PlanId = "free" | "starter" | "pro50" | "pro100";
export type CreditPackageId = "credits20" | "credits50" | "credits100" | "credits300";

export type BillingPlan = {
  id: PlanId;
  name: string;
  monthlyPrice: number;
  includedTaxInvoices: number;
  ledger: boolean;
  operationsDashboard: boolean;
};

export type BillableFeature =
  | "customerManagement"
  | "quoteDrafting"
  | "businessSettings"
  | "businessStatusCheck"
  | "taxInvoice"
  | "quotePdf"
  | "transactionStatement"
  | "email"
  | "unpaidNotice"
  | "ledger"
  | "receivablesAndPurchases"
  | "operationsDashboard";

export const planFeatureAccess: Record<PlanId, Record<BillableFeature, "free" | "credit" | "included" | "unlimited" | "blocked">> = {
  free: {
    customerManagement: "free", quoteDrafting: "free", businessSettings: "free", businessStatusCheck: "free",
    taxInvoice: "credit", quotePdf: "credit", transactionStatement: "credit", email: "credit", unpaidNotice: "credit",
    ledger: "blocked", receivablesAndPurchases: "blocked", operationsDashboard: "blocked"
  },
  starter: {
    customerManagement: "included", quoteDrafting: "included", businessSettings: "included", businessStatusCheck: "included",
    taxInvoice: "included", quotePdf: "unlimited", transactionStatement: "unlimited", email: "unlimited", unpaidNotice: "unlimited",
    ledger: "included", receivablesAndPurchases: "included", operationsDashboard: "blocked"
  },
  pro50: {
    customerManagement: "included", quoteDrafting: "included", businessSettings: "included", businessStatusCheck: "included",
    taxInvoice: "included", quotePdf: "unlimited", transactionStatement: "unlimited", email: "unlimited", unpaidNotice: "unlimited",
    ledger: "included", receivablesAndPurchases: "included", operationsDashboard: "included"
  },
  pro100: {
    customerManagement: "included", quoteDrafting: "included", businessSettings: "included", businessStatusCheck: "included",
    taxInvoice: "included", quotePdf: "unlimited", transactionStatement: "unlimited", email: "unlimited", unpaidNotice: "unlimited",
    ledger: "included", receivablesAndPurchases: "included", operationsDashboard: "included"
  }
};

export const viewMinimumPlan = {
  quote: "free", quotes: "free", issue: "free", customers: "free", billing: "free", settings: "free",
  vendors: "starter", ledger: "starter", items: "starter", dashboard: "pro50"
} as const;

// 요금제 등급에 따른 메뉴 접근 규칙(과금이 켜졌을 때의 정책). 순수 함수로 두어 테스트한다.
export const planAllowsView = (planId: PlanId, view: keyof typeof viewMinimumPlan) => {
  const rank: Record<PlanId, number> = { free: 0, starter: 1, pro50: 2, pro100: 2 };
  return rank[planId] >= rank[viewMinimumPlan[view]];
};

export const canOpenView = (planId: PlanId, view: keyof typeof viewMinimumPlan) => {
  if (!BILLING_ENABLED) return true; // 안전 모드: 모든 메뉴 열림
  return planAllowsView(planId, view);
};

export const billingPlans: BillingPlan[] = [
  { id: "free", name: "무료 + 크레딧", monthlyPrice: 0, includedTaxInvoices: 0, ledger: false, operationsDashboard: false },
  { id: "starter", name: "입문", monthlyPrice: 9_900, includedTaxInvoices: 10, ledger: true, operationsDashboard: false },
  { id: "pro50", name: "Pro 50", monthlyPrice: 29_000, includedTaxInvoices: 50, ledger: true, operationsDashboard: true },
  { id: "pro100", name: "Pro 100", monthlyPrice: 49_000, includedTaxInvoices: 100, ledger: true, operationsDashboard: true }
];

export const creditPackages = [
  { id: "credits20", credits: 20, price: 4_300 },
  { id: "credits50", credits: 50, price: 9_900 },
  { id: "credits100", credits: 100, price: 18_900 },
  { id: "credits300", credits: 300, price: 54_900 }
] as const;

export const creditCosts = {
  taxInvoice: 2,
  quotePdf: 1,
  transactionStatement: 1,
  email: 1,
  unpaidNotice: 1,
  businessStatusCheck: 0
} as const;

export const formatWon = (value: number) => `${value.toLocaleString("ko-KR")}원`;
