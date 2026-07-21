import { authorizeRequest, getUserConnection } from "./auth.js";
import { callPopbill, getPopbillService } from "./service.js";

export default async function handler(request, response) {
  response.setHeader?.("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }

  const auth = await authorizeRequest(request, response);
  if (!auth) return;

  try {
    const connection = await getUserConnection(auth.client, auth.user.id);
    if (!connection) {
      response.status(200).json({ ok: true, configured: false, message: "연결할 사업자등록번호를 입력해 주세요." });
      return;
    }
    const popbill = getPopbillService();
    if (!popbill.service) {
      response.status(503).json({ ok: false, configured: false, missing: popbill.missing, message: "팝빌 자동발행 서버가 아직 준비되지 않았습니다." });
      return;
    }
    const member = await callPopbill(popbill.service, "checkIsMember", [connection.corp_num]);
    const configured = member.ok && Number(member.result?.code) === 1;
    response.status(200).json({
      ok: configured,
      configured,
      environment: popbill.environment,
      connection,
      message: configured ? "팝빌 자동발행 연결이 정상입니다." : String(member.error?.message || member.result?.message || "팝빌 연결을 확인하지 못했습니다.")
    });
  } catch (error) {
    response.status(500).json({ ok: false, configured: false, message: error instanceof Error ? error.message : String(error) });
  }
}
