import { createHmac, timingSafeEqual } from "node:crypto";

export const POPBILL_SESSION_COOKIE = "blingbill_popbill_session";
const SESSION_CONTEXT = "blingbill-popbill-session-v1";
const SESSION_MAX_AGE = 60 * 60 * 24 * 400;

export const isAccessTokenConfigured = () => Boolean(process.env.POPBILL_ACCESS_TOKEN);

const safeEqual = (expected, received) => {
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(String(expected), "utf8");
  const receivedBytes = Buffer.from(String(received), "utf8");
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
};

const requestToken = (request) => {
  const headers = request?.headers;
  if (!headers) return "";
  if (typeof headers.get === "function") return String(headers.get("x-blingbill-token") || "");
  return String(headers["x-blingbill-token"] || headers["X-Blingbill-Token"] || "");
};

const sessionValue = () => {
  const expected = String(process.env.POPBILL_ACCESS_TOKEN || "");
  return expected ? createHmac("sha256", expected).update(SESSION_CONTEXT).digest("base64url") : "";
};

const requestCookie = (request) => {
  const headers = request?.headers;
  if (!headers) return "";
  const raw = typeof headers.get === "function"
    ? String(headers.get("cookie") || "")
    : String(headers.cookie || headers.Cookie || "");
  const match = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${POPBILL_SESSION_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(POPBILL_SESSION_COOKIE.length + 1)) : "";
};

export const hasValidDirectAccessToken = (value) =>
  safeEqual(String(process.env.POPBILL_ACCESS_TOKEN || ""), String(value || ""));

export const hasValidAccessToken = (request) =>
  hasValidDirectAccessToken(requestToken(request)) || safeEqual(sessionValue(), requestCookie(request));

export const popbillSessionCookie = () => {
  const secure = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
  return `${POPBILL_SESSION_COOKIE}=${encodeURIComponent(sessionValue())}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE}${secure ? "; Secure" : ""}`;
};

export const clearPopbillSessionCookie = () =>
  `${POPBILL_SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;

export const rejectPopbillAccess = (response, status = 401) => response.status(status).json({
  ok: false,
  invoiceStatus: "pending",
  message: status === 503
    ? "Vercel에 POPBILL_ACCESS_TOKEN 발행 보안키를 먼저 설정해 주세요."
    : "발행 보안키가 일치하지 않습니다. 설정 화면에서 다시 확인해 주세요."
});
