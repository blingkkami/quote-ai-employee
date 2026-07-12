import { useMemo, useState } from "react";
import { HandCoins, Search } from "lucide-react";
import type { AppData, PaymentStatus } from "../types";
import { money } from "../lib/format";
import { today } from "../lib/date";
import { payLabels } from "../constants";
import { Status } from "../components/Status";
import { SectionTitle } from "../components/SectionTitle";

export function Ledger({ data, onPayment }: { data: AppData; onPayment: (saleId: string, amount: number, date: string) => void }) {
  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeSaleId, setActiveSaleId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());

  const filtered = useMemo(() => data.sales.filter((sale) => {
    const quote = data.quotes.find((item) => item.id === sale.quoteId);
    const customer = data.customers.find((item) => item.id === sale.customerId);
    const recordDate = quote?.form.quoteDate || sale.createdAt.slice(0, 10);
    const haystack = `${customer?.name ?? ""} ${quote?.form.projectName ?? ""} ${quote?.id ?? ""}`.toLocaleLowerCase();
    if (query && !haystack.includes(query.toLocaleLowerCase())) return false;
    if (customerId !== "all" && sale.customerId !== customerId) return false;
    if (paymentStatus !== "all" && sale.paymentStatus !== paymentStatus) return false;
    if (dateFrom && recordDate < dateFrom) return false;
    if (dateTo && recordDate > dateTo) return false;
    return true;
  }), [customerId, data.customers, data.quotes, data.sales, dateFrom, dateTo, paymentStatus, query]);

  const totals = filtered.reduce(
    (sum, sale) => ({ sales: sum.sales + sale.amount, paid: sum.paid + sale.paidAmount }),
    { sales: 0, paid: 0 }
  );
  const activeSale = data.sales.find((sale) => sale.id === activeSaleId);

  const openPayment = (saleId: string) => {
    const sale = data.sales.find((item) => item.id === saleId);
    if (!sale) return;
    setActiveSaleId(saleId);
    setPaymentAmount(String(Math.max(0, sale.amount - sale.paidAmount)));
    setPaymentDate(today());
  };

  const submitPayment = () => {
    if (!activeSale) return;
    const remaining = Math.max(0, activeSale.amount - activeSale.paidAmount);
    const amount = Math.min(Number(paymentAmount), remaining);
    if (!amount || amount < 1) return;
    onPayment(activeSale.id, amount, paymentDate);
    setActiveSaleId("");
    setPaymentAmount("");
  };

  return (
    <section className="ledger-page">
      <div className="panel">
        <SectionTitle title="거래처 원장" hint="승인된 견적의 매출과 입금 내역을 거래처별로 관리합니다." />
        <div className="filter-bar">
          <div className="search">
            <Search size={17} />
            <input aria-label="원장 검색" placeholder="고객, 프로젝트, 견적번호 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <select aria-label="고객 필터" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="all">모든 고객</option>
            {data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
          <select aria-label="원장 수금 상태" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus | "all")}>
            <option value="all">모든 수금 상태</option>
            {Object.entries(payLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input aria-label="원장 시작일" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <input aria-label="원장 종료일" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>
        <div className="kpis mini ledger-kpis">
          <div className="kpi"><span>조회 매출</span><strong>{money(totals.sales)}원</strong></div>
          <div className="kpi"><span>조회 입금</span><strong>{money(totals.paid)}원</strong></div>
          <div className="kpi"><span>조회 미수금</span><strong>{money(totals.sales - totals.paid)}원</strong></div>
        </div>
      </div>

      {activeSale && (
        <div className="panel payment-entry">
          <SectionTitle title="부분 수금 입력" hint="실제 입금일과 입금액을 입력하면 원장과 대시보드에 즉시 반영됩니다." />
          <div className="grid payment-grid">
            <label>입금일<input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
            <label>입금액<input type="number" min="1" max={activeSale.amount - activeSale.paidAmount} value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label>
            <div className="actions">
              <button onClick={submitPayment}><HandCoins size={16} /> 수금 반영</button>
              <button className="ghost" onClick={() => setActiveSaleId("")}>취소</button>
            </div>
          </div>
        </div>
      )}

      <div className="panel ledger-table">
        <div className="table-wrap">
          <table>
            <thead><tr><th>견적일</th><th>고객</th><th>프로젝트</th><th>매출</th><th>입금</th><th>미수금</th><th>상태</th><th>입금 내역</th><th></th></tr></thead>
            <tbody>
              {filtered.map((sale) => {
                const quote = data.quotes.find((item) => item.id === sale.quoteId);
                const customer = data.customers.find((item) => item.id === sale.customerId);
                const remaining = Math.max(0, sale.amount - sale.paidAmount);
                return (
                  <tr key={sale.id}>
                    <td>{quote?.form.quoteDate || sale.createdAt.slice(0, 10)}</td>
                    <td>{customer?.name ?? "-"}</td>
                    <td>{quote?.form.projectName ?? "-"}</td>
                    <td>{money(sale.amount)}원</td>
                    <td>{money(sale.paidAmount)}원</td>
                    <td>{money(remaining)}원</td>
                    <td><Status tone={sale.paymentStatus}>{payLabels[sale.paymentStatus]}</Status></td>
                    <td>
                      {sale.payments.length ? sale.payments.map((payment, index) => (
                        <span className="history-line" key={`${sale.id}-${index}`}>{payment.date} · {money(payment.amount)}원</span>
                      )) : <span className="muted">입금 없음</span>}
                    </td>
                    <td><button className="ghost" disabled={!remaining} onClick={() => openPayment(sale.id)}>수금 입력</button></td>
                  </tr>
                );
              })}
              {!filtered.length && <tr><td colSpan={9} className="empty">조건에 맞는 거래가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
