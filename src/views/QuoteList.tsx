import { Search } from "lucide-react";
import type { Customer, QuoteRecord, QuoteStatus } from "../types";
import { money } from "../lib/format";
import { quoteTotal } from "../lib/quote-calc";
import { payLabels, statusLabels } from "../constants";
import { Status } from "../components/Status";
import { DataTable } from "../components/DataTable";

export function QuoteList({
  quotes,
  customers,
  query,
  setQuery,
  onOpen,
  onChange
}: {
  quotes: QuoteRecord[];
  customers: Customer[];
  query: string;
  setQuery: (value: string) => void;
  onOpen: (id: string) => void;
  onChange: (quote: QuoteRecord) => void;
}) {
  const filtered = quotes.filter((quote) => {
    const customer = customers.find((item) => item.id === quote.customerId)?.name ?? "";
    return `${quote.form.projectName} ${customer}`.toLowerCase().includes(query.toLowerCase());
  });
  return (
    <section className="panel">
      <div className="toolbar">
        <div className="search">
          <Search size={17} />
          <input placeholder="프로젝트명 또는 고객명 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </div>
      <DataTable
        headers={["프로젝트", "고객", "합계", "견적 상태", "수금 상태", "최근 수정", ""]}
        rows={filtered.map((quote) => [
          quote.form.projectName || "제목 없음",
          customers.find((item) => item.id === quote.customerId)?.name ?? "-",
          `${money(quoteTotal(quote))}원`,
          <Status key="status" tone={quote.status}>{statusLabels[quote.status]}</Status>,
          <Status key="payment" tone={quote.paymentStatus}>{payLabels[quote.paymentStatus]}</Status>,
          new Date(quote.updatedAt).toLocaleDateString("ko-KR"),
          <div className="row-actions" key="actions">
            <select value={quote.status} onChange={(event) => onChange({ ...quote, status: event.target.value as QuoteStatus })}>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button className="ghost" onClick={() => onOpen(quote.id)}>
              열기
            </button>
          </div>
        ])}
      />
    </section>
  );
}
