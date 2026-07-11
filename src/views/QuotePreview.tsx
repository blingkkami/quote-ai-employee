import type { Customer, QuoteRecord } from "../types";
import { exampleQuoteForm, exampleQuoteItems } from "../data/quote-defaults";
import { money } from "../lib/format";
import { quoteSubtotal, quoteTotal, quoteVat } from "../lib/quote-calc";

export function QuotePreview({ quote, customer }: { quote: QuoteRecord; customer?: Customer }) {
  const empty = Object.values(quote.form).every((value) => !String(value).trim()) && quote.items.every((item) => !item.category && !item.description && !item.price);
  const previewQuote = empty ? { ...quote, form: exampleQuoteForm, items: exampleQuoteItems } : quote;
  const previewCustomerName = customer?.name ?? (empty ? "루미너스 에센스" : "고객 미선택");
  return (
    <div className="preview-wrap">
      <div className="quote-paper">
        <div className="paper-head">
          <div>
            <p>Quotation</p>
            <h2>{empty ? "예시 견적서" : previewQuote.form.projectName || "프로젝트명 미입력"}</h2>
          </div>
          <span>블링까미</span>
        </div>
        <div className="paper-grid">
          <div>
            <b>공급자</b>
            <span>{previewQuote.form.issuerName || "-"}</span>
          </div>
          <div>
            <b>고객</b>
            <span>{previewCustomerName}</span>
          </div>
          <div>
            <b>견적일</b>
            <span>{previewQuote.form.quoteDate}</span>
          </div>
          <div>
            <b>유효기간</b>
            <span>{previewQuote.form.validDuration}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>구분</th>
              <th>내용</th>
              <th>금액</th>
            </tr>
          </thead>
          <tbody>
            {previewQuote.items.map((item) => (
              <tr key={item.id}>
                <td>{item.category || "-"}</td>
                <td>{item.description || "-"}</td>
                <td>{money(item.price)}원</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="totals">
          <span>공급가 {money(quoteSubtotal(previewQuote))}원</span>
          <span>VAT {money(quoteVat(previewQuote))}원</span>
          <strong>합계 {money(quoteTotal(previewQuote))}원</strong>
        </div>
        <div className="paper-note">
          <b>{previewQuote.form.finalCategory}</b>
          <p>{previewQuote.form.finalDescription}</p>
          <p>{previewQuote.form.notes}</p>
          <p>{previewQuote.form.message}</p>
        </div>
        <div className="paper-sign">
          <span>{previewQuote.form.signOffSender}</span>
          <span>{previewQuote.form.signOffDate}</span>
        </div>
      </div>
    </div>
  );
}
