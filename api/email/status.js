import { authorizeRequest } from "../../server/popbill/auth.js";
import { getEmailConnection, publicConnection, requireEmailAdmin } from "../../server/email/service.js";

export default async function handler(request, response) {
  response.setHeader?.("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }
  const auth = await authorizeRequest(request, response);
  if (!auth) return;
  try {
    const connection = await getEmailConnection(requireEmailAdmin(auth), auth.user.id);
    response.status(200).json({ ok: true, ...publicConnection(connection) });
  } catch (error) {
    response.status(503).json({ ok: false, connected: false, message: error instanceof Error ? error.message : String(error) });
  }
}
