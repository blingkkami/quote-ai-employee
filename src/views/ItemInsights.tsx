import type { AppData } from "../types";
import { money } from "../lib/format";
import { DataTable } from "../components/DataTable";

export function ItemInsights({ data }: { data: AppData }) {
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
  return (
    <section className="panel">
      <DataTable
        headers={["품목", "견적 사용 빈도", "평균 단가", "관련 매입원가", "추정 차익"]}
        rows={[...itemMap.entries()].map(([name, value]) => [
          name,
          value.count,
          `${money(value.sales / Math.max(value.count, 1))}원`,
          `${money(value.purchase)}원`,
          `${money(value.sales - value.purchase)}원`
        ])}
      />
    </section>
  );
}
