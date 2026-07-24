import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { decryptBillingKey } from "../../server/billing/encryption.js";
import { requireBillingProduct } from "../../server/billing/products.js";
import { nextMonthlyChargeAt } from "../../server/billing/dates.js";
import { billingCustomerId } from "../../server/billing/customer.js";

const headerValue = (request, name) => {
  const headers = request?.headers;
  if (!headers) return "";
  if (typeof headers.get === "function") return String(headers.get(name) || "");
  return String(headers[name.toLowerCase()] || headers[name] || "");
};

// 원본 요청 바디를 문자열로 읽는다. 스트림을 먼저 소비하고, 실패 시 파싱된 body로 대체한다.
export async function readRawBody(request) {
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    if (chunks.length) return Buffer.concat(chunks).toString("utf8");
  } catch {
    // request가 스트림이 아니면(테스트 등) 아래 대체 경로로 넘어간다.
  }
  if (typeof request.body === "string") return request.body;
  if (request.body && typeof request.body === "object") return JSON.stringify(request.body);
  return "";
}

// PortOne V2 Standard Webhooks 서명 검증. 위조·재전송(replay) 웹훅을 차단한다.
export function verifyWebhookSignature(secret, request, rawBody) {
  const id = headerValue(request, "webhook-id");
  const timestamp = headerValue(request, "webhook-timestamp");
  const signatureHeader = headerValue(request, "webhook-signature");
  if (!id || !timestamp || !signatureHeader) throw new Error("웹훅 서명 헤더가 없습니다.");
  const ts = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) throw new Error("웹훅 타임스탬프가 유효 범위를 벗어났습니다.");
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  const expectedBuf = Buffer.from(expected, "base64");
  const provided = signatureHeader.split(" ").map((part) => (part.includes(",") ? part.split(",")[1] : part));
  const matched = provided.some((sig) => {
    try {
      const sigBuf = Buffer.from(sig, "base64");
      return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  });
  if (!matched) throw new Error("웹훅 서명이 일치하지 않습니다.");
}

const config = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const storeId = String(process.env.PORTONE_STORE_ID || "").trim();
  const apiSecret = String(process.env.PORTONE_API_SECRET || "").trim();
  if (!supabaseUrl || !serviceRoleKey || !storeId || !apiSecret) throw new Error("결제 webhook 환경변수가 필요합니다.");
  return {
    admin: createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    storeId,
    apiSecret
  };
};

async function portOne(path, apiSecret, init = {}) {
  const response = await fetch(`https://api.portone.io${path}`, {
    ...init,
    headers: {
      Authorization: `PortOne ${apiSecret}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `PortOne webhook 확인 실패 (HTTP ${response.status})`);
  return result;
}

async function scheduleNext(admin, order, product, billingKey, storeId, apiSecret) {
  const { data: existing, error: existingError } = await admin
    .from("billing_orders")
    .select("id, scheduled_at")
    .eq("user_id", order.user_id)
    .eq("is_renewal", true)
    .eq("status", "pending")
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  let next = existing;
  if (!next) {
    const { data, error } = await admin.from("billing_orders").insert({
      user_id: order.user_id,
      product_type: "subscription",
      product_id: product.id,
      amount: product.amount,
      provider: "portone",
      is_renewal: true
    }).select("id, scheduled_at").single();
    if (error) throw new Error(error.message);
    next = data;
  }
  if (next.scheduled_at) return next.id;
  const scheduledAt = nextMonthlyChargeAt();
  await portOne(`/payments/${encodeURIComponent(next.id)}/schedule`, apiSecret, {
    method: "POST",
    headers: { "Idempotency-Key": `schedule-${next.id}` },
    body: JSON.stringify({
      payment: {
        storeId,
        billingKey,
        orderName: product.name,
        customer: { id: billingCustomerId(order.user_id) },
        amount: { total: product.amount },
        currency: "KRW"
      },
      timeToPay: scheduledAt
    })
  });
  const { error: updateError } = await admin
    .from("billing_orders")
    .update({ scheduled_at: scheduledAt })
    .eq("id", next.id)
    .eq("status", "pending");
  if (updateError) throw new Error(updateError.message);
  return next.id;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ ok: false });
    return;
  }
  try {
    const rawBody = await readRawBody(request);
    const webhookSecret = String(process.env.PORTONE_WEBHOOK_SECRET || "").trim();
    // 시크릿이 설정된 경우에만 서명을 강제한다. 미설정 시에는 기존처럼 PortOne 재조회로만 검증한다.
    if (webhookSecret) verifyWebhookSignature(webhookSecret, request, rawBody);

    const { admin, storeId, apiSecret } = config();
    let body = {};
    if (rawBody) {
      try { body = JSON.parse(rawBody); } catch { body = {}; }
    } else if (request.body && typeof request.body === "object") {
      body = request.body;
    }
    const paymentId = String(body.data?.paymentId || body.paymentId || "").trim();
    if (!paymentId) {
      response.status(200).json({ ok: true, ignored: true });
      return;
    }

    // webhook 본문은 신뢰하지 않고 PortOne API에서 결제 상태·금액을 다시 조회합니다.
    const payment = await portOne(`/payments/${encodeURIComponent(paymentId)}`, apiSecret);
    if (payment.storeId && payment.storeId !== storeId) throw new Error("결제 상점 정보가 일치하지 않습니다.");
    const { data: order, error: orderError } = await admin.from("billing_orders").select("*").eq("id", paymentId).maybeSingle();
    if (orderError || !order) {
      response.status(200).json({ ok: true, ignored: true });
      return;
    }
    if (Number(payment.amount?.total) !== Number(order.amount)) throw new Error("결제 금액이 주문 금액과 일치하지 않습니다.");

    if (payment.status !== "PAID") {
      if (["FAILED", "CANCELLED"].includes(payment.status)) {
        await admin.from("billing_orders").update({ status: "failed" }).eq("id", order.id).eq("status", "pending");
        if (order.product_type === "subscription" && order.is_renewal) {
          await admin.from("billing_accounts").update({ status: "past_due" }).eq("user_id", order.user_id);
        }
      }
      response.status(200).json({ ok: true, status: payment.status });
      return;
    }

    // 최초 구독 결제는 인증된 사용자 요청에서 빌링키를 검증한 뒤 처리합니다.
    if (order.product_type === "subscription" && !order.is_renewal && order.status === "pending") {
      response.status(200).json({ ok: true, awaitingActivation: true });
      return;
    }

    const { data: applied, error: applyError } = await admin.rpc("apply_paid_billing_order", {
      p_order_id: order.id,
      p_provider_order_id: payment.id
    });
    if (applyError) throw new Error(applyError.message);

    if (order.product_type === "subscription" && applied?.[0]?.applied) {
      const product = requireBillingProduct(order.product_id);
      const { data: method, error: methodError } = await admin
        .from("billing_payment_methods")
        .select("billing_key_encrypted")
        .eq("user_id", order.user_id)
        .eq("status", "active")
        .maybeSingle();
      if (methodError || !method) throw new Error("다음 결제에 사용할 결제수단을 찾을 수 없습니다.");
      await scheduleNext(admin, order, product, decryptBillingKey(method.billing_key_encrypted), storeId, apiSecret);
    }
    response.status(200).json({ ok: true });
  } catch (error) {
    response.status(400).json({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
}
