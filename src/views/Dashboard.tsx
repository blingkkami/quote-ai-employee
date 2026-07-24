import { useMemo, useState } from "react";
import type { AppData } from "../types";
import { money } from "../lib/format";
import { SectionTitle } from "../components/SectionTitle";
import { DataTable } from "../components/DataTable";
import { dateInputValue, daysSince, monthKey, parseDate, yearKey } from "../lib/date";
import { dashboardPeriodData, saleRecordDate } from "../lib/dashboard";
import { buildTransactions, receivableTransactions, todoCounts } from "../lib/transaction";

type DashboardTotals = {
  sales: number;
  paid: number;
  unpaid: number;
  purchase: number;
  purchaseUnpaid: number;
  margin: number;
  overdueCustomers: number;
};

const recordDate = (value: string) => {
  const date = parseDate(value);
  return date ? dateInputValue(date) : value.slice(0, 10);
};

export function Dashboard({ data, totals }: { data: AppData; totals: DashboardTotals }) {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [detail, setDetail] = useState("sales");
  const periodKey = period === "month" ? selectedMonth : selectedYear;
  const periodData = useMemo(() => dashboardPeriodData(data, period, periodKey), [data, period, periodKey]);
  const { sales: periodSales, purchases: periodPurchases } = periodData;
  const periodTotals = periodData.totals;
  const cards = [
    ["sales", "매출액", periodTotals.sales],
    ["paid", "입금액", periodTotals.paid],
    ["unpaid", "미수금", Math.max(0, periodTotals.sales - periodTotals.paid)],
    ["purchase", "지출액", periodTotals.expense],
    ["margin", "추정 이익", periodTotals.margin],
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
        value: data.sales.filter((sale) => monthKey(saleRecordDate(data, sale)) === key).reduce((sum, sale) => sum + sale.amount, 0)
      };
    });
  }, [data, selectedMonth]);
  const nowKey = monthKey(new Date());
  const trendMax = Math.max(...trend.map((row) => row.value), 1);
  const trendEmpty = trend.every((row) => row.value === 0);
  const shortMan = (value: number) => (value > 0 ? `${money(Math.round(value / 10000))}만` : "-");
  const rankedSales = useMemo(() => [...periodSales].sort((a, b) => b.amount - a.amount), [periodSales]);
  const topSales = rankedSales.slice(0, 5);
  const topSalesMax = Math.max(...topSales.map((sale) => sale.amount), 1);
  const availableYears = Array.from(new Set([
    String(new Date().getFullYear()),
    ...data.sales.map((sale) => yearKey(sale.createdAt)),
    ...data.purchases.map((purchase) => yearKey(purchase.purchaseDate || purchase.createdAt))
  ])).sort().reverse();
  const detailSales = detail === "unpaid" || detail === "overdue" ? periodSales.filter((sale) => sale.paymentStatus !== "paid") : periodSales;
  const categoryRows = Object.entries(
    data.quotes.flatMap((quote) => quote.items).reduce<Record<string, { count: number; sales: number }>>((acc, item) => {
      const key = item.category || "미분류";
      acc[key] = { count: (acc[key]?.count ?? 0) + 1, sales: (acc[key]?.sales ?? 0) + item.price };
      return acc;
    }, {})
  ).sort((a, b) => b[1].sales - a[1].sales).slice(0, 8);
  const longOverdueSales = data.sales.filter((sale) => {
    if (sale.paymentStatus === "paid") return false;
    const quote = data.quotes.find((item) => item.id === sale.quoteId);
    return daysSince(quote?.approvedAt || sale.createdAt) >= 30;
  });
  // 실행형 위젯: 견적·수금·고객을 거래로 묶어 "지금 처리할 일"을 집계한다(P2).
  const transactions = useMemo(() => buildTransactions(data), [data]);
  const todo = useMemo(() => todoCounts(transactions), [transactions]);
  const receivableCount = useMemo(() => receivableTransactions(transactions).length, [transactions]);

  return (
    <section className="dashboard">
      {todo.totalOutstanding > 0 ? (
        <div className="panel dashboard-todo">
          <div className="dashboard-todo-head">
            <span>지금 처리할 일</span>
            <strong>총 미수 {money(todo.totalOutstanding)}원 · {receivableCount}건</strong>
          </div>
          <div className="todo-cards">
            <div className={`todo-card${todo.reviewNeeded > 0 ? " warn" : ""}`}>
              <span>확인 필요 미수</span><strong>{todo.reviewNeeded}건</strong><small>경과 14일 이상</small>
            </div>
            <div className={`todo-card${todo.resendNeeded > 0 ? " danger" : ""}`}>
              <span>재안내 필요</span><strong>{todo.resendNeeded}건</strong><small>발송 실패·장기 미수</small>
            </div>
            <div className="todo-card">
              <span>부분수금 진행</span><strong>{todo.partial}건</strong><small>잔액 남음</small>
            </div>
            <div className="todo-card">
              <span>이번 주 예정</span><strong>{todo.dueThisWeek}건</strong><small>경과 7일 이내</small>
            </div>
          </div>
        </div>
      ) : (
        <div className="panel dashboard-todo empty">
          <div className="dashboard-todo-head">
            <span>지금 처리할 일</span>
            <strong>미수 거래가 없습니다. 모두 정리되었습니다.</strong>
          </div>
        </div>
      )}
      {longOverdueSales.length > 0 && <div className="alert danger-alert">30일 이상 지난 미수금이 {longOverdueSales.length}건 있습니다. 입금일과 잔액을 확인하세요.</div>}
      <div className="dashboard-head">
        <SectionTitle title="대시보드 보기" hint={`${period === "month" ? "이번 달" : "올해"} 기준 수치`} />
        <div className="top-actions">
          <div className="segmented dashboard-period-mode" aria-label="대시보드 조회 기간">
            <button aria-pressed={period === "month"} className={period === "month" ? "selected" : ""} onClick={() => setPeriod("month")}>월간</button>
            <button aria-pressed={period === "year"} className={period === "year" ? "selected" : ""} onClick={() => setPeriod("year")}>연간</button>
          </div>
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
          <button aria-pressed={detail === key} className={`kpi ${detail === key ? "active" : ""}`} key={key} onClick={() => setDetail(String(key))}>
            <span>{label}</span>
            <strong>{typeof value === "number" && label !== "미수 업체" ? `${money(value)}원` : value}</strong>
          </button>
        ))}
      </div>

      <div className="panel dashboard-detail">
        <SectionTitle title={`${cards.find(([key]) => key === detail)?.[1] ?? "매출"} 상세`} hint="선택한 기간의 실제 원장 기록입니다." />
        {detail === "purchase" ? (
          <DataTable headers={["지급일", "매입처", "내용", "지급액"]} rows={periodData.purchasePayments.map(({ purchase, date, amount }) => [
            date,
            data.vendors.find((vendor) => vendor.id === purchase.vendorId)?.name ?? "-",
            purchase.items.map((item) => item.description).join(", "),
            `${money(amount)}원`
          ])} />
        ) : detail === "margin" ? (
          <DataTable headers={["매입일", "매입처", "내용", "매입원가", "지급 누계"]} rows={periodPurchases.map((purchase) => [
            purchase.purchaseDate || purchase.createdAt.slice(0, 10),
            data.vendors.find((vendor) => vendor.id === purchase.vendorId)?.name ?? "-",
            purchase.items.map((item) => item.description).join(", "),
            `${money(purchase.totalAmount)}원`,
            `${money(purchase.payments.reduce((sum, payment) => sum + payment.amount, 0))}원`
          ])} />
        ) : detail === "paid" ? (
          <DataTable headers={["입금일", "고객", "프로젝트", "입금액"]} rows={periodData.payments.map(({ sale, date, amount }) => [
            date,
            data.customers.find((customer) => customer.id === sale.customerId)?.name ?? "-",
            data.quotes.find((quote) => quote.id === sale.quoteId)?.form.projectName ?? "-",
            `${money(amount)}원`
          ])} />
        ) : (
          <DataTable headers={["승인일", "고객", "프로젝트", "매출", "입금", "미수"]} rows={detailSales.map((sale) => [
            data.quotes.find((quote) => quote.id === sale.quoteId)?.approvedAt
              || recordDate(sale.createdAt),
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
