import {
  authorizeRequest,
  getConnectionByCorpNum,
  getUserConnection,
  removeUserConnection,
  saveUserConnection
} from "../../server/popbill/auth.js";
import { callPopbill, getBizInfoCheckService, getClosedownService, getPopbillService } from "../../server/popbill/service.js";
import { getPopbillConfig } from "../../server/popbill/config.js";

const digits = (value) => String(value ?? "").replace(/\D/g, "");
const text = (value, maxLength = 200) => String(value ?? "").trim().slice(0, maxLength);

// 조회(상태조회·기업정보조회)에 쓸 팝빌 회원 사업자번호. 연결된 사용자는 본인 계정, 미연결(가입 전)이면 플랫폼 계정을 사용한다.
const resolveMemberCorpNum = async (admin, userId) => {
  const connection = await getUserConnection(admin, userId).catch(() => null);
  return digits(connection?.corp_num) || getPopbillConfig().corpNum;
};

// 국세청 납세자 상태 코드(팝빌 휴폐업조회 state): 0=미등록, 1=사업중, 2=폐업, 3=휴업.
// 애매하면 정상으로 단정하지 않고 확인 필요로 남긴다.
const interpretState = (raw) => {
  const state = Number(raw?.state);
  if (state === 1) return { active: true, message: "정상 영업 중인 사업자입니다." };
  if (state === 2) return { active: false, message: "국세청에 폐업으로 등록된 사업자번호입니다." };
  if (state === 3) return { active: false, message: "국세청에 휴업으로 등록된 사업자번호입니다." };
  if (state === 0) return { active: null, message: "국세청에 등록되지 않은 사업자번호입니다. 번호를 다시 확인해 주세요." };
  const message = String(raw?.message || raw?.stateString || "").trim();
  return { active: null, message: message || "사업자 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." };
};

