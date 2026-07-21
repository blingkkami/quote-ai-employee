import { authorizeRequest } from "../../server/popbill/auth.js";
import { requireEmailAdmin, sendConnectedEmail } from "../../server/email/service.js";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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
    const quoteId = String(body.quoteId || "").trim();
    const recipient = normalizeEmail(body.recipient);
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    if (!quoteId || !validEmail(recipient)) {
      response.status(400).json({ ok: false, message: "견적 또는 고객 이메일을 확인해 주세요." });
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
    const quote = Array.isArray(appRow.data.quotes) ? appRow.data.quotes.find((item) => item.id === quoteId) : null;
    const customer = quote && Array.isArray(appRow.data.customers)
      ? appRow.data.customers.find((item) => item.id === quote.customerId)
      : null;
    const allowedRecipient = normalizeEmail(customer?.email || quote?.customerSnapshot?.email);
    if (!quote || !allowedRecipient || recipient !== allowedRecipient) {
      response.status(403).json({ ok: false, message: "이 견적에 저장된 고객 이메일로만 발송할 수 있습니다." });
      return;
    }

    if (attachments.length !== 2) {
      response.status(400).json({ ok: false, message: "견적서와 거래명세서 PDF가 모두 필요합니다." });
      return;
    }
    let totalBase64Length = 0;
    const safeAttachments = attachments.map((attachment, index) => {
      const content = String(attachment?.content || "").replace(/\s/g, "");
      const filename = String(attachment?.filename || "").replace(/[^0-9A-Za-z가-힣_.-]/g, "-").slice(0, 120);
      totalBase64Length += content.length;
      if (!filename.toLowerCase().endsWith(".pdf") || !content.startsWith("JVBERi0")) {
        throw new Error(`${index + 1}번째 PDF 파일이 올바르지 않습니다.`);
      }
      return { filename, content };
    });
    if (totalBase64Length > 12_000_000) {
      response.status(413).json({ ok: false, message: "첨부 문서 용량이 너무 큽니다." });
      return;
    }

    const projectName = String(body.projectName || quote.form?.projectName || "견적").trim();
    const customerName = String(body.customerName || customer?.name || quote.customerSnapshot?.name || "고객").trim();
    const supplierName = String(appRow.data.taxApiIntegration?.corpName || "공급자").trim();
    const delivery = await sendConnectedEmail(requireEmailAdmin(auth), auth.user.id, {
      to: recipient,
      subject: `[${supplierName}] ${projectName || "견적"} 견적서 및 거래명세서`,
      html: `<div style="font-family:Arial,'Apple SD Gothic Neo',sans-serif;color:#1f2937;line-height:1.7"><p>${escapeHtml(customerName)} 담당자님, 안녕하세요.</p><p><strong>${escapeHtml(projectName || "요청하신 건")}</strong>의 견적서와 거래명세서를 보내드립니다.</p><p>첨부된 PDF 문서 2개를 확인해 주세요.</p><p style="margin-top:28px;color:#64748b">${escapeHtml(supplierName)} 드림</p></div>`,
      attachments: safeAttachments
    });
    response.status(200).json({
      ok: true,
      emailId: delivery.emailId,
      provider: delivery.provider,
      sender: delivery.sender,
      recipient,
      message: `${delivery.sender}에서 ${recipient}로 견적서와 거래명세서를 발송했습니다.`
    });
  } catch (error) {
    response.status(500).json({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
}
