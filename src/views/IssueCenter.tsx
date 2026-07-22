import { useState } from "react";
import { Download, Mail, RefreshCw, Search, Send, X } from "lucide-react";
import type { Customer, QuoteRecord, WorkspaceProfile } from "../types";
import { money } from "../lib/format";
import { quoteSubtotal, quoteTotal, quoteVat } from "../lib/quote-calc";
import { SectionTitle } from "../components/SectionTitle";
import { Status } from "../components/Status";
import { QuotePreview } from "./QuotePreview";
import { today } from "../lib/date";
import { statusLabels } from "../constants";
import { TextArea } from "../components/TextArea";

const invoiceStatusLabels = {
  pending: "발행 대기",
  issued: "발행 완료",
  sent: "전송 완료",
  failed: "발행 실패"
} as const;

type InvoiceStatus = keyof typeof invoiceStatusLabels;

const cashReceiptLabels = {
  pending: "발행 대기",
  issued: "발행 완료",
  failed: "발행 실패"
} as const;

export function IssueCenter({
  quote,
  quotes,
  customers,
  onSelectQuote,
  onClose,
  onApprove,
  onChangeQuote,
  onCustomerUpdate,
  onRefreshStatus,
  onSendDocuments,
  onExportCsv,
  isApproving,
  logo,
  workspaceProfile
}: {
  quote?: QuoteRecord;
  quotes: QuoteRecord[];
  customers: Customer[];
  onSelectQuote: (id: string) => void;
  onClose: () => void;
  onApprove: (quote: QuoteRecord) => void;
  onChangeQuote: (quote: QuoteRecord) => void;
  onCustomerUpdate: (customer: Customer) => void;
  onRefreshStatus: (quote: QuoteRecord) => void;
  onSendDocuments: (quote: QuoteRecord) => void;
  onExportCsv: (quote: QuoteRecord) => void;
  isApproving: boolean;
  logo?: string;
  workspaceProfile: WorkspaceProfile;
}) {
  const [query, setQuery] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceStatus | "all">("all");

  if (!quote) {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filteredQuotes = quotes.filter((item) => {
      const invoiceStatus = item.invoiceStatus ?? "pending";
      if (invoiceFilter !== "all" && invoiceStatus !== invoiceFilter) return false;
      const customer = item.customerSnapshot ?? customers.find((entry) => entry.id === item.customerId);
      const searchable = `${item.form.projectName} ${item.id} ${item.form.quoteDate} ${customer?.name ?? ""} ${customer?.businessNumber ?? ""}`.toLocaleLowerCase();
      return !normalizedQuery || searchable.includes(normalizedQuery);
    });

    return (
      <section className="issue-page issue-list-view">
        <div className="panel issue-list-panel">
          <div className="toolbar issue-list-head">
            <SectionTitle title="발행 대상 견적" hint="견적을 선택하면 고객 정보와 발행 옵션이 열립니다." />
            <div className="issue-list-tools">
              <div className="search">
                <Search size={17} />
                <input aria-label="발행 대상 검색" placeholder="프로젝트, 고객, 견적번호 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <select aria-label="발행 상태 필터" value={invoiceFilter} onChange={(event) => setInvoiceFilter(event.target.value as InvoiceStatus | "all")}>
                <option value="all">모든 발행 상태</option>
                {Object.entries(invoiceStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
          <div className="issue-list-meta">
            <span>{query || invoiceFilter !== "all" ? "조회 결과" : "전체 견적"}</span>
            <strong>{filteredQuotes.length}건</strong>
          </div>
          <div className="issue-quote-list">
            {filteredQuotes.map((item) => {
              const customer = item.customerSnapshot ?? customers.find((entry) => entry.id === item.customerId);
              const invoiceStatus = item.invoiceStatus ?? "pending";
              return (
                <button key={item.id} className="issue-quote-row" onClick={() => onSelectQuote(item.id)}>
                  <span className="issue-quote-main">
                    <strong>{item.form.projectName || "제목 없음"}</strong>
                    <small>{customer?.name ?? "고객 미선택"} · {item.form.quoteDate || "견적일 미입력"}</small>
                  </span>
                  <span className="issue-quote-amount"><small>합계</small><b>{money(quoteTotal(item))}원</b></span>
                  <span className="issue-quote-status"><small>승인</small><Status tone={item.status}>{statusLabels[item.status]}</Status></span>
                  <span className="issue-quote-status"><small>발행</small><Status tone={invoiceStatus}>{invoiceStatusLabels[invoiceStatus]}</Status></span>
                </button>
              );
            })}
            {!filteredQuotes.length && (
              <div className="issue-list-empty">
                <strong>{quotes.length ? "조건에 맞는 견적이 없습니다." : "저장된 견적이 없습니다."}</strong>
                <span>{quotes.length ? "검색어 또는 발행 상태를 변경해 주세요." : "견적을 저장하면 승인·발행 대상 목록에 표시됩니다."}</span>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  const customer = customers.find((item) => item.id === quote.customerId);
  const invoiceCustomer = quote.customerSnapshot ?? customer;
  const invoiceStatus = quote.invoiceStatus ?? "pending";
  const cashReceiptStatus = quote.cashReceiptStatus ?? "pending";
  const issuanceComplete = invoiceStatus === "issued" || invoiceStatus === "sent";

  return (
    <section className="issue-split issue-detail-view">
      <div className="panel issue-card">
        <div className="issue-detail-head">
          <div className="issue-detail-identity">
            <p>승인·발행 상세 · {quote.form.quoteDate || "견적일 미입력"}</p>
            <h2>{quote.form.projectName || "제목 없음"}</h2>
            <span>{invoiceCustomer?.name ?? "고객 미선택"} · {money(quoteTotal(quote))}원</span>
          </div>
          <div className="issue-detail-actions">
            <Status tone={invoiceStatus}>{invoiceStatusLabels[invoiceStatus]}</Status>
            <button className="ghost" onClick={onClose}><X size={16} /> 목록으로</button>
          </div>
        </div>

        <dl className="details issue-details">
          <dt>고객</dt><dd>{invoiceCustomer?.name ?? "고객 미선택"}</dd>
          <dt>사업자번호</dt><dd>{invoiceCustomer?.businessNumber ?? "-"}</dd>
          <dt>프로젝트</dt><dd>{quote.form.projectName || "-"}</dd>
          <dt>공급가/VAT/합계</dt><dd>{money(quoteSubtotal(quote))}원 / {money(quoteVat(quote))}원 / {money(quoteTotal(quote))}원</dd>
          <dt>승인 상태</dt><dd><Status tone={quote.status}>{quote.status === "approved" ? "승인" : "미승인"}</Status></dd>
          <dt>발행 방식</dt><dd>{quote.invoiceType.issueInvoice ? (quote.invoiceIssuanceMode === "auto" ? "세금계산서 자동 발행" : "세금계산서 수동 발행") : "세금계산서 발행 안 함"}</dd>
          <dt>발행 상태</dt><dd><Status tone={invoiceStatus}>{invoiceStatusLabels[invoiceStatus]}</Status></dd>
          <dt>팝빌 관리번호</dt><dd>{quote.popbillInvoiceId ?? "-"}</dd>
          <dt>국세청 승인번호</dt><dd>{quote.popbillNtsConfirmNum ?? "-"}</dd>
          {quote.invoiceType.issueCashReceipt && (
            <>
              <dt>현금영수증</dt>
              <dd><Status tone={cashReceiptStatus}>{cashReceiptLabels[cashReceiptStatus]}</Status>{quote.popbillCashbillId ? ` · ${quote.popbillCashbillId}` : ""}</dd>
            </>
          )}
          <dt>문서 이메일</dt><dd><Status tone={quote.documentEmailStatus ?? "pending"}>{quote.documentEmailStatus === "sent" ? "발송 완료" : quote.documentEmailStatus === "failed" ? "발송 실패" : quote.documentEmailStatus === "sending" ? "발송 중" : "발송 전"}</Status>{quote.documentEmailRecipient ? ` · ${quote.documentEmailRecipient}` : ""}</dd>
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

        <div className="document-memo-grid issue-memo-grid">
          <TextArea label="거래명세서 비고" value={quote.transactionStatementMemo ?? ""} maxLength={150} placeholder="거래명세서에 표시할 비고" onChange={(transactionStatementMemo) => onChangeQuote({ ...quote, transactionStatementMemo })} />
          <TextArea label="세금계산서 비고" value={quote.taxInvoiceMemo ?? ""} maxLength={150} disabled={issuanceComplete} placeholder="세금계산서 비고란에 표시할 내용" onChange={(taxInvoiceMemo) => onChangeQuote({ ...quote, taxInvoiceMemo })} />
        </div>
        {issuanceComplete && <p className="field-help">세금계산서 비고는 발행 완료 후 변경할 수 없습니다. 거래명세서 비고는 수정 후 문서를 다시 발송할 수 있습니다.</p>}

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
        {quote.invoiceType.issueCashReceipt && quote.cashReceiptNote && <div className={cashReceiptStatus === "failed" ? "alert danger-alert" : "notice"}>{quote.cashReceiptNote}</div>}
        {quote.documentEmailNote && <div className={quote.documentEmailStatus === "failed" ? "alert danger-alert" : "notice"}>{quote.documentEmailNote}</div>}
        {issuanceComplete && <div className="notice">발행 완료된 건은 중복 발행을 막기 위해 옵션이 잠겨 있습니다.</div>}
        {quote.invoiceIssuanceMode === "auto" && quote.invoiceType.issueInvoice && invoiceStatus === "pending" && (
          <div className="notice">팝빌 인증정보가 확인되기 전에는 실제 발행 완료로 처리되지 않습니다.</div>
        )}

        <div className="actions">
          <button disabled={issuanceComplete || isApproving || !customer || quoteTotal(quote) < 1} onClick={() => onApprove(quote)}>
            <Send size={17} /> {issuanceComplete ? "발행 완료" : isApproving ? "처리 중" : quote.status === "approved" ? "발행 다시 시도" : "승인 및 발행"}
          </button>
          <button className="ghost" onClick={() => onExportCsv(quote)}><Download size={17} /> 이 견적 CSV</button>
          <button className="ghost" disabled={isApproving || !invoiceCustomer?.email} onClick={() => onSendDocuments(quote)}><Mail size={17} /> 문서 이메일 {quote.documentEmailStatus === "sent" ? "재전송" : "발송"}</button>
          <button className="ghost" disabled={!quote.popbillInvoiceId || isApproving} onClick={() => onRefreshStatus(quote)}><RefreshCw size={17} /> 발행 상태 조회</button>
        </div>
      </div>

      <QuotePreview quote={quote} customer={customer} logo={logo} workspaceProfile={workspaceProfile} />
    </section>
  );
}
