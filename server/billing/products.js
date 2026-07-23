export const billingProducts = {
  starter: { type: "subscription", name: "블링빌 입문", amount: 9900 },
  pro50: { type: "subscription", name: "블링빌 Pro 50", amount: 29000 },
  pro100: { type: "subscription", name: "블링빌 Pro 100", amount: 49000 },
  credits20: { type: "credits", name: "블링빌 20 크레딧", amount: 4300 },
  credits50: { type: "credits", name: "블링빌 50 크레딧", amount: 9900 },
  credits100: { type: "credits", name: "블링빌 100 크레딧", amount: 18900 },
  credits300: { type: "credits", name: "블링빌 300 크레딧", amount: 54900 }
};

export function requireBillingProduct(productId) {
  const product = billingProducts[String(productId || "")];
  if (!product) throw new Error("선택한 결제 상품을 찾을 수 없습니다.");
  return { id: String(productId), ...product };
}
