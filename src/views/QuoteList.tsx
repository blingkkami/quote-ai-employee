import { useEffect, useMemo, useRef } from "react";
import { Search, X } from "lucide-react";
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const searchTokens = useMemo(
    () => query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),
    [query]
  );

  const filtered = useMemo(() => quotes.filter((quote) => {
    const customer = customers.find((item) => item.id === quote.customerId);
    const searchableText = [
      quote.id,
      quote.form.quoteDate,
      quote.form.validDuration,
      quote.form.issuerName,
      quote.form.projectName,
      quote.form.deliveryFormat,
      quote.form.deliverySchedule,
      quote.form.finalCategory,
      quote.form.finalDescription,
      quote.form.notes,
      quote.form.message,
      quote.form.signOffSender,
      customer?.name,
      customer?.businessNumber,
      customer?.representativeName,
      customer?.contactPerson,
      customer?.contact,
      customer?.email,
      statusLabels[quote.status],
      payLabels[quote.paymentStatus],
      quote.invoiceStatus,
      quote.items.flatMap((item) => [item.category, item.description, String(item.price)]),
      new Date(quote.updatedAt).toLocaleDateString("ko-KR")
    ]
      .flat()
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();

    return searchTokens.every((token) => searchableText.includes(token));
  }), [customers, quotes, searchTokens]);

  const clearSearch = () => {
    setQuery("");
    searchInputRef.current?.focus();
  };

  return (
    <section className="panel">
      <div className="toolbar">
        <div className="search">
          <Search size={17} />
          <input
            ref={searchInputRef}
            aria-label="견적서 검색"
            placeholder="프로젝트, 고객, 견적번호, 품목 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button className="search-clear icon" type="button" aria-label="검색어 지우기" title="검색어 지우기" onClick={clearSearch}>
              <X size={15} />
            </button>
          )}
        </div>
        <span className="search-shortcut">{navigator.platform.includes("Mac") ? "⌘K" : "Ctrl K"}</span>
        <span className="search-count">{query ? `${filtered.length}건 / ${quotes.length}건` : `전체 ${quotes.length}건`}</span>
      </div>
      {filtered.length > 0 ? (
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
      ) : (
        <div className="empty-state">
          <strong>{query ? "검색 결과가 없습니다" : "아직 저장된 견적서가 없습니다"}</strong>
          <span>{query ? "프로젝트명, 고객명, 견적번호 또는 품목명을 다시 확인해 주세요." : "새 견적을 작성하면 이곳에서 빠르게 찾아볼 수 있습니다."}</span>
        </div>
      )}
    </section>
  );
}
