import { timingSafeEqual } from "node:crypto";

export const isAccessTokenConfigured = () => Boolean(process.env.POPBILL_ACCESS_TOKEN);

const requestToken = (request) => {
  const headers = request?.headers;
  if (!headers) return "";
  if (typeof headers.get === "function") return String(headers.get("x-blingbill-token") || "");
  return String(headers["x-blingbill-token"] || headers["X-Blingbill-Token"] || "");
};

export const hasValidAccessToken = (request) => {
  const expected = String(process.env.POPBILL_ACCESS_TOKEN || "");
  const received = requestToken(request);
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected, "utf8");
  const receivedBytes = Buffer.from(received, "utf8");
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
};

export const rejectPopbillAccess = (response, status = 401) => response.status(status).json({
  ok: false,
  invoiceStatus: "pending",
  message: status === 503
    ? "Vercel에 POPBILL_ACCESS_TOKEN 발행 보안키를 먼저 설정해 주세요."
    : "발행 보안키가 일치하지 않습니다. 설정 화면에서 다시 확인해 주세요."
});
