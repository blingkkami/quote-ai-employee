import { Download, RefreshCw, Send } from "lucide-react";
import type { Customer, QuoteRecord } from "../types";
import { money } from "../lib/format";
import { quoteSubtotal, quoteTotal, quoteVat } from "../lib/quote-calc";
import { SectionTitle } from "../components/SectionTitle";
import { Status } from "../components/Status";
import { today } from "../lib/date";

const invoiceStatusLabels = {
  pending: "발행 대기",
  issued: "발행 완료",
  sent: "전송 완료",
  failed: "발행 실패"
} as const;

export function IssueCenter({
  quote,
  quotes,
  customers,
  onSelectQuote,
  onApprove,
  onChangeQuote,
  onCustomerUpdate,
  onRefreshStatus,
  onExportCsv,
  isApproving
}: {
  quote: QuoteRecord;
  quotes: QuoteRecord[];
  customers: Customer[];
  onSelectQuote: (id: string) => void;
  onApprove: (quote: QuoteRecord) => void;
  onChangeQuote: (quote: QuoteRecord) => void;
  onCustomerUpdate: (customer: Customer) => void;
  onRefreshStatus: (quote: QuoteRecord) => void;
  onExportCsv: (quote: QuoteRecord) => void;
  isApproving: boolean;
}) {
  const customer = customers.find((item) => item.id === quote.customerId);
  const invoiceCustomer = quote.customerSnapshot ?? customer;
  const invoiceStatus = quote.invoiceStatus ?? "pending";
  const issuanceComplete = invoiceStatus === "issued" || invoiceStatus === "sent";
  return (
    <section className="issue-page">
      <div className="panel issue-card">
        <SectionTitle title="발행 대상 선택" hint="견적을 선택한 뒤 고객 정보와 금액을 확인하고 승인·발행하세요." />
        <label>
          발행할 견적
          <select value={quotes.some((item) => item.id === quote.id) ? quote.id : ""} onChange={(event) => onSelectQuote(event.target.value)}>
            <option value="">견적을 선택하세요</option>
            {quotes.map((item) => (
              <option key={item.id} value={item.id}>{item.form.projectName || "제목 없음"} · {money(quoteTotal(item))}원</option>
            ))}
          </select>
        </label>

        <dl className="details">
          <dt>고객</dt><dd>{invoiceCustomer?.name ?? "고객 미선택"}</dd>
          <dt>사업자번호</dt><dd>{invoiceCustomer?.businessNumber ?? "-"}</dd>
          <dt>프로젝트</dt><dd>{quote.form.projectName || "-"}</dd>
          <dt>공급가/VAT/합계</dt><dd>{money(quoteSubtotal(quote))}원 / {money(quoteVat(quote))}원 / {money(quoteTotal(quote))}원</dd>
          <dt>승인 상태</dt><dd><Status tone={quote.status}>{quote.status === "approved" ? "승인" : "미승인"}</Status></dd>
          <dt>발행 방식</dt><dd>{quote.invoiceType.issueInvoice ? (quote.invoiceIssuanceMode === "auto" ? "세금계산서 자동 발행" : "세금계산서 수동 발행") : "세금계산서 발행 안 함"}</dd>
          <dt>발행 상태</dt><dd><Status tone={invoiceStatus}>{invoiceStatusLabels[invoiceStatus]}</Status></dd>
          <dt>팝빌 관리번호</dt><dd>{quote.popbillInvoiceId ?? "-"}</dd>
          <dt>국세청 승인번호</dt><dd>{quote.popbillNtsConfirmNum ?? "-"}</dd>
        </dl>

        <div className="issue-options">
          <label>
            발행일
            <input
              type="date"
              disabled={issuanceComplete}
              value={quote.invoiceDate || today()}
              onChange={(event) => onChangeQuote({ ...quote, invoiceDate: event.target.value })}
            />
          </label>
          <div>
            <span className="field-label">발행 방식</span>
            <div className="segmented">
              <button disabled={issuanceComplete} className={quote.invoiceIssuanceMode === "auto" ? "selected" : ""} onClick={() => onChangeQuote({ ...quote, invoiceIssuanceMode: "auto" })}>자동 발행</button>
              <button disabled={issuanceComplete} className={quote.invoiceIssuanceMode === "manual" ? "selected" : ""} onClick={() => onChangeQuote({ ...quote, invoiceIssuanceMode: "manual" })}>수동 발행</button>
            </div>
          </div>
          <label className="check">
            <input type="checkbox" disabled={issuanceComplete} checked={quote.invoiceType.issueInvoice} onChange={(event) => onChangeQuote({ ...quote, invoiceType: { ...quote.invoiceType, issueInvoice: event.target.checked } })} />
            세금계산서 발행
          </label>
          <label className="check">
            <input type="checkbox" disabled={issuanceComplete} checked={quote.invoiceType.issueCashReceipt} onChange={(event) => onChangeQuote({ ...quote, invoiceType: { ...quote.invoiceType, issueCashReceipt: event.target.checked } })} />
            현금영수증 발행
          </label>
        </div>

        {customer && (
          <button
            className="link preference-save"
            onClick={() => onCustomerUpdate({
              ...customer,
              invoicePreference: quote.invoiceType.issueCashReceipt
                ? "cash_receipt"
                : quote.invoiceIssuanceMode === "manual" ? "tax_invoice_manual" : "tax_invoice_auto",
              updatedAt: new Date().toISOString()
            })}
          >
            현재 발행 방식을 고객 기본값으로 저장
          </button>
        )}

        {quote.invoiceNote && <div className={invoiceStatus === "failed" ? "alert danger-alert" : "notice"}>{quote.invoiceNote}</div>}
        {issuanceComplete && <div className="notice">발행 완료된 건은 중복 발행을 막기 위해 옵션이 잠겨 있습니다.</div>}
        {quote.invoiceIssuanceMode === "auto" && quote.invoiceType.issueInvoice && invoiceStatus === "pending" && (
          <div className="notice">팝빌 인증정보가 확인되기 전에는 실제 발행 완료로 처리되지 않습니다.</div>
        )}

        <div className="actions">
          <button disabled={issuanceComplete || isApproving || !customer || quoteTotal(quote) < 1} onClick={() => onApprove(quote)}>
            <Send size={17} /> {issuanceComplete ? "발행 완료" : isApproving ? "처리 중" : quote.status === "approved" ? "발행 다시 시도" : "승인 및 발행"}
          </button>
          <button className="ghost" disabled={!quotes.some((item) => item.id === quote.id)} onClick={() => onExportCsv(quote)}><Download size={17} /> 이 견적 CSV</button>
          <button className="ghost" disabled={!quote.popbillInvoiceId || isApproving} onClick={() => onRefreshStatus(quote)}><RefreshCw size={17} /> 발행 상태 조회</button>
        </div>
      </div>
    </section>
  );
}
