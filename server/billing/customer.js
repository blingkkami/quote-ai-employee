export function billingCustomerId(userId) {
  const value = String(userId || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
  if (!value) throw new Error("결제 고객 식별자를 만들 수 없습니다.");
  return value;
}
