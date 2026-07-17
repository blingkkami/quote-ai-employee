import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Search, Trash2, X } from "lucide-react";
import type { Customer, PaymentStatus, QuoteRecord, QuoteStatus } from "../types";
import { money } from "../lib/format";
import { quoteTotal } from "../lib/quote-calc";
import { quoteRecordDate } from "../lib/quote-date";
import { payLabels, statusLabels } from "../constants";
import { Status } from "../components/Status";
import { DataTable } from "../components/DataTable";
import { SectionTitle } from "../components/SectionTitle";

export function QuoteList({
  quotes,
  customers,
  query,
  setQuery,
  onOpen,
  onChange,
  onDelete,
  onDuplicate
}: {
  quotes: QuoteRecord[];
  customers: Customer[];
  query: string;
  setQuery: (value: string) => void;
  onOpen: (id: string) => void;
  onChange: (quote: QuoteRecord) => void;
  onDelete: (id: string) => void;
  onDuplicate: (quote: QuoteRecord) => void;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "all">("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
    if (statusFilter !== "all" && quote.status !== statusFilter) return false;
    if (paymentFilter !== "all" && quote.paymentStatus !== paymentFilter) return false;
    const recordDate = quoteRecordDate(quote);
    if (dateFrom && recordDate < dateFrom) return false;
    if (dateTo && recordDate > dateTo) return false;
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
  }), [customers, dateFrom, dateTo, paymentFilter, quotes, searchTokens, statusFilter]);

  const clearSearch = () => {
    setQuery("");
    searchInputRef.current?.focus();
  };

  return (
    <section className="panel quote-list-page">
      <div className="quote-list-head">
        <SectionTitle title="전체 견적" hint="검색과 필터로 견적을 찾은 뒤 열기·복제·삭제할 수 있습니다." />
        <strong>{filtered.length}건</strong>
      </div>
      <div className="toolbar quote-filter-bar">
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
        <select aria-label="견적 상태 필터" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as QuoteStatus | "all")}>
          <option value="all">모든 견적 상태</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="수금 상태 필터" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as PaymentStatus | "all")}>
          <option value="all">모든 수금 상태</option>
          {Object.entries(payLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input aria-label="견적일 시작" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <input aria-label="견적일 종료" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        <span className="search-shortcut">{navigator.platform.includes("Mac") ? "⌘K" : "Ctrl K"}</span>
        <span className="search-count">전체 {quotes.length}건</span>
      </div>
      {filtered.length > 0 ? (
        <DataTable
          headers={["견적일", "프로젝트", "고객", "합계", "견적 상태", "수금 상태", "최근 수정", ""]}
          rows={filtered.map((quote) => [
            quote.form.quoteDate || "-",
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
              <button className="icon" title="견적 복제" aria-label="견적 복제" onClick={() => onDuplicate(quote)}>
                <Copy size={15} />
              </button>
              <button
                className="icon danger"
                title="견적 삭제"
                aria-label="견적 삭제"
                onClick={() => {
                  if (window.confirm(`'${quote.form.projectName || "제목 없음"}' 견적과 연결된 매출 기록을 삭제할까요?`)) onDelete(quote.id);
                }}
              >
                <Trash2 size={15} />
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
