import popbill from "popbill";
import { hasValidAccessToken, rejectPopbillAccess } from "./auth.js";

const requiredVariables = ["POPBILL_LINK_ID", "POPBILL_SECRET_KEY", "POPBILL_CORP_NUM", "POPBILL_CORP_NAME", "POPBILL_CEO_NAME", "POPBILL_ACCESS_TOKEN"];
const missing = requiredVariables.filter((name) => !process.env[name]);
const environment = process.env.POPBILL_IS_TEST === "false" ? "production" : "test";
let taxinvoiceService = null;

if (missing.length === 0) {
  popbill.config({
    LinkID: process.env.POPBILL_LINK_ID,
    SecretKey: process.env.POPBILL_SECRET_KEY,
    IsTest: environment === "test",
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

  if (missing.length > 0) {
    response.status(200).json({
      ok: false,
      configured: false,
      environment,
      missing,
      message: `Vercel 환경변수 ${missing.join(", ")} 설정이 필요합니다.`
    });
    return;
  }
  if (!hasValidAccessToken(request)) {
    rejectPopbillAccess(response);
    return;
  }

  const corpNum = String(process.env.POPBILL_CORP_NUM).replace(/\D/g, "");
  const result = await new Promise((resolve) => {
    const timeout = setTimeout(
      () => resolve({ ok: false, error: { message: "팝빌 응답 시간이 초과되었습니다." } }),
      8000
    );
    const finish = (value) => {
      clearTimeout(timeout);
      resolve(value);
    };
    try {
      taxinvoiceService.checkIsMember(
        corpNum,
        (member) => finish({ ok: member?.code === 1, member }),
        (error) => finish({ ok: false, error })
      );
    } catch (error) {
      finish({ ok: false, error });
    }
  });

  response.status(200).json({
    ok: result.ok,
    configured: result.ok,
    environment,
    missing: [],
    message: result.ok
      ? "팝빌 서버 연결과 연동회원 상태를 확인했습니다."
      : `팝빌 연결을 확인하지 못했습니다. ${result.error?.message || result.member?.message || "인증정보와 회원 상태를 확인해 주세요."}`
  });
}
