import { useMemo, useState } from "react";
import { HandCoins, Search, WalletCards } from "lucide-react";
import type { AppData, PaymentStatus } from "../types";
import { money } from "../lib/format";
import { today } from "../lib/date";
import { payLabels, purchasePayLabels } from "../constants";
import { Status } from "../components/Status";
import { SectionTitle } from "../components/SectionTitle";

type PaymentTarget = { kind: "sale" | "purchase"; id: string } | undefined;

export function Ledger({
  data,
  onPayment,
  onPurchasePayment
}: {
  data: AppData;
  onPayment: (saleId: string, amount: number, date: string) => void;
  onPurchasePayment: (purchaseId: string, amount: number, date: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [partyId, setPartyId] = useState("all");
  const [recordType, setRecordType] = useState<"all" | "sales" | "purchases">("all");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget>();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());

  const filteredSales = useMemo(() => data.sales.filter((sale) => {
    if (recordType === "purchases") return false;
    const quote = data.quotes.find((item) => item.id === sale.quoteId);
    const customer = data.customers.find((item) => item.id === sale.customerId);
    const recordDate = quote?.approvedAt || quote?.form.quoteDate || sale.createdAt.slice(0, 10);
    const haystack = `${customer?.name ?? ""} ${quote?.form.projectName ?? ""} ${quote?.id ?? ""}`.toLocaleLowerCase();
    if (query && !haystack.includes(query.toLocaleLowerCase())) return false;
    if (partyId !== "all" && partyId !== `customer:${sale.customerId}`) return false;
    if (paymentStatus !== "all" && sale.paymentStatus !== paymentStatus) return false;
    if (dateFrom && recordDate < dateFrom) return false;
    if (dateTo && recordDate > dateTo) return false;
    return true;
  }), [data.customers, data.quotes, data.sales, dateFrom, dateTo, partyId, paymentStatus, query, recordType]);

  const filteredPurchases = useMemo(() => data.purchases.filter((purchase) => {
    if (recordType === "sales") return false;
    const vendor = data.vendors.find((item) => item.id === purchase.vendorId);
    const quote = data.quotes.find((item) => item.id === purchase.relatedQuoteId);
    const recordDate = purchase.purchaseDate || purchase.createdAt.slice(0, 10);
    const haystack = `${vendor?.name ?? ""} ${quote?.form.projectName ?? ""} ${purchase.items.map((item) => `${item.category} ${item.description}`).join(" ")}`.toLocaleLowerCase();
    if (query && !haystack.includes(query.toLocaleLowerCase())) return false;
    if (partyId !== "all" && partyId !== `vendor:${purchase.vendorId}`) return false;
    if (paymentStatus !== "all" && purchase.paymentStatus !== paymentStatus) return false;
    if (dateFrom && recordDate < dateFrom) return false;
    if (dateTo && recordDate > dateTo) return false;
    return true;
  }), [data.purchases, data.quotes, data.vendors, dateFrom, dateTo, partyId, paymentStatus, query, recordType]);

  const totals = {
    sales: filteredSales.reduce((sum, sale) => sum + sale.amount, 0),
    paid: filteredSales.reduce((sum, sale) => sum + sale.paidAmount, 0),
    purchases: filteredPurchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0),
    purchasePaid: filteredPurchases.reduce((sum, purchase) => sum + purchase.payments.reduce((total, payment) => total + payment.amount, 0), 0)
  };

  const activeRecord = paymentTarget?.kind === "sale"
    ? data.sales.find((sale) => sale.id === paymentTarget.id)
    : paymentTarget?.kind === "purchase"
      ? data.purchases.find((purchase) => purchase.id === paymentTarget.id)
      : undefined;
  const activePaid = activeRecord
    ? activeRecord.payments.reduce((sum, payment) => sum + payment.amount, 0)
    : 0;
  const activeRemaining = activeRecord ? Math.max(0, ("amount" in activeRecord ? activeRecord.amount : activeRecord.totalAmount) - activePaid) : 0;

  const openPayment = (target: NonNullable<PaymentTarget>, remaining: number) => {
    setPaymentTarget(target);
    setPaymentAmount(String(remaining));
    setPaymentDate(today());
  };

  const submitPayment = () => {
    if (!paymentTarget) return;
    const amount = Math.min(Number(paymentAmount), activeRemaining);
    if (!amount || amount < 1 || !paymentDate) return;
    if (paymentTarget.kind === "sale") onPayment(paymentTarget.id, amount, paymentDate);
    else onPurchasePayment(paymentTarget.id, amount, paymentDate);
    setPaymentTarget(undefined);
    setPaymentAmount("");
  };

  const rows = [
    ...filteredSales.map((sale) => {
      const quote = data.quotes.find((item) => item.id === sale.quoteId);
      const customer = data.customers.find((item) => item.id === sale.customerId);
      return {
        key: sale.id,
        date: quote?.approvedAt || quote?.form.quoteDate || sale.createdAt.slice(0, 10),
        type: "매출",
        party: customer?.name ?? "-",
        description: quote?.form.projectName ?? "-",
        sale: sale.amount,
        paid: sale.paidAmount,
        unpaid: Math.max(0, sale.amount - sale.paidAmount),
        purchase: 0,
        purchasePaid: 0,
        purchaseUnpaid: 0,
        status: <Status tone={sale.paymentStatus}>{payLabels[sale.paymentStatus]}</Status>,
        history: sale.payments,
        action: <button className="ghost" disabled={sale.paymentStatus === "paid"} onClick={() => openPayment({ kind: "sale", id: sale.id }, Math.max(0, sale.amount - sale.paidAmount))}>수금 입력</button>
      };
    }),
    ...filteredPurchases.map((purchase) => {
      const vendor = data.vendors.find((item) => item.id === purchase.vendorId);
      const paid = purchase.payments.reduce((sum, payment) => sum + payment.amount, 0);
      return {
        key: purchase.id,
        date: purchase.purchaseDate || purchase.createdAt.slice(0, 10),
        type: "매입",
        party: vendor?.name ?? "-",
        description: purchase.items.map((item) => item.description).join(", ") || "-",
        sale: 0,
        paid: 0,
        unpaid: 0,
        purchase: purchase.totalAmount,
        purchasePaid: paid,
        purchaseUnpaid: Math.max(0, purchase.totalAmount - paid),
        status: <Status tone={purchase.paymentStatus}>{purchasePayLabels[purchase.paymentStatus]}</Status>,
        history: purchase.payments,
        action: <button className="ghost" disabled={purchase.paymentStatus === "paid"} onClick={() => openPayment({ kind: "purchase", id: purchase.id }, Math.max(0, purchase.totalAmount - paid))}>지급 입력</button>
      };
    })
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section className="ledger-page">
      <div className="panel">
        <SectionTitle title="통합 거래처 원장" hint="매출·입금·미수와 매입·지급·미지급을 같은 기준으로 조회합니다." />
        <div className="filter-bar">
          <div className="search">
            <Search size={17} />
            <input aria-label="원장 검색" placeholder="거래처, 프로젝트, 품목 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <select aria-label="거래 구분" value={recordType} onChange={(event) => setRecordType(event.target.value as typeof recordType)}>
            <option value="all">매출·매입 전체</option><option value="sales">매출만</option><option value="purchases">매입만</option>
          </select>
          <select aria-label="거래처 필터" value={partyId} onChange={(event) => setPartyId(event.target.value)}>
            <option value="all">모든 거래처</option>
            <optgroup label="고객">{data.customers.map((customer) => <option key={customer.id} value={`customer:${customer.id}`}>{customer.name}</option>)}</optgroup>
            <optgroup label="매입처">{data.vendors.map((vendor) => <option key={vendor.id} value={`vendor:${vendor.id}`}>{vendor.name}</option>)}</optgroup>
          </select>
          <select aria-label="원장 정산 상태" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus | "all")}>
            <option value="all">모든 정산 상태</option><option value="unpaid">미수·미지급</option><option value="partial">부분 정산</option><option value="paid">완납</option>
          </select>
          <input aria-label="원장 시작일" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <input aria-label="원장 종료일" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>
        <div className="kpis ledger-kpis">
          <div className="kpi"><span>매출</span><strong>{money(totals.sales)}원</strong></div>
          <div className="kpi"><span>입금</span><strong>{money(totals.paid)}원</strong></div>
          <div className="kpi"><span>미수</span><strong>{money(totals.sales - totals.paid)}원</strong></div>
          <div className="kpi"><span>매입</span><strong>{money(totals.purchases)}원</strong></div>
          <div className="kpi"><span>지급</span><strong>{money(totals.purchasePaid)}원</strong></div>
          <div className="kpi"><span>미지급</span><strong>{money(totals.purchases - totals.purchasePaid)}원</strong></div>
        </div>
      </div>

      {paymentTarget && activeRecord && (
        <div className="panel payment-entry">
          <SectionTitle title={paymentTarget.kind === "sale" ? "부분 수금 입력" : "부분 지급 입력"} hint="실제 거래일과 금액이 원장과 대시보드에 즉시 반영됩니다." />
          <div className="grid payment-grid">
            <label>{paymentTarget.kind === "sale" ? "입금일" : "지급일"}<input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
            <label>{paymentTarget.kind === "sale" ? "입금액" : "지급액"}<input type="number" min="1" max={activeRemaining} value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label>
            <div className="actions">
              <button disabled={!paymentDate || Number(paymentAmount) < 1} onClick={submitPayment}>{paymentTarget.kind === "sale" ? <HandCoins size={16} /> : <WalletCards size={16} />} 반영</button>
              <button className="ghost" onClick={() => setPaymentTarget(undefined)}>취소</button>
            </div>
          </div>
        </div>
      )}

      <div className="panel ledger-table">
        <div className="table-wrap">
          <table>
            <thead><tr><th>일자</th><th>구분</th><th>거래처</th><th>내용</th><th>매출</th><th>입금</th><th>미수</th><th>매입</th><th>지급</th><th>미지급</th><th>상태</th><th>내역</th><th></th></tr></thead>
            <tbody>
              {rows.map((row) => <tr key={row.key}>
                <td>{row.date}</td><td>{row.type}</td><td>{row.party}</td><td>{row.description}</td>
                <td>{row.sale ? `${money(row.sale)}원` : "-"}</td><td>{row.paid ? `${money(row.paid)}원` : "-"}</td><td>{row.unpaid ? `${money(row.unpaid)}원` : "-"}</td>
                <td>{row.purchase ? `${money(row.purchase)}원` : "-"}</td><td>{row.purchasePaid ? `${money(row.purchasePaid)}원` : "-"}</td><td>{row.purchaseUnpaid ? `${money(row.purchaseUnpaid)}원` : "-"}</td>
                <td>{row.status}</td><td>{row.history.length ? row.history.map((payment, index) => <span className="history-line" key={`${row.key}-${index}`}>{payment.date} · {money(payment.amount)}원</span>) : <span className="muted">내역 없음</span>}</td><td>{row.action}</td>
              </tr>)}
              {!rows.length && <tr><td colSpan={13} className="empty">조건에 맞는 거래가 없습니다.</td></tr>}
            </tbody>
            {!!rows.length && <tfoot><tr><th colSpan={4}>조회 합계</th><th>{money(totals.sales)}원</th><th>{money(totals.paid)}원</th><th>{money(totals.sales - totals.paid)}원</th><th>{money(totals.purchases)}원</th><th>{money(totals.purchasePaid)}원</th><th>{money(totals.purchases - totals.purchasePaid)}원</th><th colSpan={3}></th></tr></tfoot>}
          </table>
        </div>
      </div>
    </section>
  );
}
