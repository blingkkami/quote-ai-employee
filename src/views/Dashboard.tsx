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
  const [showGraph, setShowGraph] = useState(false);
  const [period, setPeriod] = useState<"month" | "year">("month");
  const periodKey = new Date().toISOString().slice(0, period === "month" ? 7 : 4);
  const periodSales = data.sales.filter((sale) => sale.createdAt.startsWith(periodKey));
  const periodPurchases = data.purchases.filter((purchase) => purchase.createdAt.startsWith(periodKey));
  const periodTotals = {
    sales: periodSales.reduce((sum, sale) => sum + sale.amount, 0),
    paid: periodSales.reduce((sum, sale) => sum + sale.paidAmount, 0),
    purchase: periodPurchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0),
    overdueCustomers: new Set(periodSales.filter((sale) => sale.paymentStatus !== "paid").map((sale) => sale.customerId)).size
  };
  const cards = [
    ["매출액", periodTotals.sales],
    ["입금액", periodTotals.paid],
    ["미수금", Math.max(0, periodTotals.sales - periodTotals.paid)],
    ["지출액", periodTotals.purchase],
    ["추정 이익", periodTotals.sales - periodTotals.purchase],
    ["미수 업체", periodTotals.overdueCustomers]
  ];
  const maxSales = Math.max(...periodSales.map((sale) => sale.amount), 1);
  const trend = useMemo(() => {
    const current = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(current.getFullYear(), current.getMonth() - (5 - index), 1);
      const key = date.toISOString().slice(0, 7);
      return {
        label: `${date.getMonth() + 1}월`,
        value: data.sales.filter((sale) => sale.createdAt.startsWith(key)).reduce((sum, sale) => sum + sale.amount, 0)
      };
    });
  }, [data.sales]);
  const graphItems = useMemo(
    () => [
      { label: "매출", value: periodTotals.sales, tone: "sales" },
      { label: "입금", value: periodTotals.paid, tone: "paid" },
      { label: "미수금", value: Math.max(0, periodTotals.sales - periodTotals.paid), tone: "unpaid" },
      { label: "지출", value: periodTotals.purchase, tone: "purchase" },
      { label: "추정 이익", value: periodTotals.sales - periodTotals.purchase, tone: "margin" }
    ],
    [periodTotals.paid, periodTotals.purchase, periodTotals.sales]
  );
  const maxGraphValue = Math.max(...graphItems.map((item) => Math.abs(item.value)), 1);

  return (
    <section className="dashboard">
      {totals.unpaid > 0 && <div className="alert">미수금 {money(totals.unpaid)}원이 남아 있습니다. 거래처 원장에서 수금 상태를 정리하세요.</div>}
      <div className="dashboard-head">
        <SectionTitle title="대시보드 보기" hint={`${period === "month" ? "이번 달" : "올해"} 기준 수치`} />
        <div className="top-actions">
          <button className={period === "month" ? "" : "ghost"} onClick={() => setPeriod("month")}>월간</button>
          <button className={period === "year" ? "" : "ghost"} onClick={() => setPeriod("year")}>연간</button>
          <button className={showGraph ? "ghost" : ""} onClick={() => setShowGraph((value) => !value)}>
            {showGraph ? "요약 보기" : "그래프 보기"}
          </button>
        </div>
      </div>

      <div className="kpis">
        {cards.map(([label, value]) => (
          <div className="kpi" key={label}>
            <span>{label}</span>
            <strong>{typeof value === "number" && label !== "미수 업체" ? `${money(value)}원` : value}</strong>
          </div>
        ))}
      </div>

      {showGraph ? (
        <div className="grid two">
          <div className="panel chart-panel">
            <SectionTitle title="수익 흐름 그래프" hint="매출, 입금, 미수금, 지출, 이익을 한눈에 비교합니다." />
            <div className="metric-bars">
              {graphItems.map((item) => (
                <div className="metric-bar" key={item.label}>
                  <span>{item.label}</span>
                  <i className={item.tone} style={{ width: `${Math.max(6, (Math.abs(item.value) / maxGraphValue) * 100)}%` }} />
                  <b>{money(item.value)}원</b>
                </div>
              ))}
            </div>
          </div>
          <div className="panel chart-panel">
            <SectionTitle title="최근 매출 그래프" hint="견적별 매출 규모를 비교합니다." />
            <div className="bars">
              {periodSales.map((sale) => {
                const quote = data.quotes.find((item) => item.id === sale.quoteId);
                return (
                  <div className="bar-line" key={sale.id}>
                    <span>{quote?.form.projectName || "견적"}</span>
                    <i style={{ width: `${Math.max(8, (sale.amount / maxSales) * 100)}%` }} />
                    <b>{money(sale.amount)}원</b>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid two">
          <div className="panel">
            <SectionTitle title="최근 6개월 매출 추이" hint="저장된 승인 매출 기준" />
            <div className="bars">
              {trend.map((item) => {
                return (
                  <div className="bar-line" key={item.label}>
                    <span>{item.label}</span>
                    <i style={{ width: `${Math.max(item.value ? 8 : 0, (item.value / Math.max(...trend.map((row) => row.value), 1)) * 100)}%` }} />
                    <b>{money(item.value)}원</b>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="panel">
            <SectionTitle title="거래처 요약" hint="매출·미수 기준" />
            <DataTable
              headers={["고객", "누적 매출", "미수금"]}
              rows={data.customers.map((customer) => [customer.name, `${money(customer.totalSales)}원`, `${money(customer.unpaidAmount)}원`])}
            />
          </div>
        </div>
      )}
    </section>
  );
}
