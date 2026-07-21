import {
  authorizeRequest,
  getConnectionByCorpNum,
  getUserConnection,
  removeUserConnection,
  saveUserConnection
} from "../../server/popbill/auth.js";
import { callPopbill, getPopbillService } from "../../server/popbill/service.js";

const digits = (value) => String(value ?? "").replace(/\D/g, "");
const text = (value, maxLength = 200) => String(value ?? "").trim().slice(0, maxLength);

const connectionPayload = (profile) => ({
  corp_num: digits(profile.businessNumber),
  popbill_user_id: text(profile.popbillUserId, 50),
  corp_name: text(profile.corpName),
  ceo_name: text(profile.ceoName, 100),
  address: text(profile.address, 300),
  biz_type: text(profile.bizType, 100),
  biz_class: text(profile.bizClass, 100),
  contact_name: text(profile.contactName, 100),
  contact_email: text(profile.contactEmail, 100),
  contact_phone: text(profile.contactPhone, 20),
  connected_at: new Date().toISOString()
});

const validateJoinProfile = (profile) => {
  const required = [
    [digits(profile.businessNumber).length === 10, "사업자등록번호 10자리를 확인해 주세요."],
    [text(profile.corpName).length > 0, "상호를 입력해 주세요."],
    [text(profile.ceoName).length > 0, "대표자명을 입력해 주세요."],
    [text(profile.address).length > 0, "사업장 주소를 입력해 주세요."],
    [text(profile.bizType).length > 0, "업태를 입력해 주세요."],
    [text(profile.bizClass).length > 0, "종목을 입력해 주세요."],
    [text(profile.contactName).length > 0, "담당자명을 입력해 주세요."],
    [/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(profile.contactEmail)), "담당자 이메일을 확인해 주세요."],
    [digits(profile.contactPhone).length >= 9, "담당자 연락처를 확인해 주세요."],
    [/^[A-Za-z0-9._-]{6,50}$/.test(text(profile.popbillUserId)), "팝빌 아이디는 영문·숫자 6자 이상 입력해 주세요."],
    [String(profile.popbillPassword ?? "").length >= 8 && String(profile.popbillPassword ?? "").length <= 20, "팝빌 비밀번호는 8~20자로 입력해 주세요."]
  ];
  return required.find(([valid]) => !valid)?.[1];
};

export default async function handler(request, response) {
  response.setHeader?.("Cache-Control", "no-store");
  if (!(["POST", "DELETE"].includes(request.method))) {
    response.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }

  const auth = await authorizeRequest(request, response);
  if (!auth) return;
  if (!auth.admin) {
    response.status(503).json({ ok: false, configured: false, message: "사용자별 팝빌 연결 서버 설정이 완료되지 않았습니다." });
    return;
  }

  try {
    if (request.method === "DELETE") {
      await removeUserConnection(auth.admin, auth.user.id);
      response.status(200).json({ ok: true, configured: false, message: "팝빌 자동발행 연결을 해제했습니다." });
      return;
    }

    let body = request.body || {};
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const profile = body.profile || body;
    const corpNum = digits(profile.businessNumber);
    if (corpNum.length !== 10) {
      response.status(400).json({ ok: false, configured: false, message: "사업자등록번호 10자리를 확인해 주세요." });
      return;
    }

    const ownConnection = await getUserConnection(auth.admin, auth.user.id);
    if (ownConnection?.corp_num === corpNum) {
      response.status(200).json({ ok: true, configured: true, connection: ownConnection, message: "팝빌 자동발행이 이미 연결되어 있습니다." });
      return;
    }
    if (ownConnection && ownConnection.corp_num !== corpNum) {
      response.status(409).json({ ok: false, configured: false, message: "현재 계정에 다른 사업자가 연결되어 있습니다. 기존 연결을 먼저 해제해 주세요." });
      return;
    }

    const claimed = await getConnectionByCorpNum(auth.admin, corpNum);
    if (claimed && claimed.user_id !== auth.user.id) {
      response.status(409).json({ ok: false, configured: false, message: "이 사업자번호는 다른 블링빌 계정에 연결되어 있습니다. 관리자에게 문의해 주세요." });
      return;
    }

    const popbill = getPopbillService();
    if (!popbill.service) {
      response.status(503).json({ ok: false, configured: false, missing: popbill.missing, message: "팝빌 자동발행 서버가 아직 준비되지 않았습니다." });
      return;
    }

    const member = await callPopbill(popbill.service, "checkIsMember", [corpNum]);
    const isMember = member.ok && Number(member.result?.code) === 1;

    if (body.mode !== "join") {
      if (isMember) {
        response.status(409).json({
          ok: false,
          configured: false,
          existingMember: true,
          message: "이미 팝빌 연동회원인 사업자입니다. 안전한 계정 확인을 위해 블링빌 관리자에게 연결을 요청해 주세요."
        });
        return;
      }
      response.status(200).json({ ok: true, configured: false, needsSignup: true, message: "기본 정보만 입력하면 팝빌 가입과 자동발행 연결이 한 번에 완료됩니다." });
      return;
    }

    if (isMember) {
      response.status(409).json({ ok: false, configured: false, existingMember: true, message: "이미 가입된 사업자입니다. 관리자에게 연결 확인을 요청해 주세요." });
      return;
    }
    const validationError = validateJoinProfile(profile);
    if (validationError) {
      response.status(400).json({ ok: false, configured: false, message: validationError });
      return;
    }

    const joinForm = {
      ID: text(profile.popbillUserId, 50),
      Password: String(profile.popbillPassword),
      LinkID: popbill.linkId,
      CorpNum: corpNum,
      CEOName: text(profile.ceoName, 100),
      CorpName: text(profile.corpName),
      Addr: text(profile.address, 300),
      BizType: text(profile.bizType, 100),
      BizClass: text(profile.bizClass, 100),
      ContactName: text(profile.contactName, 100),
      ContactEmail: text(profile.contactEmail, 100),
      ContactTEL: text(profile.contactPhone, 20)
    };
    const joined = await callPopbill(popbill.service, "joinMember", [joinForm]);
    if (!joined.ok || Number(joined.result?.code) !== 1) {
      response.status(400).json({
        ok: false,
        configured: false,
        message: String(joined.error?.message || joined.result?.message || "팝빌 가입을 완료하지 못했습니다.")
      });
      return;
    }

    const connection = connectionPayload(profile);
    await saveUserConnection(auth.admin, auth.user.id, connection);
    response.status(200).json({
      ok: true,
      configured: true,
      connection,
      environment: popbill.environment,
      message: "팝빌 연결이 완료되었습니다. 이제 승인된 견적은 설정에 따라 자동 발행됩니다."
    });
  } catch (error) {
    response.status(500).json({ ok: false, configured: false, message: error instanceof Error ? error.message : String(error) });
  }
}
