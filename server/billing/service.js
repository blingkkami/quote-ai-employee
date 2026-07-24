// PortOne 계약·환불정책·과금 DB가 준비되기 전에는 BILLING_ENABLED가 "true"가 아니므로
// 과금 없이 모든 작업을 승인한다(안전 모드). 준비가 끝나면 환경변수로 켠다.
const billingEnabled = () => process.env.BILLING_ENABLED === "true";

// consume/reverse RPC는 service role 전용이므로 admin 클라이언트와 검증된 userId로만 호출합니다.
export async function authorizeBillingActions(admin, userId, actions) {
  if (!billingEnabled()) return { ok: true, approved: [] };
  if (!admin) throw new Error("결제 서버의 관리자 설정이 필요합니다.");
  const approved = [];
  for (const action of actions) {
    const { data, error } = await admin.rpc("consume_billing_action", {
      p_user_id: userId,
      p_feature: action.feature,
      p_reference_id: action.referenceId
    });
    if (error) {
      await reverseBillingActions(admin, userId, approved);
      throw new Error(error.message);
    }
    const result = data?.[0];
    if (!result?.allowed) {
      await reverseBillingActions(admin, userId, approved);
      return { ok: false, message: result?.message || "요금제 사용 승인을 받지 못했습니다." };
    }
    approved.push(action);
  }
  return { ok: true, approved };
}

export async function reverseBillingActions(admin, userId, actions) {
  if (!billingEnabled()) return;
  if (!admin) return;
  await Promise.allSettled(actions.map((action) => admin.rpc("reverse_billing_action", {
    p_user_id: userId,
    p_feature: action.feature,
    p_reference_id: action.referenceId
  })));
}

export function requiredBillingReference(value, label) {
  const referenceId = String(value || "").trim();
  if (!referenceId || referenceId.length > 180) throw new Error(`${label} 사용 승인 번호가 필요합니다.`);
  return referenceId;
}
