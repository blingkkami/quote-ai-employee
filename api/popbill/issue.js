import popbill from "popbill";

const LINK_ID = process.env.POPBILL_LINK_ID;
const SECRET_KEY = process.env.POPBILL_SECRET_KEY;
const CORP_NUM = process.env.POPBILL_CORP_NUM;
const CORP_NAME = process.env.POPBILL_CORP_NAME || "";
const CEO_NAME = process.env.POPBILL_CEO_NAME || "";
const USER_ID = process.env.POPBILL_USER_ID || "";
const IS_TEST = process.env.POPBILL_IS_TEST !== "false"; // default sandbox

const onlyDigits = (value) => String(value ?? "").replace(/\D/g, "");
const hasCredentials = Boolean(LINK_ID && SECRET_KEY && CORP_NUM);

// Configure the SDK once, guarded by credential presence.
let taxinvoiceService = null;
if (hasCredentials) {
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
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }

  try {
    let body = request.body || {};
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const {
      quoteId,
      projectName,
      writeDate,
      supplyCost,
      tax,
      total,
      items = [],
      customer = {}
    } = body;

    // Validation
    const customerCorpNum = onlyDigits(customer.businessNumber);
    if (!quoteId) {
      response.status(400).json({ ok: false, message: "quoteId가 필요합니다." });
      return;
    }
    if (customerCorpNum.length !== 10) {
      response.status(400).json({ ok: false, message: "고객 사업자번호는 10자리여야 합니다." });
      return;
    }
    if (!(Number(supplyCost) >= 0)) {
      response.status(400).json({ ok: false, message: "공급가가 올바르지 않습니다." });
      return;
    }
    if (!(Number(total) > 0)) {
      response.status(400).json({ ok: false, message: "합계 금액이 올바르지 않습니다." });
      return;
    }

    // Never report a successful issue when server credentials are missing.
    if (!hasCredentials) {
      response.status(503).json({
        ok: false,
        mode: "not_configured",
        invoiceStatus: "pending",
        message: "팝빌 서버 인증정보가 없어 실제 발행하지 않았습니다. Vercel 환경변수를 등록한 뒤 다시 시도해 주세요.",
        quoteId: body.quoteId
      });
      return;
    }

    // Real issuance via Popbill SDK.
    const supplierCorpNum = onlyDigits(CORP_NUM);
    const writeDateDigits = String(writeDate || "").replace(/-/g, "");
    const invoicerMgtKey = `${quoteId}-${Date.now().toString(36)}`.slice(0, 24);

    const taxinvoice = {
      writeDate: writeDateDigits,
      chargeDirection: "정과금",
      issueType: "정발행",
      purposeType: "영수",
      taxType: "과세",
      invoicerCorpNum: supplierCorpNum,
      invoicerCorpName: CORP_NAME,
      invoicerCEOName: CEO_NAME,
      invoicerMgtKey,
      invoiceeType: "사업자",
      invoiceeCorpNum: customerCorpNum,
      invoiceeCorpName: customer.name || "",
      invoiceeCEOName: customer.ceoName || customer.name || "",
      invoiceeEmail1: customer.email || "",
      supplyCostTotal: String(supplyCost),
      taxTotal: String(tax),
      totalAmount: String(total),
      detailList: (Array.isArray(items) ? items : []).map((item, i) => ({
        serialNum: i + 1,
        itemName: item.name,
        supplyCost: String(item.supplyCost),
        tax: String(item.tax)
      }))
    };

    const result = await new Promise((resolve) => {
      // Installed popbill@1.64.2 base signature:
      // registIssue(CorpNum, Taxinvoice, writeSpecification, forceIssue, memo,
      //             emailSubject, dealInvoiceMgtKey, UserID, success, error)
      taxinvoiceService.registIssue(
        supplierCorpNum,
        taxinvoice,
        false, // writeSpecification
        false, // forceIssue
        `견적 ${projectName || quoteId} 세금계산서`, // memo
        "", // emailSubject
        "", // dealInvoiceMgtKey
        USER_ID, // UserID
        (issueResult) => resolve({ ok: true, issueResult }),
        (error) => resolve({ ok: false, error })
      );
    });

    if (result.ok) {
      const ntsConfirmNum = result.issueResult && result.issueResult.ntsConfirmNum;
      response.status(200).json({
        ok: true,
        mode: "popbill",
        invoiceStatus: "issued",
        popbillInvoiceId: ntsConfirmNum || invoicerMgtKey,
        quoteId
      });
      return;
    }

    const err = result.error || {};
    const message = err.message || err.code || "세금계산서 발행에 실패했습니다.";
    response.status(200).json({
      ok: false,
      mode: "popbill",
      invoiceStatus: "failed",
      message: String(message),
      quoteId
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      invoiceStatus: "failed",
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
