import popbill from "popbill";
import { authorizeRequest, getUserConnection } from "../../server/popbill/auth.js";

const LINK_ID = process.env.POPBILL_LINK_ID;
const SECRET_KEY = process.env.POPBILL_SECRET_KEY;
const IS_TEST = process.env.POPBILL_IS_TEST !== "false"; // default sandbox

const onlyDigits = (value) => String(value ?? "").replace(/\D/g, "");
const hasCredentials = Boolean(LINK_ID && SECRET_KEY);

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
  const auth = await authorizeRequest(request, response);
  if (!auth) return;

  try {
    const connection = await getUserConnection(auth.client, auth.user.id);
    if (!connection) {
      response.status(409).json({ ok: false, invoiceStatus: "pending", message: "설정에서 팝빌 자동발행을 먼저 연결해 주세요." });
      return;
    }
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
      customer = {},
      taxInvoiceMemo,
      paymentAccount
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
    if (Number(total) !== Number(supplyCost) + Number(tax)) {
      response.status(400).json({ ok: false, message: "공급가와 부가세 합계가 일치하지 않습니다." });
      return;
    }
    const writeDateDigits = String(writeDate || "").replace(/-/g, "");
    if (!/^\d{8}$/.test(writeDateDigits)) {
      response.status(400).json({ ok: false, message: "발행일은 YYYY-MM-DD 형식이어야 합니다." });
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
    const supplierCorpNum = onlyDigits(connection.corp_num);
    // A stable key makes retries idempotent at Popbill as well as in the browser.
    const invoicerMgtKey = String(quoteId).replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 24);
    const safeAccount = paymentAccount && {
      bankName: String(paymentAccount.bankName || "").replace(/[\r\n]/g, " ").trim(),
      accountNumber: String(paymentAccount.accountNumber || "").replace(/[\r\n]/g, " ").trim(),
      accountHolder: String(paymentAccount.accountHolder || "").replace(/[\r\n]/g, " ").trim()
    };
    const accountRemark = safeAccount?.bankName && safeAccount.accountNumber && safeAccount.accountHolder
      ? `입금계좌: ${safeAccount.bankName} ${safeAccount.accountNumber} (예금주 ${safeAccount.accountHolder})`.slice(0, 150)
      : "";
    const manualRemark = String(taxInvoiceMemo || "").replace(/[\r\n]+/g, " ").trim().slice(0, 150);

    const taxinvoice = {
      writeDate: writeDateDigits,
      chargeDirection: "정과금",
      issueType: "정발행",
      purposeType: "청구",
      taxType: "과세",
      invoicerCorpNum: supplierCorpNum,
      invoicerCorpName: connection.corp_name || "",
      invoicerCEOName: connection.ceo_name || "",
      invoicerMgtKey,
      invoiceeType: "사업자",
      invoiceeCorpNum: customerCorpNum,
      invoiceeCorpName: customer.name || "",
      invoiceeCEOName: customer.ceoName || customer.name || "",
      invoiceeAddr: customer.address || "",
      invoiceeContactName1: customer.contactName || "",
      invoiceeEmail1: customer.email || "",
      supplyCostTotal: String(supplyCost),
      taxTotal: String(tax),
      totalAmount: String(total),
      ...(accountRemark ? { remark1: accountRemark } : {}),
      ...(manualRemark ? { remark2: manualRemark } : {}),
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
        connection.popbill_user_id || "", // UserID
        (issueResult) => resolve({ ok: true, issueResult }),
        (error) => resolve({ ok: false, error })
      );
    });

    if (result.ok) {
      const ntsConfirmNum = result.issueResult && (result.issueResult.ntsconfirmNum || result.issueResult.ntsConfirmNum);
      response.status(200).json({
        ok: true,
        mode: "popbill",
        invoiceStatus: "issued",
        popbillInvoiceId: invoicerMgtKey,
        popbillNtsConfirmNum: ntsConfirmNum || undefined,
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
      popbillInvoiceId: invoicerMgtKey,
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
