import { useMemo, useState } from "react";
import type { AppData } from "../types";
import { money } from "../lib/format";
import { SectionTitle } from "../components/SectionTitle";
import { DataTable } from "../components/DataTable";

type DashboardTotals = {
  sales: number;
  paid: number;
  unpaid: number;
  purchase: number;
  purchaseUnpaid: number;
  margin: number;
  overdueCustomers: number;
};

export function Dashboard({ data, totals }: { data: AppData; totals: DashboardTotals }) {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [detail, setDetail] = useState("sales");
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const periodKey = period === "month" ? selectedMonth : selectedYear;
  const recordKey = (iso: string) => (period === "month" ? monthKey(new Date(iso)) : String(new Date(iso).getFullYear()));
  const periodSales = data.sales.filter((sale) => recordKey(sale.createdAt) === periodKey);
  const periodPurchases = data.purchases.filter((purchase) => recordKey(purchase.purchaseDate || purchase.createdAt) === periodKey);
  const periodTotals = {
    sales: periodSales.reduce((sum, sale) => sum + sale.amount, 0),
    paid: periodSales.reduce((sum, sale) => sum + sale.paidAmount, 0),
    purchase: periodPurchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0),
    overdueCustomers: new Set(periodSales.filter((sale) => sale.paymentStatus !== "paid").map((sale) => sale.customerId)).size
  };
  const cards = [
    ["sales", "매출액", periodTotals.sales],
    ["paid", "입금액", periodTotals.paid],
    ["unpaid", "미수금", Math.max(0, periodTotals.sales - periodTotals.paid)],
    ["purchase", "지출액", periodTotals.purchase],
    ["margin", "추정 이익", periodTotals.sales - periodTotals.purchase],
    ["overdue", "미수 업체", periodTotals.overdueCustomers]
  ];
  const trend = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const current = new Date(year, month - 1, 1);
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(current.getFullYear(), current.getMonth() - (5 - index), 1);
      const key = monthKey(date);
      return {
        key,
        label: `${date.getMonth() + 1}월`,
        value: data.sales.filter((sale) => monthKey(new Date(sale.createdAt)) === key).reduce((sum, sale) => sum + sale.amount, 0)
      };
    });
  }, [data.sales, selectedMonth]);
  const nowKey = monthKey(new Date());
  const trendMax = Math.max(...trend.map((row) => row.value), 1);
  const trendEmpty = trend.every((row) => row.value === 0);
  const shortMan = (value: number) => (value > 0 ? `${money(Math.round(value / 10000))}만` : "-");
  const rankedSales = useMemo(() => [...periodSales].sort((a, b) => b.amount - a.amount), [periodSales]);
  const topSales = rankedSales.slice(0, 5);
  const topSalesMax = Math.max(...topSales.map((sale) => sale.amount), 1);
  const availableYears = Array.from(new Set([
    String(new Date().getFullYear()),
    ...data.sales.map((sale) => String(new Date(sale.createdAt).getFullYear())),
    ...data.purchases.map((purchase) => String(new Date(purchase.purchaseDate || purchase.createdAt).getFullYear()))
  ])).sort().reverse();
  const detailSales = detail === "unpaid" || detail === "overdue" ? periodSales.filter((sale) => sale.paymentStatus !== "paid") : periodSales;
  const categoryRows = Object.entries(
    data.quotes.flatMap((quote) => quote.items).reduce<Record<string, { count: number; sales: number }>>((acc, item) => {
      const key = item.category || "미분류";
      acc[key] = { count: (acc[key]?.count ?? 0) + 1, sales: (acc[key]?.sales ?? 0) + item.price };
      return acc;
    }, {})
  ).sort((a, b) => b[1].sales - a[1].sales).slice(0, 8);

  return (
    <section className="dashboard">
      {totals.unpaid > 0 && <div className="alert">미수금 {money(totals.unpaid)}원이 남아 있습니다. 거래처 원장에서 수금 상태를 정리하세요.</div>}
      <div className="dashboard-head">
        <SectionTitle title="대시보드 보기" hint={`${period === "month" ? "이번 달" : "올해"} 기준 수치`} />
        <div className="top-actions">
          <button className={period === "month" ? "" : "ghost"} onClick={() => setPeriod("month")}>월간</button>
          <button className={period === "year" ? "" : "ghost"} onClick={() => setPeriod("year")}>연간</button>
          {period === "month" ? (
            <input aria-label="대시보드 조회 월" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
          ) : (
            <select aria-label="대시보드 조회 연도" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
              {availableYears.map((year) => <option key={year} value={year}>{year}년</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="kpis">
        {cards.map(([key, label, value]) => (
          <button className={`kpi ${detail === key ? "active" : ""}`} key={key} onClick={() => setDetail(String(key))}>
            <span>{label}</span>
            <strong>{typeof value === "number" && label !== "미수 업체" ? `${money(value)}원` : value}</strong>
          </button>
        ))}
      </div>

      <div className="panel dashboard-detail">
        <SectionTitle title={`${cards.find(([key]) => key === detail)?.[1] ?? "매출"} 상세`} hint="선택한 기간의 실제 원장 기록입니다." />
        {detail === "purchase" || detail === "margin" ? (
          <DataTable headers={["매입일", "매입처", "내용", "매입액", "지급액"]} rows={periodPurchases.map((purchase) => [
            purchase.purchaseDate || purchase.createdAt.slice(0, 10),
            data.vendors.find((vendor) => vendor.id === purchase.vendorId)?.name ?? "-",
            purchase.items.map((item) => item.description).join(", "),
            `${money(purchase.totalAmount)}원`,
            `${money(purchase.payments.reduce((sum, payment) => sum + payment.amount, 0))}원`
          ])} />
        ) : (
          <DataTable headers={["승인일", "고객", "프로젝트", "매출", "입금", "미수"]} rows={detailSales.map((sale) => [
            sale.createdAt.slice(0, 10),
            data.customers.find((customer) => customer.id === sale.customerId)?.name ?? "-",
            data.quotes.find((quote) => quote.id === sale.quoteId)?.form.projectName ?? "-",
            `${money(sale.amount)}원`, `${money(sale.paidAmount)}원`, `${money(sale.amount - sale.paidAmount)}원`
          ])} />
        )}
      </div>

      <div className="grid two">
        <div className="panel chart-panel">
          <SectionTitle title="최근 6개월 매출" hint="최근 6개월 · 승인 매출 기준" />
          {trendEmpty ? (
            <p className="chart-empty">아직 매출 데이터가 없습니다.</p>
          ) : (
            <div className="vchart">
              <div className="vchart-plot">
                {trend.map((item) => (
                  <div className="vchart-col" key={item.key} title={`${item.label} 매출 ${money(item.value)}원`}>
                    <span className="vchart-value">{shortMan(item.value)}</span>
                    <div className="vchart-track">
                      <div
                        className={`vchart-bar${item.key === nowKey ? " current" : ""}`}
                        style={{ height: `${item.value > 0 ? Math.max(4, (item.value / trendMax) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="vchart-axis">
                {trend.map((item) => (
                  <span className={`vchart-label${item.key === nowKey ? " current" : ""}`} key={item.key}>{item.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="panel chart-panel">
          <SectionTitle title="프로젝트별 매출 TOP 5" hint="선택한 기간의 승인 매출 상위 프로젝트" />
          {topSales.length === 0 ? (
            <p className="chart-empty">승인된 매출이 없습니다.</p>
          ) : (
            <div className="hbars">
              {topSales.map((sale) => {
                const name = data.quotes.find((quote) => quote.id === sale.quoteId)?.form.projectName || "견적";
                return (
                  <div className="hbar" key={sale.id}>
                    <span className="hbar-name" title={name}>{name}</span>
                    <span className="hbar-track"><i style={{ width: `${Math.max(6, (sale.amount / topSalesMax) * 100)}%` }} /></span>
                    <b className="hbar-value">{money(sale.amount)}원</b>
                  </div>
                );
              })}
              {rankedSales.length > 5 && <p className="hbar-more">외 {rankedSales.length - 5}건</p>}
            </div>
          )}
        </div>
      </div>

      <div className="grid two">
        <div className="panel">
          <SectionTitle title="거래처 요약" hint="매출·미수 기준" />
          <DataTable
            headers={["고객", "누적 매출", "미수금"]}
            rows={data.customers.map((customer) => [customer.name, `${money(customer.totalSales)}원`, `${money(customer.unpaidAmount)}원`])}
          />
        </div>
        <div className="panel">
          <SectionTitle title="품목 요약" hint="견적에 가장 많이 포함된 품목과 누적 금액" />
          <DataTable headers={["품목", "횟수", "누적 견적액"]} rows={categoryRows.map(([category, value]) => [category, `${value.count}회`, `${money(value.sales)}원`])} />
        </div>
      </div>
    </section>
  );
}
