import type { CustomerSnapshot, QuoteRecord } from "../types";
import { authorizedFetch } from "./authorized-fetch";
import { blobToBase64, elementToPdfBlob, sanitizeFilename } from "./pdf-document";

export type DocumentEmailResult = {
  ok: boolean;
  emailId?: string;
  recipient?: string;
  message: string;
};

async function waitForDocument(selector: string, timeout = 2500): Promise<HTMLElement | null> {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeout) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) return element;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return null;
}

export async function sendQuoteDocuments(
  quote: QuoteRecord,
  customer: CustomerSnapshot,
  billingReferences?: Partial<Record<"quote_pdf" | "transaction_statement" | "email", string>>
): Promise<DocumentEmailResult> {
  const recipient = customer.email?.trim();
  if (!recipient) return { ok: false, message: "고객 이메일이 없어 문서를 자동 발송하지 못했습니다." };

  const [quoteElement, statementElement] = await Promise.all([
    waitForDocument(".document-render-stage [data-email-document='quote'] .qp-paper"),
    waitForDocument(".document-render-stage [data-email-document='statement']")
  ]);
  if (!quoteElement || !statementElement) return { ok: false, message: "발송할 문서 화면을 준비하지 못했습니다." };

  const [quoteBlob, statementBlob] = await Promise.all([
    elementToPdfBlob(quoteElement),
    elementToPdfBlob(statementElement)
  ]);
  const projectName = sanitizeFilename(quote.form.projectName || "견적");
  const quoteDate = quote.form.quoteDate || new Date().toISOString().slice(0, 10);
  const attachments = await Promise.all([
    blobToBase64(quoteBlob).then((content) => ({ filename: `견적서_${projectName}_${quoteDate}.pdf`, content })),
    blobToBase64(statementBlob).then((content) => ({ filename: `거래명세서_${projectName}_${quoteDate}.pdf`, content }))
  ]);

  const response = await authorizedFetch("/api/email/send-documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteId: quote.id,
      recipient,
      projectName: quote.form.projectName,
      customerName: customer.name,
      billingReferences,
      attachments
    })
  });
  const result = await response.json() as Partial<DocumentEmailResult>;
  return {
    ok: response.ok && Boolean(result.ok),
    emailId: result.emailId,
    recipient: result.recipient || recipient,
    message: result.message || `문서 이메일 발송에 실패했습니다. (HTTP ${response.status})`
  };
}
