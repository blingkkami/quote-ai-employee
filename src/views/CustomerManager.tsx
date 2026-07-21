import React, { useState } from "react";
import { Building2, Check, Landmark, LoaderCircle, Mail, Pencil, Phone, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import type { AppData, Customer, InvoicePreference } from "../types";
import { money } from "../lib/format";
import { quoteTotal } from "../lib/quote-calc";
import { uid } from "../lib/id";
import { invoiceLabels, payLabels, statusLabels } from "../constants";
import { SectionTitle } from "../components/SectionTitle";
import { Input } from "../components/Input";
import { AddressInput } from "../components/AddressInput";
import { TextArea } from "../components/TextArea";
import { Status } from "../components/Status";
import { formatBusinessNumber, formatPhoneNumber } from "../lib/input-format";
import { hasPaymentAccount, paymentAccountText } from "../lib/payment-account";
import type { UnpaidNoticeResult } from "../lib/unpaid-notice";

export function CustomerManager({ data, setData, onSendUnpaidNotice }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; onSendUnpaidNotice: (customerId: string) => Promise<UnpaidNoticeResult> }) {
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState<string | null>(null);
  const [returnCustomerId, setReturnCustomerId] = useState<string | null>(null);
  const [sendingUnpaidNotice, setSendingUnpaidNotice] = useState(false);
  const [unpaidNoticeMessage, setUnpaidNoticeMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const activeCustomer = activeCustomerId
    ? data.customers.find((customer) => customer.id === activeCustomerId)
    : undefined;
  const isCreatingCustomer = activeCustomer?.id === newCustomerId;
  const customerQuotes = data.quotes.filter((quote) => quote.customerId === activeCustomer?.id);
  const customerSales = data.sales.filter((sale) => sale.customerId === activeCustomer?.id);
  const customerUnpaidSales = customerSales.map((sale) => {
    const quote = data.quotes.find((item) => item.id === sale.quoteId);
    return { sale, quote, balance: Math.max(0, sale.amount - sale.paidAmount) };
  }).filter((item) => item.balance > 0);
  const unpaidTotal = customerUnpaidSales.reduce((sum, item) => sum + item.balance, 0);
  const unpaidAccountReady = data.workspaceProfile.paymentAccount.showOnUnpaidNotices && hasPaymentAccount(data.workspaceProfile);
  const filteredCustomers = data.customers.filter((customer) =>
    `${customer.name} ${customer.contactPerson} ${customer.businessNumber ?? ""} ${customer.contact} ${customer.email ?? ""}`.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const addCustomer = () => {
    if (newCustomerId && data.customers.some((customer) => customer.id === newCustomerId)) {
      setActiveCustomerId(newCustomerId);
      setEditMode(true);
      return;
    }
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
    setReturnCustomerId(activeCustomer?.id ?? null);
    setNewCustomerId(customer.id);
    setActiveCustomerId(customer.id);
    setEditMode(true);
  };
  const cancelCustomerRegistration = () => {
    if (!newCustomerId) return;
    const remaining = data.customers.filter((customer) => customer.id !== newCustomerId);
    const nextCustomerId = remaining.some((customer) => customer.id === returnCustomerId)
      ? returnCustomerId
      : remaining[0]?.id ?? null;
    setData((prev) => ({
      ...prev,
      customers: prev.customers.filter((customer) => customer.id !== newCustomerId)
    }));
    setNewCustomerId(null);
    setReturnCustomerId(null);
    setActiveCustomerId(nextCustomerId);
    setEditMode(false);
  };
  const completeCustomerRegistration = () => {
    if (!activeCustomer?.name.trim()) {
      window.alert("고객명을 입력해 주세요.");
      return;
    }
    setNewCustomerId(null);
    setReturnCustomerId(null);
    setEditMode(false);
  };
  const closeCustomerDetail = () => {
    setActiveCustomerId(null);
    setEditMode(false);
  };
  const sendCustomerUnpaidNotice = async () => {
    if (!activeCustomer || sendingUnpaidNotice) return;
    setSendingUnpaidNotice(true);
    setUnpaidNoticeMessage(null);
    try {
      const result = await onSendUnpaidNotice(activeCustomer.id);
      const sentAt = new Date().toISOString();
      patchCustomer(activeCustomer.id, {
        unpaidNoticeSentAt: sentAt,
        unpaidNoticeRecipient: result.recipient,
        unpaidNoticeAmount: result.totalAmount,
        unpaidNoticeEmailId: result.emailId,
        unpaidNoticeNote: result.message
      });
      setUnpaidNoticeMessage({ tone: "success", text: result.message || "미수금 안내를 발송했습니다." });
    } catch (error) {
      setUnpaidNoticeMessage({ tone: "danger", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSendingUnpaidNotice(false);
    }
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
    setData((prev) => ({ ...prev, customers: prev.customers.filter((item) => item.id !== customer.id) }));
    setActiveCustomerId(null);
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
    <section className={`crm ${activeCustomer ? "" : "list-only"}`}>
      <div className="crm-sidebar panel">
        <div className="toolbar">
          <div className="search">
            <Search size={17} />
            <input placeholder="고객, 담당자, 사업자번호 검색" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} />
          </div>
          <button onClick={addCustomer}><Plus size={17} /> 고객</button>
        </div>
        <div className="crm-list-meta">
          <span>{customerSearch ? "검색 결과" : "전체 고객"}</span>
          <strong>{filteredCustomers.length}명</strong>
        </div>
        <div className="crm-list">
          {filteredCustomers.map((customer) => {
            const quoteCount = data.quotes.filter((quote) => quote.customerId === customer.id).length;
            return (
              <button
                key={customer.id}
                className={`crm-card ${activeCustomer?.id === customer.id ? "active" : ""}`}
                onClick={() => {
                  if (newCustomerId && customer.id !== newCustomerId) {
                    window.alert("신규 고객 등록을 완료하거나 취소한 뒤 다른 고객을 선택해 주세요.");
                    return;
                  }
                  setActiveCustomerId(customer.id);
                  setEditMode(false);
                  setUnpaidNoticeMessage(null);
                }}
              >
                <span className="crm-card-head">
                  <strong>{customer.name}</strong>
                  <Status tone={toneFor(customer)}>{stageFor(customer)}</Status>
                </span>
                <span className="crm-card-subline"><Building2 size={14} /> {customer.businessNumber || "사업자번호 미입력"}</span>
                <span className="crm-card-subline"><UserRound size={14} /> {customer.contactPerson || "담당자 미입력"}<i /><Phone size={14} /> {customer.contact || "연락처 미입력"}</span>
                <span className="crm-metrics">
                  <span><small>누적 매출</small><b>{money(customer.totalSales)}원</b></span>
                  <span><small>견적</small><b>{quoteCount}건</b></span>
                  <span><small>미수금</small><b>{money(customer.unpaidAmount)}원</b></span>
                </span>
              </button>
            );
          })}
          {!filteredCustomers.length && (
            <div className="crm-list-empty">
              <Search size={20} />
              <span>{customerSearch ? "검색된 고객이 없습니다." : "등록된 고객이 없습니다."}</span>
            </div>
          )}
        </div>
      </div>
      {activeCustomer && (
        <div className="crm-detail">
          <div className="panel crm-profile">
            <div className="crm-profile-head">
              <div className="crm-profile-identity">
                <p>{stageFor(activeCustomer)} · {activeCustomer.businessNumber || "사업자번호 미입력"}</p>
                <h2>{activeCustomer.name}</h2>
                <span>{activeCustomer.contactPerson || "담당자 미입력"} · {activeCustomer.contact || "연락처 미입력"}</span>
              </div>
              <div className="crm-profile-actions">
                {editMode ? (
                  isCreatingCustomer ? (
                    <>
                      <button className="ghost" onClick={cancelCustomerRegistration}>
                        <X size={16} /> 등록 취소
                      </button>
                      <button onClick={completeCustomerRegistration}>
                        <Check size={16} /> 등록 완료
                      </button>
                    </>
                  ) : (
                    <button className="ghost" onClick={() => setEditMode(false)}>
                      <X size={16} /> 편집 닫기
                    </button>
                  )
                ) : (
                  <>
                    <Status tone={toneFor(activeCustomer)}>
                      {activeCustomer.unpaidAmount > 0 ? "수금 필요" : "정상"}
                    </Status>
                    <button className="ghost" onClick={() => setEditMode(true)}>
                      <Pencil size={16} /> 수정
                    </button>
                    <button className="icon danger" aria-label="고객 삭제" title="고객 삭제" onClick={() => deleteCustomer(activeCustomer)}>
                      <Trash2 size={16} />
                    </button>
                    <button className="ghost" onClick={closeCustomerDetail}>
                      <X size={16} /> 닫기
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="kpis mini">
              <div className="kpi"><span>누적 매출</span><strong>{money(activeCustomer.totalSales)}원</strong></div>
              <div className="kpi"><span>미수금</span><strong>{money(activeCustomer.unpaidAmount)}원</strong></div>
              <div className="kpi"><span>견적 수</span><strong>{customerQuotes.length}건</strong></div>
            </div>
            {editMode ? (
              <div className="customer-edit-form">
                <div className="customer-edit-section">
                  <h3>기본 정보</h3>
                  <div className="grid two">
                    <Input label="고객명" value={activeCustomer.name} onChange={(value) => patchCustomer(activeCustomer.id, { name: value })} />
                    <Input label="사업자번호" value={activeCustomer.businessNumber ?? ""} inputMode="numeric" maxLength={12} format={formatBusinessNumber} onChange={(value) => patchCustomer(activeCustomer.id, { businessNumber: value })} />
                    <Input label="대표자" value={activeCustomer.representativeName ?? ""} onChange={(value) => patchCustomer(activeCustomer.id, { representativeName: value })} />
                    <Input label="담당자" value={activeCustomer.contactPerson} onChange={(value) => patchCustomer(activeCustomer.id, { contactPerson: value })} />
                  </div>
                </div>
                <div className="customer-edit-section">
                  <h3>연락처</h3>
                  <div className="grid two">
                    <Input label="연락처" type="tel" value={activeCustomer.contact} inputMode="tel" maxLength={16} autoComplete="tel" format={formatPhoneNumber} onChange={(value) => patchCustomer(activeCustomer.id, { contact: value })} />
                    <Input label="이메일" type="email" value={activeCustomer.email ?? ""} autoComplete="email" onChange={(value) => patchCustomer(activeCustomer.id, { email: value })} />
                  </div>
                  <AddressInput value={activeCustomer.address ?? ""} onChange={(value) => patchCustomer(activeCustomer.id, { address: value })} />
                </div>
                <div className="customer-edit-section">
                  <h3>거래 설정</h3>
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
                </div>
              </div>
            ) : (
              <div className="customer-info-grid">
                <div className="customer-info-item"><span>사업자번호</span><strong>{activeCustomer.businessNumber || "-"}</strong></div>
                <div className="customer-info-item"><span>대표자</span><strong>{activeCustomer.representativeName || "-"}</strong></div>
                <div className="customer-info-item"><span>담당자</span><strong>{activeCustomer.contactPerson || "-"}</strong></div>
                <div className="customer-info-item"><span>연락처</span><strong>{activeCustomer.contact || "-"}</strong></div>
                <div className="customer-info-item"><span>이메일</span><strong>{activeCustomer.email || "-"}</strong></div>
                <div className="customer-info-item"><span>결제 주기</span><strong>{activeCustomer.paymentCycle === "monthly_batch" ? "월말 정산" : "건별 정산"}</strong></div>
                <div className="customer-info-item wide"><span>주소</span><strong>{activeCustomer.address || "-"}</strong></div>
                <div className="customer-info-item"><span>기본 발행 방식</span><strong>{invoiceLabels[activeCustomer.invoicePreference]}</strong></div>
                <div className="customer-info-item"><span>CRM 메모</span><strong>{activeCustomer.memo || "-"}</strong></div>
              </div>
            )}
          </div>
          <div className="panel crm-unpaid-panel">
            <div className="crm-unpaid-head">
              <SectionTitle title="미수금 내역" hint="저장된 매출과 수금액을 기준으로 자동 계산됩니다." />
              <button
                type="button"
                disabled={sendingUnpaidNotice || !customerUnpaidSales.length || !activeCustomer.email || !unpaidAccountReady}
                title={!activeCustomer.email ? "고객 이메일을 먼저 등록해 주세요." : !unpaidAccountReady ? "설정에서 미수금 안내용 입금계좌를 등록해 주세요." : !customerUnpaidSales.length ? "발송할 미수금이 없습니다." : "고객 이메일로 미수금 내역을 발송합니다."}
                onClick={() => void sendCustomerUnpaidNotice()}
              >
                {sendingUnpaidNotice ? <LoaderCircle className="spin" size={16} /> : <Mail size={16} />}
                {sendingUnpaidNotice ? "발송 중" : "미수금 안내 발송"}
              </button>
            </div>
            {customerUnpaidSales.length ? (
              <>
                <div className={`unpaid-account-strip ${unpaidAccountReady ? "" : "needs-setting"}`}>
                  <Landmark size={17} />
                  <span>입금계좌</span>
                  <strong>{unpaidAccountReady ? paymentAccountText(data.workspaceProfile) : "설정에서 계좌를 등록하고 미수금 안내 표시를 켜 주세요."}</strong>
                </div>
                <div className="table-wrap unpaid-table-wrap">
                  <table className="unpaid-table">
                    <thead><tr><th>발생일</th><th>거래</th><th>거래액</th><th>수금액</th><th>미수금</th></tr></thead>
                    <tbody>
                      {customerUnpaidSales.map(({ sale, quote, balance }) => (
                        <tr key={sale.id}>
                          <td>{String(quote?.approvedAt || quote?.form.quoteDate || sale.createdAt).slice(0, 10)}</td>
                          <td><strong>{quote?.form.projectName || "거래"}</strong></td>
                          <td>{money(sale.amount)}원</td>
                          <td>{money(sale.paidAmount)}원</td>
                          <td className="unpaid-amount">{money(balance)}원</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr><td colSpan={4}>총 미수금</td><td>{money(unpaidTotal)}원</td></tr></tfoot>
                  </table>
                </div>
              </>
            ) : <p className="empty unpaid-empty">현재 미수금이 없습니다.</p>}
            {activeCustomer.unpaidNoticeSentAt && (
              <p className="unpaid-notice-meta">최근 발송: {new Date(activeCustomer.unpaidNoticeSentAt).toLocaleString("ko-KR")} · {activeCustomer.unpaidNoticeRecipient} · {money(activeCustomer.unpaidNoticeAmount ?? 0)}원</p>
            )}
            {unpaidNoticeMessage && <p className={`form-notice ${unpaidNoticeMessage.tone}`}>{unpaidNoticeMessage.text}</p>}
          </div>
          <div className="panel crm-timeline-panel">
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
