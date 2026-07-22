import type { CustomerSnapshot, QuoteRecord, TaxApiIntegration, WorkspaceProfile } from "../types";
import { koreanDate } from "../lib/date";
import { money } from "../lib/format";
import { quoteSubtotal, quoteTotal, quoteVat } from "../lib/quote-calc";
import { hasPaymentAccount, paymentAccountText } from "../lib/payment-account";

export function TransactionStatementPreview({ quote, customer, supplier, workspaceProfile, logo }: { quote: QuoteRecord; customer?: CustomerSnapshot; supplier: TaxApiIntegration; workspaceProfile: WorkspaceProfile; logo?: string }) {
  const supply = quoteSubtotal(quote);
  const vat = quoteVat(quote);
  const total = quoteTotal(quote);
  const taxExempt = quote.customerSnapshot?.taxExempt === true;
  const showPaymentAccount = workspaceProfile.paymentAccount.showOnDocuments && hasPaymentAccount(workspaceProfile);
  const statementMemo = quote.transactionStatementMemo?.trim() || "";
  const minimumItemRows = statementMemo ? 5 : showPaymentAccount || workspaceProfile.stampDataUrl ? 6 : 8;

  return (
    <div className="ts-paper" data-email-document="statement">
      <header className="ts-header">
        {logo && <img className="ts-logo" src={logo} alt="로고" />}
        <p>TRANSACTION STATEMENT</p>
        <h1>거래명세서</h1>
        <strong>{koreanDate(quote.invoiceDate || quote.form.quoteDate)}</strong>
      </header>

      <section className="ts-parties">
        <div>
          <span>공급받는 자</span>
          <dl>
            <dt>상호</dt><dd>{customer?.name || "-"}</dd>
            <dt>사업자번호</dt><dd>{customer?.businessNumber || "-"}</dd>
            <dt>대표자</dt><dd>{customer?.representativeName || "-"}</dd>
            <dt>주소</dt><dd>{customer?.address || "-"}</dd>
            <dt>담당자</dt><dd>{customer?.contactPerson || "-"}</dd>
          </dl>
        </div>
        <div>
          <span>공급자</span>
          <dl>
            <dt>상호</dt><dd>{supplier.corpName || quote.form.issuerName || "-"}</dd>
            <dt>사업자번호</dt><dd>{supplier.businessNumber || "-"}</dd>
            <dt>대표자</dt><dd>{supplier.ceoName || "-"}</dd>
            <dt>주소</dt><dd>{supplier.address || "-"}</dd>
            <dt>담당자</dt><dd>{supplier.contactName || quote.form.issuerName || "-"}</dd>
          </dl>
        </div>
      </section>

      <section className="ts-project">
        <span>거래명</span><strong>{quote.form.projectName || "-"}</strong>
      </section>

      <table className="ts-items">
        <thead><tr><th>번호</th><th>항목</th><th>내용</th><th>공급가액</th><th>세액</th></tr></thead>
        <tbody>
          {quote.items.map((item, index) => (
            <tr key={item.id}>
              <td>{index + 1}</td>
              <td>{item.category || "-"}</td>
              <td>{item.description || "-"}</td>
              <td>{money(item.price)}원</td>
              <td>{money(taxExempt ? 0 : Math.round(item.price * 0.1))}원</td>
            </tr>
          ))}
          {Array.from({ length: Math.max(0, minimumItemRows - quote.items.length) }, (_, index) => (
            <tr className="empty" key={`empty-${index}`}><td>{quote.items.length + index + 1}</td><td /><td /><td /><td /></tr>
          ))}
        </tbody>
      </table>

      <section className="ts-totals">
        <div><span>공급가액</span><strong>{money(supply)}원</strong></div>
        <div><span>부가세</span><strong>{money(vat)}원</strong></div>
        <div className="grand"><span>합계금액</span><strong>{money(total)}원</strong></div>
      </section>

      {showPaymentAccount && <section className="ts-payment-account"><span>입금계좌</span><strong>{paymentAccountText(workspaceProfile)}</strong></section>}
      {statementMemo && <section className="ts-manual-memo"><span>비고</span><strong>{statementMemo}</strong></section>}

      <footer className="ts-footer">
        <p>위와 같이 거래하였음을 확인합니다.</p>
        <div><strong>{supplier.corpName || quote.form.issuerName || "공급자"}</strong>{workspaceProfile.stampDataUrl && <img className="ts-stamp" src={workspaceProfile.stampDataUrl} alt="도장" />}</div>
      </footer>
    </div>
  );
}
