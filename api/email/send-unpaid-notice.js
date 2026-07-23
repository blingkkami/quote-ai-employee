import { authorizeRequest } from "../../server/popbill/auth.js";
import { requireEmailAdmin, sendConnectedEmail } from "../../server/email/service.js";
import { authorizeBillingActions, requiredBillingReference, reverseBillingActions } from "../../server/billing/service.js";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");
const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const amount = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const won = (value) => Math.round(value).toLocaleString("ko-KR");

export default async function handler(request, response) {
  response.setHeader?.("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }

  const auth = await authorizeRequest(request, response);
  if (!auth) return;
  let billingApproval;

  try {
    let body = request.body || {};
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const customerId = String(body.customerId || "").trim();
    if (!customerId) {
      response.status(400).json({ ok: false, message: "고객을 선택해 주세요." });
      return;
    }

    const { data: appRow, error: appError } = await auth.client
      .from("app_data")
      .select("data")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (appError || !appRow?.data) {
      response.status(409).json({ ok: false, message: "계정 데이터를 확인하지 못했습니다. 저장 후 다시 시도해 주세요." });
      return;
    }

    const appData = appRow.data;
    const customer = Array.isArray(appData.customers) ? appData.customers.find((item) => item.id === customerId) : null;
    const recipient = normalizeEmail(customer?.email);
    if (!customer || !validEmail(recipient)) {
      response.status(409).json({ ok: false, message: "선택한 고객의 이메일 주소를 먼저 등록해 주세요." });
      return;
    }

    const quotes = new Map((Array.isArray(appData.quotes) ? appData.quotes : []).map((quote) => [quote.id, quote]));
    const rows = (Array.isArray(appData.sales) ? appData.sales : [])
      .filter((sale) => sale.customerId === customerId)
      .map((sale) => {
        const saleAmount = amount(sale.amount);
        const paidAmount = Math.min(saleAmount, amount(sale.paidAmount));
        const balance = Math.max(0, saleAmount - paidAmount);
        const quote = quotes.get(sale.quoteId);
        return {
          date: String(quote?.approvedAt || quote?.form?.quoteDate || sale.createdAt || "").slice(0, 10),
          projectName: String(quote?.form?.projectName || "거래").trim(),
          saleAmount,
          paidAmount,
          balance
        };
      })
      .filter((row) => row.balance > 0);
    const totalAmount = rows.reduce((sum, row) => sum + row.balance, 0);
    if (!rows.length || totalAmount <= 0) {
      response.status(409).json({ ok: false, message: "발송할 미수금 내역이 없습니다." });
      return;
    }

    const profile = appData.workspaceProfile || {};
    const account = profile.paymentAccount || {};
    if (!account.showOnUnpaidNotices || !account.bankName || !account.accountNumber || !account.accountHolder) {
      response.status(409).json({ ok: false, message: "설정에서 미수금 안내용 입금계좌를 등록하고 표시를 켜 주세요." });
      return;
    }
    billingApproval = await authorizeBillingActions(auth.client, [{
      feature: "unpaid_notice",
      referenceId: requiredBillingReference(body.billingReference, "미수금 안내")
    }]);
    if (!billingApproval.ok) {
      response.status(402).json({ ok: false, message: billingApproval.message });
      return;
    }

    const supplierName = String(profile.businessName || appData.taxApiIntegration?.corpName || "공급자").trim();
    const tableRows = rows.map((row) => `<tr><td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeHtml(row.date || "-")}</td><td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeHtml(row.projectName)}</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right">${won(row.saleAmount)}원</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right">${won(row.paidAmount)}원</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:#b42318">${won(row.balance)}원</td></tr>`).join("");
    const delivery = await sendConnectedEmail(requireEmailAdmin(auth), auth.user.id, {
      to: recipient,
      subject: `[${supplierName}] 미수금 ${won(totalAmount)}원 안내`,
      html: `<div style="font-family:Arial,'Apple SD Gothic Neo',sans-serif;color:#1f2937;line-height:1.65"><p>${escapeHtml(customer.name)} 담당자님, 안녕하세요.</p><p>아래 미수금 내역과 입금계좌를 안내드립니다.</p><table style="width:100%;border-collapse:collapse;margin:20px 0"><thead><tr style="background:#f3f4f6"><th style="padding:10px;text-align:left">일자</th><th style="padding:10px;text-align:left">거래</th><th style="padding:10px;text-align:right">거래액</th><th style="padding:10px;text-align:right">수금액</th><th style="padding:10px;text-align:right">미수금</th></tr></thead><tbody>${tableRows}</tbody></table><p style="padding:16px;background:#f8fafc;border:1px solid #e5e7eb"><strong>총 미수금: ${won(totalAmount)}원</strong><br>입금계좌: ${escapeHtml(account.bankName)} ${escapeHtml(account.accountNumber)} (예금주 ${escapeHtml(account.accountHolder)})</p><p style="margin-top:28px;color:#64748b">${escapeHtml(supplierName)} 드림</p></div>`,
      attachments: []
    });
    response.status(200).json({
      ok: true,
      emailId: delivery.emailId,
      provider: delivery.provider,
      sender: delivery.sender,
      recipient,
      totalAmount,
      message: `${delivery.sender}에서 ${recipient}로 미수금 안내를 발송했습니다.`
    });
  } catch (error) {
    if (billingApproval?.approved) await reverseBillingActions(auth.client, billingApproval.approved);
    response.status(500).json({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
}
