import { authorizeRequest } from "../../server/popbill/auth.js";
import {
  createOAuthState,
  oauthAuthorizationUrl,
  revokeEmailConnection,
  requireEmailAdmin
} from "../../server/email/service.js";

export default async function handler(request, response) {
  response.setHeader?.("Cache-Control", "no-store");
  if (request.method !== "POST" && request.method !== "DELETE") {
    response.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }
  const auth = await authorizeRequest(request, response);
  if (!auth) return;
  try {
    const admin = requireEmailAdmin(auth);
    if (request.method === "DELETE") {
      await revokeEmailConnection(admin, auth.user.id);
      response.status(200).json({ ok: true, connected: false, message: "발신메일 연결을 해제했습니다." });
      return;
    }
    let body = request.body || {};
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const provider = String(body.provider || "");
    if (provider !== "google" && provider !== "microsoft") {
      response.status(400).json({ ok: false, message: "Google 또는 Microsoft 메일을 선택해 주세요." });
      return;
    }
    const state = await createOAuthState(admin, auth.user.id, provider);
    const authorizationUrl = oauthAuthorizationUrl(provider, state);
    response.status(200).json({ ok: true, authorizationUrl });
  } catch (error) {
    response.status(503).json({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
}
