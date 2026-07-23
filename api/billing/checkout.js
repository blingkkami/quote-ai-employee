import { authorizeRequest } from "../../server/popbill/auth.js";
import { encryptBillingKey } from "../../server/billing/encryption.js";
import { requireBillingProduct } from "../../server/billing/products.js";
import { nextMonthlyChargeAt } from "../../server/billing/dates.js";
import { billingCustomerId } from "../../server/billing/customer.js";

const portOneConfig = () => {
  const storeId = String(process.env.PORTONE_STORE_ID || "").trim();
  const channelKey = String(process.env.PORTONE_CHANNEL_KEY || "").trim();
  const apiSecret = String(process.env.PORTONE_API_SECRET || "").trim();
  if (!storeId || !channelKey || !apiSecret) throw new Error("PortOne 결제 환경변수가 필요합니다.");
  return { storeId, channelKey, apiSecret };
};

async function portOneFetch(path, apiSecret, init = {}) {
  const response = await fetch(`https://api.portone.io${path}`, {
    ...init,
    headers: {
      Authorization: `PortOne ${apiSecret}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `PortOne 요청 실패 (HTTP ${response.status})`);
  return result;
}

async function getOwnOrder(admin, userId, orderId) {
  const { data, error } = await admin.from("billing_orders").select("*").eq("id", orderId).eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("결제 주문을 찾을 수 없습니다.");
  return data;
}

async function applyVerifiedPayment(admin, order, payment, expectedStoreId) {
  if (payment.status !== "PAID") throw new Error("결제가 완료되지 않았습니다.");
  if (payment.storeId && payment.storeId !== expectedStoreId) throw new Error("결제 상점 정보가 일치하지 않습니다.");
  if (Number(payment.amount?.total) !== Number(order.amount)) throw new Error("결제 금액이 주문 금액과 일치하지 않습니다.");
  const { data, error } = await admin.rpc("apply_paid_billing_order", {
    p_order_id: order.id,
    p_provider_order_id: payment.id
  });
  if (error) throw new Error(error.message);
  return data?.[0];
}

async function createNextSubscriptionOrder(admin, userId, product, billingKey, config) {
  const { data: existing, error: existingError } = await admin
    .from("billing_orders")
    .select("id, scheduled_at")
    .eq("user_id", userId)
    .eq("is_renewal", true)
    .eq("status", "pending")
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  let nextOrder = existing;
  if (!nextOrder) {
    const { data, error } = await admin.from("billing_orders").insert({
      user_id: userId,
      product_type: "subscription",
      product_id: product.id,
      amount: product.amount,
      provider: "portone",
      is_renewal: true
    }).select("id, scheduled_at").single();
    if (error) throw new Error(error.message);
    nextOrder = data;
  }
  if (nextOrder.scheduled_at) return nextOrder.id;
  const scheduledAt = nextMonthlyChargeAt();
  await portOneFetch(`/payments/${encodeURIComponent(nextOrder.id)}/schedule`, config.apiSecret, {
    method: "POST",
    headers: { "Idempotency-Key": `schedule-${nextOrder.id}` },
    body: JSON.stringify({
      payment: {
        storeId: config.storeId,
        billingKey,
        orderName: product.name,
        customer: { id: billingCustomerId(userId) },
        amount: { total: product.amount },
        currency: "KRW"
      },
      timeToPay: scheduledAt
    })
  });
  const { error: updateError } = await admin
    .from("billing_orders")
    .update({ scheduled_at: scheduledAt })
    .eq("id", nextOrder.id)
    .eq("status", "pending");
  if (updateError) throw new Error(updateError.message);
  return nextOrder.id;
}

export default async function handler(request, response) {
  response.setHeader?.("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }
  const auth = await authorizeRequest(request, response);
  if (!auth) return;
  if (!auth.admin) {
    response.status(503).json({ ok: false, message: "결제 서버의 관리자 설정이 필요합니다." });
    return;
  }

  try {
    const config = portOneConfig();
    let body = request.body || {};
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const mode = String(body.mode || "");

    if (mode === "create") {
      const product = requireBillingProduct(body.productId);
      if (product.type === "subscription") {
        const { data: account, error: accountError } = await auth.admin
          .from("billing_accounts")
          .select("plan_id, status")
          .eq("user_id", auth.user.id)
          .maybeSingle();
        if (accountError || !account) throw new Error("요금 계정을 찾을 수 없습니다.");
        if (account.status === "active" && account.plan_id !== "free") {
          throw new Error("요금제 변경·해지 기준을 확정한 뒤 변경할 수 있습니다.");
        }
      }
      const { data: order, error } = await auth.admin.from("billing_orders").insert({
        user_id: auth.user.id,
        product_type: product.type,
        product_id: product.id,
        amount: product.amount,
        provider: "portone"
      }).select("id").single();
      if (error) throw new Error(error.message);
      response.status(200).json({
        ok: true,
        orderId: order.id,
        product,
        storeId: config.storeId,
        channelKey: config.channelKey,
        customerId: billingCustomerId(auth.user.id)
      });
      return;
    }

    if (mode === "complete") {
      const order = await getOwnOrder(auth.admin, auth.user.id, String(body.orderId || ""));
      if (order.product_type !== "credits") throw new Error("크레딧 구매 주문이 아닙니다.");
      const payment = await portOneFetch(`/payments/${encodeURIComponent(order.id)}`, config.apiSecret);
      const applied = await applyVerifiedPayment(auth.admin, order, payment, config.storeId);
      response.status(200).json({ ok: true, applied, message: "결제를 확인하고 상품을 적용했습니다." });
      return;
    }

    if (mode === "activate-subscription") {
      const order = await getOwnOrder(auth.admin, auth.user.id, String(body.orderId || ""));
      const product = requireBillingProduct(order.product_id);
      if (product.type !== "subscription") throw new Error("정액권 주문이 아닙니다.");
      const billingKey = String(body.billingKey || "").trim();
      if (!billingKey) throw new Error("발급된 빌링키가 필요합니다.");
      const billingInfo = await portOneFetch(`/billing-keys/${encodeURIComponent(billingKey)}`, config.apiSecret);
      if (billingInfo.status !== "ISSUED") throw new Error("사용 가능한 정기결제 수단이 아닙니다.");
      if (billingInfo.storeId && billingInfo.storeId !== config.storeId) throw new Error("정기결제 상점 정보가 일치하지 않습니다.");
      if (billingInfo.customer?.id && billingInfo.customer.id !== billingCustomerId(auth.user.id)) {
        throw new Error("정기결제 고객 정보가 일치하지 않습니다.");
      }

      const charged = await portOneFetch(`/payments/${encodeURIComponent(order.id)}/billing-key`, config.apiSecret, {
        method: "POST",
        headers: { "Idempotency-Key": `initial-${order.id}` },
        body: JSON.stringify({
          storeId: config.storeId,
          billingKey,
          channelKey: config.channelKey,
          orderName: product.name,
          customer: { id: billingCustomerId(auth.user.id) },
          amount: { total: product.amount },
          currency: "KRW"
        })
      });
      const applied = await applyVerifiedPayment(auth.admin, order, charged.payment, config.storeId);
      const { error: methodError } = await auth.admin.from("billing_payment_methods").upsert({
        user_id: auth.user.id,
        provider: "portone",
        billing_key_encrypted: encryptBillingKey(billingKey),
        status: "active"
      }, { onConflict: "user_id" });
      if (methodError) throw new Error(methodError.message);

      let nextOrderId;
      let scheduleWarning;
      try {
        nextOrderId = await createNextSubscriptionOrder(auth.admin, auth.user.id, product, billingKey, config);
      } catch (error) {
        scheduleWarning = error instanceof Error ? error.message : String(error);
      }
      response.status(200).json({
        ok: true,
        applied,
        nextOrderId,
        scheduleWarning,
        message: scheduleWarning ? "정액권은 적용됐지만 다음 결제 예약을 다시 확인해야 합니다." : "정액권을 적용하고 다음 결제를 예약했습니다."
      });
      return;
    }

    response.status(400).json({ ok: false, message: "지원하지 않는 결제 요청입니다." });
  } catch (error) {
    response.status(400).json({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
}
