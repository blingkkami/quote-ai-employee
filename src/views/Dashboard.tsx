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
  const cards = [
    ["매출액", totals.sales],
    ["입금액", totals.paid],
    ["미수금", totals.unpaid],
    ["지출액", totals.purchase],
    ["추정 이익", totals.margin],
    ["미수 업체", totals.overdueCustomers]
  ];
  const maxSales = Math.max(...data.sales.map((sale) => sale.amount), 1);
  const graphItems = useMemo(
    () => [
      { label: "매출", value: totals.sales, tone: "sales" },
      { label: "입금", value: totals.paid, tone: "paid" },
      { label: "미수금", value: totals.unpaid, tone: "unpaid" },
      { label: "지출", value: totals.purchase, tone: "purchase" },
      { label: "추정 이익", value: totals.margin, tone: "margin" }
    ],
    [totals.margin, totals.paid, totals.purchase, totals.sales, totals.unpaid]
  );
  const maxGraphValue = Math.max(...graphItems.map((item) => Math.abs(item.value)), 1);

  return (
    <section className="dashboard">
      {totals.unpaid > 0 && <div className="alert">미수금 {money(totals.unpaid)}원이 남아 있습니다. 거래처 원장에서 수금 상태를 정리하세요.</div>}
      <div className="dashboard-head">
        <SectionTitle title="대시보드 보기" hint={showGraph ? "현재 수치를 그래프로 비교합니다." : "요약 카드와 거래처 표를 확인합니다."} />
        <button className={showGraph ? "ghost" : ""} onClick={() => setShowGraph((value) => !value)}>
          {showGraph ? "요약 보기" : "그래프 보기"}
        </button>
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
              {data.sales.map((sale) => {
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
            <SectionTitle title="최근 매출 추이" hint="로컬 데이터 기준" />
            <div className="bars">
              {data.sales.map((sale) => {
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
