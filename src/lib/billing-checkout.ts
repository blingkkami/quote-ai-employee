import PortOne from "@portone/browser-sdk/v2";
import { authorizedFetch } from "./authorized-fetch";
import type { CreditPackageId, PlanId } from "./billing-plans";

type PurchasablePlanId = Exclude<PlanId, "free">;
export type BillingProductId = CreditPackageId | PurchasablePlanId;

type CheckoutOrder = {
  ok: boolean;
  orderId: string;
  storeId: string;
  channelKey: string;
  customerId: string;
  product: { id: BillingProductId; type: "credits" | "subscription"; name: string; amount: number };
  message?: string;
};

async function checkoutApi(body: Record<string, unknown>) {
  const response = await authorizedFetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.message || "결제 요청을 처리하지 못했습니다.");
  return result;
}

export async function startBillingCheckout(productId: BillingProductId) {
  const order = await checkoutApi({ mode: "create", productId }) as CheckoutOrder;
  const redirectUrl = `${window.location.origin}${window.location.pathname}?billing_return=1&checkoutType=${order.product.type}&orderId=${encodeURIComponent(order.orderId)}`;

  if (order.product.type === "credits") {
    const payment = await PortOne.requestPayment({
      storeId: order.storeId,
      channelKey: order.channelKey,
      paymentId: order.orderId,
      orderName: order.product.name,
      totalAmount: order.product.amount,
      currency: "KRW",
      payMethod: "CARD",
      customer: { customerId: order.customerId },
      redirectUrl
    });
    if (!payment) return { redirected: true };
    if (payment.code) throw new Error(payment.message || "결제가 취소되거나 실패했습니다.");
    return checkoutApi({ mode: "complete", orderId: order.orderId });
  }

  const billing = await PortOne.requestIssueBillingKey({
    storeId: order.storeId,
    channelKey: order.channelKey,
    issueId: order.orderId,
    issueName: `${order.product.name} 정기결제 카드 등록`,
    billingKeyMethod: "CARD",
    displayAmount: order.product.amount,
    currency: "KRW",
    customer: { customerId: order.customerId },
    redirectUrl
  });
  if (!billing) return { redirected: true };
  if (billing.code) throw new Error(billing.message || "정기결제 카드 등록이 취소되거나 실패했습니다.");
  return checkoutApi({ mode: "activate-subscription", orderId: order.orderId, billingKey: billing.billingKey });
}

export async function completeRedirectedCheckout(orderId: string, billingKey?: string) {
  return checkoutApi(billingKey
    ? { mode: "activate-subscription", orderId, billingKey }
    : { mode: "complete", orderId });
}
