import { authorizeRequest } from "../../server/popbill/auth.js";
import { requireEmailAdmin, saveEmailConnection, verifySmtpConnection } from "../../server/email/service.js";

export default async function handler(request, response) {
  response.setHeader?.("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }
  const auth = await authorizeRequest(request, response);
  if (!auth) return;
  try {
    let body = request.body || {};
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const connection = await verifySmtpConnection(body);
    await saveEmailConnection(requireEmailAdmin(auth), auth.user.id, connection);
    response.status(200).json({
      ok: true,
      connected: true,
      provider: connection.provider,
      email: connection.email,
      displayName: connection.displayName,
      message: `${connection.email} 발신메일 연결을 완료했습니다.`
    });
  } catch (error) {
    response.status(400).json({ ok: false, connected: false, message: error instanceof Error ? error.message : String(error) });
  }
}
