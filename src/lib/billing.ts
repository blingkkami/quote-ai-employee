import { requireSupabase } from "./supabase";

export type BillableAction = "tax_invoice" | "quote_pdf" | "transaction_statement" | "email" | "unpaid_notice";

// 크레딧 차감(consume)·복구(reverse)는 service role 전용 RPC로 바뀌어 서버 API에서만 호출한다.
// 브라우저에서는 호출할 수 없으므로 관련 클라이언트 함수를 두지 않는다.

export async function grantSignupCredits(businessNumber: string) {
  const { data, error } = await requireSupabase().rpc("grant_signup_credits", {
    p_business_number: businessNumber
  });
  if (error) throw new Error(error.message);
  return data?.[0];
}