// 팝빌 기업정보조회 응답의 필드 표기가 버전마다 다를 수 있어 후보 키를 방어적으로 탐색한다.
const pick = (raw, keys) => {
  if (!raw || typeof raw !== "object") return "";
  for (const key of keys) {
    const value = raw[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
};

// 과세유형을 확신할 수 없으면 unknown으로 남긴다(사용자 선택을 덮어쓰지 않기 위함).
const detectTaxType = (raw) => {
  if (!raw || typeof raw !== "object") return "unknown";
  const explicit = pick(raw, ["taxType", "taxationType", "corpType", "vatType"]);
  const haystack = `${explicit} ${Object.values(raw).map((value) => (typeof value === "string" ? value : "")).join(" ")}`;
  if (haystack.includes("면세")) return "면세";
  if (haystack.includes("과세") || haystack.includes("일반과세") || haystack.includes("간이과세")) return "과세";
  return "unknown";
};

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

const existingConnectionPayload = (corpNum, popbillUserId, corpInfo, contactInfo) => ({
  corp_num: corpNum,
  popbill_user_id: text(popbillUserId, 50),
  corp_name: text(corpInfo?.corpName),
  ceo_name: text(corpInfo?.ceoname, 100),
  address: text(corpInfo?.addr, 300),
  biz_type: text(corpInfo?.bizType, 100),
  biz_class: text(corpInfo?.bizClass, 100),
  contact_name: text(contactInfo?.personName, 100),
  contact_email: text(contactInfo?.email, 100),
  contact_phone: text(contactInfo?.tel, 20),
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

    // 사업자상태조회·기업정보조회는 Vercel 무료 플랜 함수 수 제한 때문에 별도 라우트 대신 이 파일의 모드로 합쳤다.
    if (body.mode === "status" || body.mode === "lookup") {
      const checkCorpNum = digits(body.businessNumber);
      if (checkCorpNum.length !== 10) {
        response.status(400).json({ ok: false, checked: false, found: false, message: "사업자등록번호 10자리를 확인해 주세요." });
        return;
      }
      const memberCorpNum = await resolveMemberCorpNum(auth.admin, auth.user.id);
      if (!memberCorpNum) {
        response.status(503).json({ ok: false, checked: false, found: false, configured: false, message: "조회에 사용할 팝빌 회원 정보가 아직 준비되지 않았습니다." });
        return;
      }

      if (body.mode === "status") {
        const popbill = getClosedownService();
        if (!popbill.service) {
          response.status(503).json({ ok: false, checked: false, configured: false, missing: popbill.missing, message: "팝빌 사업자 상태조회 서버가 아직 준비되지 않았습니다." });
          return;
        }
        const lookup = await callPopbill(popbill.service, "checkCorpNum", [memberCorpNum, checkCorpNum, ""]);
        if (!lookup.ok) {
          response.status(200).json({ ok: false, checked: false, active: null, message: String(lookup.error?.message || lookup.error?.code || "사업자 상태를 확인하지 못했습니다.") });
          return;
        }
        const parsed = interpretState(lookup.result);
        response.status(200).json({ ok: true, checked: true, active: parsed.active, message: parsed.message, raw: lookup.result });
        return;
      }

      const popbill = getBizInfoCheckService();
      if (!popbill.service) {
        response.status(503).json({ ok: false, found: false, configured: false, missing: popbill.missing, message: "팝빌 기업정보조회 서버가 아직 준비되지 않았습니다." });
        return;
      }
      const lookup = await callPopbill(popbill.service, "checkBizInfo", [memberCorpNum, checkCorpNum, ""]);
      if (!lookup.ok) {
        response.status(200).json({ ok: false, found: false, message: String(lookup.error?.message || lookup.error?.code || "기업정보를 조회하지 못했습니다.") });
        return;
      }
      const raw = lookup.result || {};
      const corpName = pick(raw, ["corpName", "companyName", "corpNm"]);
      const ceoName = pick(raw, ["ceoName", "ceoname", "repName", "representativeName"]);
      const address = pick(raw, ["addr", "address", "corpAddr"]);
      const taxType = detectTaxType(raw);
      const found = Boolean(corpName || ceoName || address);
      response.status(200).json({
        ok: true,
        found,
        corpName: corpName || undefined,
        ceoName: ceoName || undefined,
        address: address || undefined,
        taxType,
        message: found ? "기업정보를 불러왔습니다." : "일치하는 기업정보를 찾지 못했습니다.",
        raw
      });
      return;
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

    if (body.mode === "connect-existing") {
      if (!isMember) {
        response.status(404).json({ ok: false, configured: false, message: "팝빌 가입 정보를 찾지 못했습니다. 신규 가입으로 진행해 주세요." });
        return;
      }
      const popbillUserId = text(profile.popbillUserId, 50);
      if (!/^[A-Za-z0-9._-]{6,50}$/.test(popbillUserId)) {
        response.status(400).json({ ok: false, configured: false, message: "팝빌 아이디를 확인해 주세요." });
        return;
      }

      const contact = await callPopbill(popbill.service, "getContactInfo", [corpNum, popbillUserId, ""]);
      if (!contact.ok) {
        response.status(403).json({ ok: false, configured: false, message: String(contact.error?.message || contact.error?.code || "팝빌 담당자 정보를 확인하지 못했습니다.") });
        return;
      }
      const loginEmail = text(auth.user.email, 100).toLowerCase();
      const contactEmail = text(contact.result?.email, 100).toLowerCase();
      if (!loginEmail || !contactEmail || loginEmail !== contactEmail) {
        response.status(403).json({
          ok: false,
          configured: false,
          message: "팝빌 담당자 이메일과 현재 블링빌 로그인 이메일이 일치하지 않습니다. 팝빌 담당자 이메일을 확인해 주세요."
        });
        return;
      }
      if (Number(contact.result?.state) !== 1) {
        response.status(403).json({ ok: false, configured: false, message: "사용 중인 팝빌 담당자 계정만 연결할 수 있습니다." });
        return;
      }

      const corp = await callPopbill(popbill.service, "getCorpInfo", [corpNum, popbillUserId]);
      if (!corp.ok) {
        response.status(403).json({ ok: false, configured: false, message: String(corp.error?.message || corp.error?.code || "팝빌 회사정보를 확인하지 못했습니다.") });
        return;
      }
      const connection = existingConnectionPayload(corpNum, popbillUserId, corp.result, contact.result);
      await saveUserConnection(auth.admin, auth.user.id, connection);
      response.status(200).json({
        ok: true,
        configured: true,
        connection,
        environment: popbill.environment,
        message: "기존 팝빌 회원 연결이 완료되었습니다. 이제 승인된 견적을 자동 발행할 수 있습니다."
      });
      return;
    }

    if (body.mode !== "join") {
      if (isMember) {
        response.status(200).json({
          ok: true,
          configured: false,
          existingMember: true,
          needsExistingConnection: true,
          message: "이미 팝빌 회원인 사업자입니다. 팝빌 아이디로 본인 확인 후 바로 연결할 수 있습니다."
        });
        return;
      }
      response.status(200).json({ ok: true, configured: false, needsSignup: true, message: "기본 정보만 입력하면 팝빌 가입과 자동발행 연결이 한 번에 완료됩니다." });
      return;
    }

    if (isMember) {
      response.status(409).json({ ok: false, configured: false, existingMember: true, needsExistingConnection: true, message: "이미 가입된 사업자입니다. 기존 팝빌 회원 연결을 이용해 주세요." });
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
