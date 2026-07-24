import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { readRawBody, verifyWebhookSignature } from "../../../api/billing/webhook.js";

const keyBytes = crypto.randomBytes(24);
const secret = `whsec_${keyBytes.toString("base64")}`;
const sign = (id, timestamp, rawBody) =>
  crypto.createHmac("sha256", keyBytes).update(`${id}.${timestamp}.${rawBody}`).digest("base64");

const makeRequest = (headers) => ({ headers });
const now = () => Math.floor(Date.now() / 1000);

describe("PortOne webhook signature verification", () => {
  it("accepts a correctly signed payload", () => {
    const id = "wh_1";
    const ts = String(now());
    const raw = JSON.stringify({ type: "Transaction.Paid", data: { paymentId: "order-1" } });
    const request = makeRequest({
      "webhook-id": id,
      "webhook-timestamp": ts,
      "webhook-signature": `v1,${sign(id, ts, raw)}`
    });
    expect(() => verifyWebhookSignature(secret, request, raw)).not.toThrow();
  });

  it("rejects a tampered body", () => {
    const id = "wh_2";
    const ts = String(now());
    const raw = JSON.stringify({ data: { paymentId: "order-1" } });
    const request = makeRequest({
      "webhook-id": id,
      "webhook-timestamp": ts,
      "webhook-signature": `v1,${sign(id, ts, raw)}`
    });
    const tampered = JSON.stringify({ data: { paymentId: "order-2" } });
    expect(() => verifyWebhookSignature(secret, request, tampered)).toThrow("서명이 일치하지 않습니다");
  });

  it("rejects an expired timestamp (replay protection)", () => {
    const id = "wh_3";
    const ts = String(now() - 3600);
    const raw = "{}";
    const request = makeRequest({
      "webhook-id": id,
      "webhook-timestamp": ts,
      "webhook-signature": `v1,${sign(id, ts, raw)}`
    });
    expect(() => verifyWebhookSignature(secret, request, raw)).toThrow("타임스탬프");
  });

  it("rejects when signature headers are missing", () => {
    expect(() => verifyWebhookSignature(secret, makeRequest({}), "{}")).toThrow("서명 헤더가 없습니다");
  });

  it("reads a raw body string from a non-stream request (test harness)", async () => {
    const raw = await readRawBody({ body: { hello: "world" } });
    expect(raw).toBe(JSON.stringify({ hello: "world" }));
  });
});
