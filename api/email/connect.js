import { authorizeRequest } from "../../server/popbill/auth.js";
import {
  createOAuthState,
  getEmailConnection,
  oauthAuthorizationUrl,
  publicConnection,
  requireEmailAdmin,
  revokeEmailConnection,
  saveEmailConnection,
  verifySmtpConnection
} from "../../server/email/service.js";

// 발신메일 연결 관리(상태조회·OAuth 시작·SMTP 연결·해제)를 한 라우트로 합쳤다.
// Vercel 무료 플랜 함수 수 제한(12개) 때문에 status·smtp-connect를 이 파일로 병합했다.
export default async function handler(request, response) {
  response.setHeader?.("Cache-Control", "no-store");
  if (!["GET", "POST", "DELETE"].includes(request.method)) {
    response.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }
  const auth = await authorizeRequest(request, response);
  if (!auth) return;

  try {
    const admin = requireEmailAdmin(auth);

    // 연결 상태 조회
    if (request.method === "GET") {
      const connection = await getEmailConnection(admin, auth.user.id);
      response.status(200).json({ ok: true, ...publicConnection(connection) });
      return;
    }

    // 연결 해제
    if (request.method === "DELETE") {
      await revokeEmailConnection(admin, auth.user.id);
      response.status(200).json({ ok: true, connected: false, message: "발신메일 연결을 해제했습니다." });
      return;
    }

    let body = request.body || {};
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    // SMTP/네이버 등 직접 연결
    if (body.mode === "smtp") {
      const connection = await verifySmtpConnection(body);
      await saveEmailConnection(admin, auth.user.id, connection);
      response.status(200).json({
        ok: true,
        connected: true,
        provider: connection.provider,
        email: connection.email,
        displayName: connection.displayName,
        message: `${connection.email} 발신메일 연결을 완료했습니다.`
      });
      return;
    }

    // Google/Microsoft OAuth 시작
    const provider = String(body.provider || "");
    if (provider !== "google" && provider !== "microsoft") {
      response.status(400).json({ ok: false, message: "Google 또는 Microsoft 메일을 선택해 주세요." });
      return;
    }
    const state = await createOAuthState(admin, auth.user.id, provider);
    const authorizationUrl = oauthAuthorizationUrl(provider, state);
    response.status(200).json({ ok: true, authorizationUrl });
  } catch (error) {
    response.status(503).json({ ok: false, connected: false, message: error instanceof Error ? error.message : String(error) });
  }
}
