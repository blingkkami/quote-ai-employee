import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { AppData } from "../types";
import { money } from "../lib/format";
import { DataTable } from "../components/DataTable";
import { SectionTitle } from "../components/SectionTitle";

export function ItemInsights({ data }: { data: AppData }) {
  const [query, setQuery] = useState("");
  const items = useMemo(() => {
    const itemMap = new Map<string, { count: number; sales: number; purchase: number }>();
    data.quotes.flatMap((quote) => quote.items).forEach((item) => {
      const key = item.category || "미분류";
      const prev = itemMap.get(key) ?? { count: 0, sales: 0, purchase: 0 };
      itemMap.set(key, { count: prev.count + 1, sales: prev.sales + item.price, purchase: prev.purchase });
    });
    data.purchases.flatMap((record) => record.items).forEach((item) => {
      const key = item.category || "미분류";
      const prev = itemMap.get(key) ?? { count: 0, sales: 0, purchase: 0 };
      itemMap.set(key, { ...prev, purchase: prev.purchase + item.price });
    });
    return [...itemMap.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((left, right) => right.sales - left.sales || left.name.localeCompare(right.name, "ko-KR"));
  }, [data.purchases, data.quotes]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredItems = items.filter((item) => item.name.toLocaleLowerCase().includes(normalizedQuery));
  const totals = items.reduce(
    (sum, item) => ({ count: sum.count + item.count, sales: sum.sales + item.sales, purchase: sum.purchase + item.purchase }),
    { count: 0, sales: 0, purchase: 0 }
  );

  return (
    <section className="item-page">
      <div className="panel item-insights">
        <div className="toolbar item-insights-head">
          <SectionTitle title="품목 현황" hint="견적 사용 빈도와 관련 매입원가를 품목별로 비교합니다." />
          <div className="search item-search">
            <Search size={17} />
            <input aria-label="품목 검색" placeholder="품목명 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </div>
        <div className="kpis mini item-kpis">
          <div className="kpi"><span>등록 품목</span><strong>{items.length}개</strong></div>
          <div className="kpi"><span>견적 사용</span><strong>{totals.count}회</strong></div>
          <div className="kpi"><span>누적 견적액</span><strong>{money(totals.sales)}원</strong></div>
          <div className="kpi"><span>추정 차익</span><strong>{money(totals.sales - totals.purchase)}원</strong></div>
        </div>
        <div className="item-table-head">
          <strong>품목별 내역</strong>
          <span>{filteredItems.length}개</span>
        </div>
        {filteredItems.length ? (
          <DataTable
            headers={["품목", "견적 사용 빈도", "평균 단가", "관련 매입원가", "추정 차익"]}
            rows={filteredItems.map((item) => [
              item.name,
              `${item.count}회`,
              `${money(item.sales / Math.max(item.count, 1))}원`,
              `${money(item.purchase)}원`,
              `${money(item.sales - item.purchase)}원`
            ])}
          />
        ) : (
          <div className="empty-state">
            <strong>{query ? "검색된 품목이 없습니다." : "집계할 품목이 없습니다."}</strong>
            <span>{query ? "품목명을 다시 확인해 주세요." : "견적과 매입 내역을 등록하면 품목별 현황이 표시됩니다."}</span>
          </div>
        )}
      </div>
    </section>
  );
}
