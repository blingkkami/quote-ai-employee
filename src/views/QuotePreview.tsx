import type { Customer, QuoteRecord } from "../types";
import { money } from "../lib/format";
import { quoteSubtotal, quoteTotal, quoteVat } from "../lib/quote-calc";

export function QuotePreview({ quote, customer }: { quote: QuoteRecord; customer?: Customer }) {
  const empty = !quote.form.projectName && quote.items.every((item) => !item.category && !item.description && !item.price);
  return (
    <div className="preview-wrap">
      <div className="quote-paper">
        <div className="paper-head">
          <div>
            <p>Quotation</p>
            <h2>{empty ? "예시 견적서" : quote.form.projectName || "프로젝트명 미입력"}</h2>
          </div>
          <span>블링까미</span>
        </div>
        <div className="paper-grid">
          <div>
            <b>공급자</b>
            <span>{quote.form.issuerName || "-"}</span>
          </div>
          <div>
            <b>고객</b>
            <span>{customer?.name ?? "고객 미선택"}</span>
          </div>
          <div>
            <b>견적일</b>
            <span>{quote.form.quoteDate}</span>
          </div>
          <div>
            <b>유효기간</b>
            <span>{quote.form.validDuration}</span>
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
            {(empty ? [{ id: "sample", category: "AI 비주얼", description: "제품 상세페이지용 이미지 제작", price: 500000 }] : quote.items).map((item) => (
              <tr key={item.id}>
                <td>{item.category || "-"}</td>
                <td>{item.description || "-"}</td>
                <td>{money(item.price)}원</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="totals">
          <span>공급가 {money(empty ? 500000 : quoteSubtotal(quote))}원</span>
          <span>VAT {money(empty ? 50000 : quoteVat(quote))}원</span>
          <strong>합계 {money(empty ? 550000 : quoteTotal(quote))}원</strong>
        </div>
        <div className="paper-note">
          <b>{quote.form.finalCategory}</b>
          <p>{quote.form.finalDescription}</p>
          <p>{quote.form.notes}</p>
          <p>{quote.form.message}</p>
        </div>
        <div className="paper-sign">
          <span>{quote.form.signOffSender}</span>
          <span>{quote.form.signOffDate}</span>
        </div>
      </div>
    </div>
  );
}
