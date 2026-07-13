import { useLayoutEffect, useRef, useState } from "react";
import type { Customer, QuoteRecord } from "../types";
import { exampleQuoteForm, exampleQuoteItems } from "../data/quote-defaults";
import { money } from "../lib/format";
import { addDays, koreanDate, today } from "../lib/date";
import { quoteHasContent, quoteSubtotal, quoteTotal } from "../lib/quote-calc";

function buildValidDuration(validDuration: string, quoteDate: string) {
  if (!validDuration) return "-";
  const match = validDuration.match(/(\d+)\s*일/);
  if (!match || validDuration.includes("총 유효")) return validDuration;
  const validUntil = addDays(quoteDate, Number(match[1]));
  if (!validUntil) return validDuration;
  const until = koreanDate(validUntil);
  return `${validDuration} (${until} 총 유효)`;
}

const PAPER_WIDTH = 794;
const PAPER_MIN_HEIGHT = 1123;

export function QuotePreview({ quote, logo }: { quote: QuoteRecord; customer?: Customer; logo?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [paperHeight, setPaperHeight] = useState(PAPER_MIN_HEIGHT);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const paper = paperRef.current;
    if (!wrap || !paper) return;
    const update = () => {
      const width = wrap.clientWidth;
      setScale(width > 0 ? Math.min(1, width / PAPER_WIDTH) : 1);
      setPaperHeight(Math.max(PAPER_MIN_HEIGHT, paper.scrollHeight));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrap);
    observer.observe(paper);
    return () => observer.disconnect();
  }, []);

  const empty = !quoteHasContent(quote);
  const previewQuote = empty ? { ...quote, form: exampleQuoteForm, items: exampleQuoteItems } : quote;
  const form = previewQuote.form;

  const subtotal = quoteSubtotal(previewQuote);
  const total = quoteTotal(previewQuote);

  const noteLines = form.notes.split("\n").map((line) => line.trim()).filter(Boolean);

  const senderBase = form.signOffSender.trim() || form.issuerName.trim();
  const senderLine = senderBase ? (senderBase.endsWith("드림") ? senderBase : `${senderBase} 드림`) : "";
  const signDateSource = form.signOffDate || form.quoteDate || today();
  const signDate = koreanDate(signDateSource);

  return (
    <div className="preview-wrap">
      <div className="qp-scale-wrap" ref={wrapRef} style={{ height: paperHeight * scale, overflow: "hidden" }}>
        <div className="qp-paper" ref={paperRef} style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <div className="qp-header">
          {logo && <img className="qp-logo" src={logo} alt="로고" />}
          <h1 className="qp-title">견적서</h1>
          <p className="qp-subtitle">QUOTATION</p>
          <div className="qp-header-divider" />
        </div>

        <section className="qp-section">
          <h3 className="qp-section-title">기본 정보</h3>
          <div className="qp-section-bar" />
          <table className="qp-info-table">
            <tbody>
              <tr>
                <td className="qp-label">견적일</td>
                <td className="qp-value">{koreanDate(form.quoteDate) || "-"}</td>
                <td className="qp-label">유효기간</td>
                <td className="qp-value">{buildValidDuration(form.validDuration, form.quoteDate)}</td>
              </tr>
              <tr>
                <td className="qp-label">공급자</td>
                <td className="qp-value">{form.issuerName || "-"}</td>
                <td className="qp-label">프로젝트명</td>
                <td className="qp-value">{form.projectName || "-"}</td>
              </tr>
              <tr>
                <td className="qp-label">납품 형식</td>
                <td className="qp-value">{form.deliveryFormat || "-"}</td>
                <td className="qp-label">납기 예정</td>
                <td className="qp-value">{form.deliverySchedule || "-"}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="qp-section">
          <h3 className="qp-section-title">작업 항목 (옵션형)</h3>
          <div className="qp-section-bar" />
          <table className="qp-items-table">
            <thead>
              <tr>
                <th className="qp-col-category">항목</th>
                <th className="qp-col-desc">내용</th>
                <th className="qp-col-amount">금액</th>
              </tr>
            </thead>
            <tbody>
              {previewQuote.items.map((item) => (
                <tr key={item.id}>
                  <td className="qp-item-category">{item.category || "-"}</td>
                  <td className="qp-item-desc">{item.description || "-"}</td>
                  <td className="qp-item-amount">{money(item.price)}원</td>
                </tr>
              ))}
              <tr className="qp-highlight-row">
                <td className="qp-final-category">{form.finalCategory}</td>
                <td className="qp-final-desc">{form.finalDescription}</td>
                <td className="qp-final-amount">
                  <span className="qp-final-sum">{money(subtotal)}원</span>
                  <span className="qp-final-vat">부가세 별도</span>
                </td>
              </tr>
              <tr className="qp-total-row">
                <td className="qp-total-cell" colSpan={2}>
                  <div>총 견적 (부가세 제외) : {money(subtotal)}원</div>
                  <div>총 견적 (부가세 포함) : {money(total)}원</div>
                </td>
                <td className="qp-total-empty" />
              </tr>
            </tbody>
          </table>
        </section>

        <section className="qp-section">
          <h3 className="qp-section-title">유의사항</h3>
          <div className="qp-section-bar" />
          <ul className="qp-notes">
            {noteLines.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </section>

        <section className="qp-section">
          <h3 className="qp-section-title">전달 말씀</h3>
          <div className="qp-section-bar" />
          <div className="qp-message">{form.message}</div>
        </section>

          <div className="qp-signoff">
            <div className="qp-signoff-sender">{senderLine}</div>
            <div className="qp-signoff-date">{signDate}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
