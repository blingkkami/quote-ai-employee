import { Download, Send } from "lucide-react";
import type { Customer, QuoteRecord } from "../types";
import { money } from "../lib/format";
import { quoteSubtotal, quoteTotal, quoteVat } from "../lib/quote-calc";
import { SectionTitle } from "../components/SectionTitle";
import { Status } from "../components/Status";

export function IssueCenter({ quote, customers, onApprove, onExportCsv }: { quote: QuoteRecord; customers: Customer[]; onApprove: (quote: QuoteRecord) => void; onExportCsv: () => void }) {
  const customer = customers.find((item) => item.id === quote.customerId);
  return (
    <section className="grid two">
      <div className="panel">
        <SectionTitle title="발행 대상 확인" hint="승인 시 자동 발행은 Popbill 발행 성공 상태로 기록됩니다." />
        <dl className="details">
          <dt>고객</dt>
          <dd>{customer?.name ?? "고객 미선택"}</dd>
          <dt>사업자번호</dt>
          <dd>{customer?.businessNumber ?? "-"}</dd>
          <dt>프로젝트</dt>
          <dd>{quote.form.projectName || "-"}</dd>
          <dt>공급가/VAT/합계</dt>
          <dd>{money(quoteSubtotal(quote))}원 / {money(quoteVat(quote))}원 / {money(quoteTotal(quote))}원</dd>
          <dt>발행 방식</dt>
          <dd>{quote.invoiceIssuanceMode === "auto" ? "자동 발행" : "수동 발행"}</dd>
          <dt>발행 상태</dt>
          <dd><Status tone={quote.invoiceStatus ?? "pending"}>{quote.invoiceStatus ?? "pending"}</Status></dd>
        </dl>
        <div className="actions">
          <button onClick={() => onApprove(quote)}>
            <Send size={17} /> 승인 및 발행 실행
          </button>
          <button className="ghost" onClick={onExportCsv}>
            <Download size={17} /> 수동발행 CSV
          </button>
        </div>
      </div>
      <div className="panel">
        <SectionTitle title="Popbill 연동 준비" hint="실서비스에서는 Vercel API Route에서 Node SDK를 호출합니다." />
        <pre className="code">{`POST /api/popbill/issue
{
  quoteId: "${quote.id}",
  amount: ${quoteSubtotal(quote)},
  tax: ${quoteVat(quote)},
  customerBusinessNumber: "${customer?.businessNumber ?? ""}"
}`}</pre>
      </div>
    </section>
  );
}
