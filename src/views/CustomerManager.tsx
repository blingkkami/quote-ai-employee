import React, { useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import type { AppData, Customer, InvoicePreference } from "../types";
import { money } from "../lib/format";
import { quoteTotal } from "../lib/quote-calc";
import { uid } from "../lib/id";
import { invoiceLabels, payLabels, statusLabels } from "../constants";
import { SectionTitle } from "../components/SectionTitle";
import { Input } from "../components/Input";
import { TextArea } from "../components/TextArea";
import { Status } from "../components/Status";

export function CustomerManager({ data, setData }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>> }) {
  const [activeCustomerId, setActiveCustomerId] = useState(data.customers[0]?.id ?? "");
  const [customerSearch, setCustomerSearch] = useState("");
  const [editMode, setEditMode] = useState(false);
  const activeCustomer = data.customers.find((customer) => customer.id === activeCustomerId) ?? data.customers[0];
  const customerQuotes = data.quotes.filter((quote) => quote.customerId === activeCustomer?.id);
  const customerSales = data.sales.filter((sale) => sale.customerId === activeCustomer?.id);
  const filteredCustomers = data.customers.filter((customer) =>
    `${customer.name} ${customer.contactPerson} ${customer.businessNumber ?? ""}`.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const addCustomer = () => {
    const now = new Date().toISOString();
    const customer: Customer = {
      id: uid("cus"),
      name: "신규 고객",
      contactPerson: "",
      contact: "",
      paymentCycle: "per_transaction",
      invoicePreference: "tax_invoice_auto",
      firstQuoteAt: "",
      lastQuoteAt: "",
      totalSales: 0,
      unpaidAmount: 0,
      createdAt: now,
      updatedAt: now
    };
    setData((prev) => ({
      ...prev,
      customers: [customer, ...prev.customers]
    }));
    setActiveCustomerId(customer.id);
    setEditMode(true);
  };
  const patchCustomer = (id: string, patch: Partial<Customer>) => {
    setData((prev) => ({
      ...prev,
      customers: prev.customers.map((customer) =>
        customer.id === id ? { ...customer, ...patch, updatedAt: new Date().toISOString() } : customer
      )
    }));
  };
  const deleteCustomer = (customer: Customer) => {
    const hasHistory = data.quotes.some((quote) => quote.customerId === customer.id) || data.sales.some((sale) => sale.customerId === customer.id);
    if (hasHistory) {
      window.alert("견적 또는 매출 이력이 있는 고객은 삭제할 수 없습니다. 연결된 견적을 먼저 정리해 주세요.");
      return;
    }
    if (!window.confirm(`'${customer.name}' 고객을 삭제할까요?`)) return;
    const remaining = data.customers.filter((item) => item.id !== customer.id);
    setData((prev) => ({ ...prev, customers: prev.customers.filter((item) => item.id !== customer.id) }));
    setActiveCustomerId(remaining[0]?.id ?? "");
  };
  const stageFor = (customer: Customer) => {
    if (customer.unpaidAmount > 0) return "미수 관리";
    if (customer.totalSales > 0) return "활성 고객";
    if (customer.memo?.includes("리드")) return "리드";
    return "신규";
  };
  const toneFor = (customer: Customer) =>
    customer.unpaidAmount > 0 ? "unpaid" : customer.totalSales > 0 ? "approved" : "pending";

  return (
    <section className="crm">
      <div className="crm-sidebar panel">
        <div className="toolbar">
          <div className="search">
            <Search size={17} />
            <input placeholder="고객, 담당자, 사업자번호 검색" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} />
          </div>
          <button onClick={addCustomer}><Plus size={17} /> 고객</button>
        </div>
        <div className="crm-list">
          {filteredCustomers.map((customer) => {
            const quoteCount = data.quotes.filter((quote) => quote.customerId === customer.id).length;
            return (
              <button key={customer.id} className={`crm-card ${activeCustomer?.id === customer.id ? "active" : ""}`} onClick={() => { setActiveCustomerId(customer.id); setEditMode(false); }}>
                <span className="crm-card-head">
                  <strong>{customer.name}</strong>
                  <Status tone={toneFor(customer)}>{stageFor(customer)}</Status>
                </span>
                <span>{customer.contactPerson || "담당자 미입력"} · {customer.contact || "연락처 미입력"}</span>
                <span className="crm-metrics">
                  <b>{money(customer.totalSales)}원</b>
                  <em>{quoteCount}건</em>
                  <em>미수 {money(customer.unpaidAmount)}원</em>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {activeCustomer && (
        <div className="crm-detail">
          <div className="panel crm-profile">
            <div className="crm-profile-head">
              <div>
                <p>{stageFor(activeCustomer)}</p>
                <h2>{activeCustomer.name}</h2>
              </div>
              <Status tone={toneFor(activeCustomer)}>
                {activeCustomer.unpaidAmount > 0 ? "수금 필요" : "정상"}
              </Status>
              <button className={editMode ? "" : "ghost"} onClick={() => setEditMode((prev) => !prev)}>
                {editMode ? "완료" : "수정"}
              </button>
              <button className="icon danger" aria-label="고객 삭제" title="고객 삭제" onClick={() => deleteCustomer(activeCustomer)}>
                <Trash2 size={16} />
              </button>
            </div>
            <div className="kpis mini">
              <div className="kpi"><span>누적 매출</span><strong>{money(activeCustomer.totalSales)}원</strong></div>
              <div className="kpi"><span>미수금</span><strong>{money(activeCustomer.unpaidAmount)}원</strong></div>
              <div className="kpi"><span>견적 수</span><strong>{customerQuotes.length}건</strong></div>
            </div>
            {editMode ? (
              <>
                <div className="grid two">
                  <Input label="고객명" value={activeCustomer.name} onChange={(value) => patchCustomer(activeCustomer.id, { name: value })} />
                  <Input label="사업자번호" value={activeCustomer.businessNumber ?? ""} onChange={(value) => patchCustomer(activeCustomer.id, { businessNumber: value })} />
                  <Input label="대표자" value={activeCustomer.representativeName ?? ""} onChange={(value) => patchCustomer(activeCustomer.id, { representativeName: value })} />
                  <Input label="담당자" value={activeCustomer.contactPerson} onChange={(value) => patchCustomer(activeCustomer.id, { contactPerson: value })} />
                  <Input label="연락처" value={activeCustomer.contact} onChange={(value) => patchCustomer(activeCustomer.id, { contact: value })} />
                  <Input label="이메일" value={activeCustomer.email ?? ""} onChange={(value) => patchCustomer(activeCustomer.id, { email: value })} />
                </div>
                <Input label="주소" value={activeCustomer.address ?? ""} onChange={(value) => patchCustomer(activeCustomer.id, { address: value })} />
                <div className="grid two">
                  <label>
                    결제 주기
                    <select value={activeCustomer.paymentCycle} onChange={(event) => patchCustomer(activeCustomer.id, { paymentCycle: event.target.value as Customer["paymentCycle"] })}>
                      <option value="per_transaction">건별 정산</option>
                      <option value="monthly_batch">월말 정산</option>
                    </select>
                  </label>
                  <label>
                    기본 발행 방식
                    <select value={activeCustomer.invoicePreference} onChange={(event) => patchCustomer(activeCustomer.id, { invoicePreference: event.target.value as InvoicePreference })}>
                      {Object.entries(invoiceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                </div>
                <TextArea label="CRM 메모" value={activeCustomer.memo ?? ""} onChange={(value) => patchCustomer(activeCustomer.id, { memo: value })} />
              </>
            ) : (
              <dl className="details">
                <dt>사업자번호</dt><dd>{activeCustomer.businessNumber || "-"}</dd>
                <dt>대표자</dt><dd>{activeCustomer.representativeName || "-"}</dd>
                <dt>담당자</dt><dd>{activeCustomer.contactPerson || "-"}</dd>
                <dt>연락처</dt><dd>{activeCustomer.contact || "-"}</dd>
                <dt>이메일</dt><dd>{activeCustomer.email || "-"}</dd>
                <dt>주소</dt><dd>{activeCustomer.address || "-"}</dd>
                <dt>결제 주기</dt><dd>{activeCustomer.paymentCycle === "monthly_batch" ? "월말 정산" : "건별 정산"}</dd>
                <dt>기본 발행 방식</dt><dd>{invoiceLabels[activeCustomer.invoicePreference]}</dd>
                <dt>CRM 메모</dt><dd>{activeCustomer.memo || "-"}</dd>
              </dl>
            )}
          </div>
          <div className="panel">
            <SectionTitle title="거래 타임라인" hint="견적, 승인, 수금 이력이 고객별로 모입니다." />
            <div className="timeline">
              {customerQuotes.map((quote) => (
                <div className="timeline-item" key={quote.id}>
                  <span>{new Date(quote.updatedAt).toLocaleDateString("ko-KR")}</span>
                  <strong>{quote.form.projectName || "제목 없음"}</strong>
                  <p>{statusLabels[quote.status]} · {money(quoteTotal(quote))}원 · {quote.invoiceIssuanceMode === "auto" ? "자동 발행" : "수동 발행"}</p>
                </div>
              ))}
              {customerSales.flatMap((sale) =>
                sale.payments.map((payment, index) => (
                  <div className="timeline-item payment" key={`${sale.id}-${index}`}>
                    <span>{payment.date}</span>
                    <strong>수금 {money(payment.amount)}원</strong>
                    <p>{payLabels[sale.paymentStatus]} 상태로 반영됨</p>
                  </div>
                ))
              )}
              {customerQuotes.length === 0 && customerSales.length === 0 && <p className="empty">아직 거래 이력이 없습니다.</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
