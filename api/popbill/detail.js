import popbill from "popbill";
import { authorizeRequest, getUserConnection } from "./auth.js";

const LINK_ID = process.env.POPBILL_LINK_ID;
const SECRET_KEY = process.env.POPBILL_SECRET_KEY;
const IS_TEST = process.env.POPBILL_IS_TEST !== "false";
const configured = Boolean(LINK_ID && SECRET_KEY);

let taxinvoiceService = null;
if (configured) {
  popbill.config({
    LinkID: LINK_ID,
    SecretKey: SECRET_KEY,
    IsTest: IS_TEST,
    IPRestrictOnOff: true,
    UseStaticIP: false,
    UseLocalTimeYN: true,
    defaultErrorHandler: () => {}
  });
  taxinvoiceService = popbill.TaxinvoiceService();
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }
  const auth = await authorizeRequest(request, response);
  if (!auth) return;
  if (!configured) {
    response.status(503).json({
      ok: false,
      invoiceStatus: "pending",
      message: "팝빌 서버 인증정보가 없어 상태를 조회할 수 없습니다."
    });
    return;
  }
  const mgtKey = String(request.query?.mgtKey || "").trim();
  if (!mgtKey) {
    response.status(400).json({ ok: false, invoiceStatus: "failed", message: "팝빌 발행 관리번호가 필요합니다." });
    return;
  }

  const connection = await getUserConnection(auth.client, auth.user.id);
  if (!connection) {
    response.status(409).json({ ok: false, invoiceStatus: "pending", message: "팝빌 자동발행 연결정보가 없습니다." });
    return;
  }

  const detail = await new Promise((resolve) => {
    taxinvoiceService.getDetailInfo(
      String(connection.corp_num).replace(/\D/g, ""),
      "SELL",
      mgtKey,
      connection.popbill_user_id || "",
      (result) => resolve({ ok: true, result }),
      (error) => resolve({ ok: false, error })
    );
  });

  if (!detail.ok) {
    response.status(200).json({
      ok: false,
      invoiceStatus: "failed",
      message: String(detail.error?.message || detail.error?.code || "팝빌 상태 조회에 실패했습니다.")
    });
    return;
  }

  const result = detail.result || {};
  const invoiceStatus = result.ntsconfirmNum ? "sent" : result.issueDT ? "issued" : "pending";
  response.status(200).json({
    ok: true,
    invoiceStatus,
    popbillInvoiceId: mgtKey,
    popbillNtsConfirmNum: result.ntsconfirmNum || undefined,
    message: invoiceStatus === "sent" ? "국세청 전송 상태가 확인되었습니다." : invoiceStatus === "issued" ? "팝빌 발행 상태가 확인되었습니다." : "발행 처리 중입니다."
  });
}
