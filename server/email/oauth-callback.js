import {
  appRedirectUrl,
  consumeOAuthState,
  createEmailAdmin,
  exchangeOAuthCode,
  saveEmailConnection
} from "./service.js";

const queryValue = (request, name) => String(request.query?.[name] || "");

function redirect(response, location) {
  if (typeof response.redirect === "function") {
    response.redirect(302, location);
    return;
  }
  response.statusCode = 302;
  response.setHeader("Location", location);
  response.end();
}

export async function handleOAuthCallback(provider, request, response) {
  response.setHeader?.("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }
  try {
    const oauthError = queryValue(request, "error");
    if (oauthError) throw new Error("메일 계정 권한 승인이 취소되었습니다.");
    const code = queryValue(request, "code");
    const state = queryValue(request, "state");
    if (!code || !state) throw new Error("메일 연결 승인정보가 없습니다.");
    const admin = createEmailAdmin();
    const userId = await consumeOAuthState(admin, state, provider);
    const connection = await exchangeOAuthCode(provider, code);
    if (!connection.email) throw new Error("연결한 계정의 이메일 주소를 확인하지 못했습니다.");
    await saveEmailConnection(admin, userId, connection);
    redirect(response, appRedirectUrl("connected", provider));
  } catch (error) {
    redirect(response, appRedirectUrl("error", provider, error instanceof Error ? error.message : String(error)));
  }
}

