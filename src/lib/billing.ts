import { requireSupabase } from "./supabase";

export type BillableAction = "tax_invoice" | "quote_pdf" | "transaction_statement" | "email" | "unpaid_notice";

export type BillingActionResult = {
  allowed: boolean;
  source: "credit" | "included" | "unlimited";
  creditBalance: number;
  includedInvoiceUsed: number;
  message: string;
};

export async function authorizeBillingAction(feature: BillableAction, referenceId: string): Promise<BillingActionResult> {
  const { data, error } = await requireSupabase().rpc("consume_billing_action", {
    p_feature: feature,
    p_reference_id: referenceId
  });
  if (error) throw new Error(error.message);
  const result = data?.[0];
  if (!result) throw new Error("사용 승인 결과를 확인할 수 없습니다.");
  return {
    allowed: result.allowed,
    source: result.source,
    creditBalance: result.credit_balance,
    includedInvoiceUsed: result.included_invoice_used,
    message: result.message
  };
}

export async function reverseBillingAction(feature: BillableAction, referenceId: string) {
  const { data, error } = await requireSupabase().rpc("reverse_billing_action", {
    p_feature: feature,
    p_reference_id: referenceId
  });
  if (error) throw new Error(error.message);
  return data?.[0];
}

export async function grantSignupCredits(businessNumber: string) {
  const { data, error } = await requireSupabase().rpc("grant_signup_credits", {
    p_business_number: businessNumber
  });
  if (error) throw new Error(error.message);
  return data?.[0];
}
