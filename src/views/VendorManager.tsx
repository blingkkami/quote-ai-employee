import React, { useState } from "react";
import { Building2, Pencil, Phone, Plus, Search, Trash2, UserRound, WalletCards, X } from "lucide-react";
import type { AppData, PurchaseRecord, Vendor } from "../types";
import { uid } from "../lib/id";
import { money } from "../lib/format";
import { today } from "../lib/date";
import { purchasePayLabels } from "../constants";
import { Status } from "../components/Status";
import { SectionTitle } from "../components/SectionTitle";
import { Input } from "../components/Input";
import { AddressInput } from "../components/AddressInput";
import { TextArea } from "../components/TextArea";
import { formatBusinessNumber, formatPhoneNumber } from "../lib/input-format";

export function VendorManager({ data, setData }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>> }) {
  const [activeVendorId, setActiveVendorId] = useState<string | null>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [relatedQuoteId, setRelatedQuoteId] = useState("");
  const [payingPurchaseId, setPayingPurchaseId] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [vendorFormOpen, setVendorFormOpen] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState("");
  const [vendorBusinessNumber, setVendorBusinessNumber] = useState("");
  const [vendorContactPerson, setVendorContactPerson] = useState("");
  const [vendorContact, setVendorContact] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");
  const [vendorMemo, setVendorMemo] = useState("");
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false);

  const activeVendor = activeVendorId
    ? data.vendors.find((vendor) => vendor.id === activeVendorId)
    : undefined;
  const purchases = data.purchases
    .filter((purchase) => purchase.vendorId === activeVendor?.id)
    .sort((left, right) => (right.purchaseDate || right.createdAt).localeCompare(left.purchaseDate || left.createdAt));
  const payingPurchase = data.purchases.find((purchase) => purchase.id === payingPurchaseId);
  const filteredVendors = data.vendors.filter((vendor) =>
    `${vendor.name} ${vendor.businessNumber ?? ""} ${vendor.contactPerson ?? ""} ${vendor.contact ?? ""} ${vendor.address ?? ""}`
      .toLocaleLowerCase()
      .includes(vendorSearch.trim().toLocaleLowerCase())
  );
  const purchaseTotal = purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
  const paidTotal = purchases.reduce(
    (sum, purchase) => sum + purchase.payments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0),
    0
  );
  const unpaidTotal = Math.max(0, purchaseTotal - paidTotal);
  const editingActiveVendor = Boolean(activeVendor && vendorFormOpen && editingVendorId === activeVendor.id);

  const resetVendorForm = () => {
    setVendorName("");
    setVendorBusinessNumber("");
    setVendorContactPerson("");
    setVendorContact("");
    setVendorAddress("");
    setVendorMemo("");
  };

  const closeVendorForm = () => {
    setVendorFormOpen(false);
    setEditingVendorId(null);
  };

  const openCreateVendor = () => {
    setEditingVendorId(null);
    resetVendorForm();
    setVendorFormOpen(true);
  };

  const openVendor = (vendor: Vendor) => {
    setActiveVendorId(vendor.id);
    setVendorFormOpen(false);
    setEditingVendorId(null);
    setPurchaseFormOpen(false);
    setPayingPurchaseId("");
  };

  const openEditVendor = (vendor: Vendor) => {
    setEditingVendorId(vendor.id);
    setVendorName(vendor.name);
    setVendorBusinessNumber(vendor.businessNumber ?? "");
    setVendorContactPerson(vendor.contactPerson ?? "");
    setVendorContact(vendor.contact ?? "");
    setVendorAddress(vendor.address ?? "");
    setVendorMemo(vendor.memo ?? "");
    setVendorFormOpen(true);
  };

  const saveVendor = () => {
    if (!vendorName.trim()) return;
    const patch = {
      name: vendorName.trim(),
      businessNumber: vendorBusinessNumber.trim() || undefined,
      contactPerson: vendorContactPerson.trim() || undefined,
      contact: vendorContact.trim() || undefined,
      address: vendorAddress.trim() || undefined,
      memo: vendorMemo.trim() || undefined
    };
    if (editingVendorId) {
      patchVendor(editingVendorId, patch);
    } else {
      const now = new Date().toISOString();
      const vendor: Vendor = { id: uid("ven"), ...patch, hasPurchaseTransaction: false, createdAt: now, updatedAt: now };
      setData((prev) => ({ ...prev, vendors: [vendor, ...prev.vendors] }));
      setActiveVendorId(vendor.id);
    }
    closeVendorForm();
  };

  const patchVendor = (id: string, patch: Partial<Vendor>) => {
    setData((prev) => ({
      ...prev,
      vendors: prev.vendors.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item))
    }));
  };

  const deleteVendor = (vendor: Vendor) => {
    if (data.purchases.some((purchase) => purchase.vendorId === vendor.id)) {
      window.alert("매입 기록을 먼저 삭제해야 매입처를 삭제할 수 있습니다.");
      return;
    }
    if (!window.confirm(`'${vendor.name}' 매입처를 삭제할까요?`)) return;
    setData((prev) => ({ ...prev, vendors: prev.vendors.filter((item) => item.id !== vendor.id) }));
    setActiveVendorId(null);
    closeVendorForm();
  };

  const closeVendorDetail = () => {
    setActiveVendorId(null);
    setPurchaseFormOpen(false);
    setPayingPurchaseId("");
    closeVendorForm();
  };

  const addPurchase = () => {
    const numericAmount = Number(amount);
    if (!activeVendor || !purchaseDate || !description.trim() || !Number.isFinite(numericAmount) || numericAmount < 1) return;
    const now = new Date().toISOString();
    const record: PurchaseRecord = {
      id: uid("pur"),
      vendorId: activeVendor.id,
      relatedQuoteId: relatedQuoteId || undefined,
      purchaseDate,
      items: [{ category: category.trim() || "매입", description: description.trim(), price: numericAmount }],
      totalAmount: numericAmount,
      paymentStatus: "unpaid",
      payments: [],
      createdAt: now,
      updatedAt: now
    };
    setData((prev) => ({
      ...prev,
      vendors: prev.vendors.map((vendor) => vendor.id === activeVendor.id ? { ...vendor, hasPurchaseTransaction: true, updatedAt: now } : vendor),
      purchases: [record, ...prev.purchases]
    }));
    setCategory("");
    setDescription("");
    setAmount("");
    setRelatedQuoteId("");
    setPurchaseFormOpen(false);
  };

  const deletePurchase = (purchase: PurchaseRecord) => {
    if (!window.confirm("이 매입 기록과 지급 내역을 삭제할까요?")) return;
    setData((prev) => {
      const nextPurchases = prev.purchases.filter((item) => item.id !== purchase.id);
      return {
        ...prev,
        purchases: nextPurchases,
        vendors: prev.vendors.map((vendor) => vendor.id === purchase.vendorId
          ? { ...vendor, hasPurchaseTransaction: nextPurchases.some((item) => item.vendorId === vendor.id), updatedAt: new Date().toISOString() }
          : vendor)
      };
    });
  };

  const openPayment = (purchase: PurchaseRecord) => {
    const paid = purchase.payments.reduce((sum, payment) => sum + payment.amount, 0);
    setPayingPurchaseId(purchase.id);
    setPaymentDate(today());
    setPaymentAmount(String(Math.max(0, purchase.totalAmount - paid)));
  };

  const submitPayment = () => {
    if (!payingPurchase) return;
    const paid = payingPurchase.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const remaining = Math.max(0, payingPurchase.totalAmount - paid);
    const nextAmount = Math.min(Number(paymentAmount), remaining);
    if (!paymentDate || !Number.isFinite(nextAmount) || nextAmount < 1) return;
    setData((prev) => ({
      ...prev,
      purchases: prev.purchases.map((purchase) => {
        if (purchase.id !== payingPurchase.id) return purchase;
        const payments = [...purchase.payments, { date: paymentDate, amount: nextAmount }];
        const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
        return { ...purchase, payments, paymentStatus: paidAmount >= purchase.totalAmount ? "paid" : "partial", updatedAt: new Date().toISOString() };
      })
    }));
    setPayingPurchaseId("");
    setPaymentAmount("");
  };

  const vendorForm = (
    <>
      <div className="grid two">
        <Input label="매입처명" placeholder="매입처명을 입력하세요" value={vendorName} onChange={setVendorName} />
        <Input label="사업자번호" value={vendorBusinessNumber} inputMode="numeric" maxLength={12} format={formatBusinessNumber} onChange={setVendorBusinessNumber} />
        <Input label="담당자" value={vendorContactPerson} onChange={setVendorContactPerson} />
        <Input label="연락처" type="tel" value={vendorContact} inputMode="tel" maxLength={16} autoComplete="tel" format={formatPhoneNumber} onChange={setVendorContact} />
      </div>
      <AddressInput value={vendorAddress} onChange={setVendorAddress} />
      <TextArea label="매입처 메모" value={vendorMemo} onChange={setVendorMemo} />
      <div className="actions">
        <button disabled={!vendorName.trim()} onClick={saveVendor}>{editingVendorId ? "변경 저장" : "매입처 등록"}</button>
        <button className="ghost" onClick={closeVendorForm}>취소</button>
      </div>
    </>
  );

  return (
    <section className={`vendor-page ${activeVendor ? "vendor-detail-view" : "vendor-list-view"}`}>
      {!activeVendor && vendorFormOpen && (
        <div className="panel vendor-form-panel">
          <div className="toolbar vendor-head">
            <SectionTitle title="새 매입처" hint="기본 정보를 등록하면 매입 내역을 이어서 관리할 수 있습니다." />
            <button className="ghost" onClick={closeVendorForm}><X size={16} /> 등록 취소</button>
          </div>
          {vendorForm}
        </div>
      )}

      {!activeVendor && (
        <div className="panel vendor-list-panel">
          <div className="toolbar vendor-head">
            <SectionTitle title="전체 매입처" hint="매입처를 선택하면 업체 정보와 매입 내역이 열립니다." />
            <div className="vendor-list-tools">
              <div className="search">
                <Search size={17} />
                <input placeholder="매입처, 담당자, 사업자번호 검색" value={vendorSearch} onChange={(event) => setVendorSearch(event.target.value)} />
              </div>
              <button onClick={openCreateVendor}><Plus size={17} /> 매입처 추가</button>
            </div>
          </div>
          <div className="vendor-list-meta">
            <span>{vendorSearch ? "검색 결과" : "전체 매입처"}</span>
            <strong>{filteredVendors.length}곳</strong>
          </div>
          <div className="vendor-card-grid">
            {filteredVendors.map((vendor) => {
              const vendorPurchases = data.purchases.filter((purchase) => purchase.vendorId === vendor.id);
              const vendorPurchaseTotal = vendorPurchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
              const vendorPaidTotal = vendorPurchases.reduce(
                (sum, purchase) => sum + purchase.payments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0),
                0
              );
              const vendorUnpaidTotal = Math.max(0, vendorPurchaseTotal - vendorPaidTotal);
              const statusLabel = vendorUnpaidTotal > 0 ? "미지급" : vendorPurchases.length > 0 ? "정상" : "신규";
              const statusTone = vendorUnpaidTotal > 0 ? "unpaid" : vendorPurchases.length > 0 ? "paid" : "pending";
              return (
                <button key={vendor.id} className="vendor-card" onClick={() => openVendor(vendor)}>
                  <span className="vendor-card-head">
                    <strong>{vendor.name}</strong>
                    <Status tone={statusTone}>{statusLabel}</Status>
                  </span>
                  <span className="vendor-card-subline"><Building2 size={14} /> {vendor.businessNumber || "사업자번호 미입력"}</span>
                  <span className="vendor-card-subline"><UserRound size={14} /> {vendor.contactPerson || "담당자 미입력"}<i /><Phone size={14} /> {vendor.contact || "연락처 미입력"}</span>
                  <span className="vendor-card-metrics">
                    <span><small>매입</small><b>{money(vendorPurchaseTotal)}원</b></span>
                    <span><small>건수</small><b>{vendorPurchases.length}건</b></span>
                    <span><small>미지급</small><b>{money(vendorUnpaidTotal)}원</b></span>
                  </span>
                </button>
              );
            })}
            {!filteredVendors.length && (
              <div className="vendor-list-empty">
                <Building2 size={24} />
                <strong>{vendorSearch ? "검색된 매입처가 없습니다." : "등록된 매입처가 없습니다."}</strong>
                <span>{vendorSearch ? "검색어를 바꿔 다시 확인해 주세요." : "매입처를 추가하면 거래 내역과 미지급금을 함께 관리할 수 있습니다."}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {activeVendor && (
        <>
          <div className="panel vendor-profile">
            <div className="vendor-profile-head">
              <div className="vendor-profile-identity">
                <p>매입처 · {activeVendor.businessNumber || "사업자번호 미입력"}</p>
                <h2>{activeVendor.name}</h2>
                <span>{activeVendor.contactPerson || "담당자 미입력"} · {activeVendor.contact || "연락처 미입력"}</span>
              </div>
              <div className="vendor-profile-actions">
                {editingActiveVendor ? (
                  <button className="ghost" onClick={closeVendorForm}><X size={16} /> 편집 닫기</button>
                ) : (
                  <>
                    <Status tone={unpaidTotal > 0 ? "unpaid" : "paid"}>{unpaidTotal > 0 ? "지급 필요" : "정상"}</Status>
                    <button className="ghost" onClick={() => openEditVendor(activeVendor)}><Pencil size={16} /> 수정</button>
                    <button className="icon danger" aria-label="매입처 삭제" title="매입처 삭제" onClick={() => deleteVendor(activeVendor)}><Trash2 size={16} /></button>
                    <button className="ghost" onClick={closeVendorDetail}><X size={16} /> 닫기</button>
                  </>
                )}
              </div>
            </div>
            <div className="kpis mini vendor-kpis">
              <div className="kpi"><span>매입 누계</span><strong>{money(purchaseTotal)}원</strong></div>
              <div className="kpi"><span>지급 누계</span><strong>{money(paidTotal)}원</strong></div>
              <div className="kpi"><span>미지급금</span><strong>{money(unpaidTotal)}원</strong></div>
              <div className="kpi"><span>매입 건수</span><strong>{purchases.length}건</strong></div>
            </div>
            {editingActiveVendor ? (
              <div className="vendor-edit-form">{vendorForm}</div>
            ) : (
              <div className="vendor-info-grid">
                <div className="vendor-info-item"><span>사업자번호</span><strong>{activeVendor.businessNumber || "-"}</strong></div>
                <div className="vendor-info-item"><span>담당자</span><strong>{activeVendor.contactPerson || "-"}</strong></div>
                <div className="vendor-info-item"><span>연락처</span><strong>{activeVendor.contact || "-"}</strong></div>
                <div className="vendor-info-item"><span>거래 상태</span><strong>{activeVendor.hasPurchaseTransaction ? "매입 거래 있음" : "신규 매입처"}</strong></div>
                <div className="vendor-info-item wide"><span>주소</span><strong>{activeVendor.address || "-"}</strong></div>
                <div className="vendor-info-item wide"><span>매입처 메모</span><strong>{activeVendor.memo || "-"}</strong></div>
              </div>
            )}
          </div>

          {purchaseFormOpen && (
            <div className="panel purchase-entry">
              <div className="toolbar">
                <SectionTitle title="매입 등록" hint={`${activeVendor.name}의 실제 매입 내역을 입력합니다.`} />
                <button className="ghost" onClick={() => setPurchaseFormOpen(false)}><X size={16} /> 닫기</button>
              </div>
              <div className="purchase-form">
                <label>매입일<input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} /></label>
                <label>연결 견적<select value={relatedQuoteId} onChange={(event) => setRelatedQuoteId(event.target.value)}><option value="">연결 안 함</option>{data.quotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.form.projectName || quote.id}</option>)}</select></label>
                <label>구분<input placeholder="예: 인쇄, 외주" value={category} onChange={(event) => setCategory(event.target.value)} /></label>
                <label className="purchase-description">내용<input placeholder="매입 내용을 입력하세요" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
                <label>금액<input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
                <button disabled={!purchaseDate || !description.trim() || !Number.isFinite(Number(amount)) || Number(amount) < 1} onClick={addPurchase}><Plus size={16} /> 매입 저장</button>
              </div>
            </div>
          )}

          {payingPurchase && (
            <div className="panel payment-entry">
              <div className="toolbar">
                <SectionTitle title="지급 입력" hint="실제 지급일과 금액을 입력하면 미지급금에 즉시 반영됩니다." />
                <button className="ghost" onClick={() => setPayingPurchaseId("")}><X size={16} /> 닫기</button>
              </div>
              <div className="grid payment-grid">
                <label>지급일<input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
                <label>지급액<input type="number" min="1" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label>
                <div className="actions"><button disabled={!paymentDate || !Number.isFinite(Number(paymentAmount)) || Number(paymentAmount) < 1} onClick={submitPayment}><WalletCards size={16} /> 지급 반영</button></div>
              </div>
            </div>
          )}

          <div className="panel vendor-purchase-panel">
            <div className="toolbar vendor-head">
              <SectionTitle title="매입 내역" hint={`${activeVendor.name}의 매입과 지급 현황을 최신순으로 표시합니다.`} />
              <button onClick={() => setPurchaseFormOpen(true)}><Plus size={17} /> 매입 등록</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>매입일</th><th>연결 견적</th><th>구분</th><th>내용</th><th>매입액</th><th>지급액</th><th>미지급</th><th>상태</th><th></th></tr></thead>
                <tbody>
                  {purchases.map((purchase) => {
                    const paid = purchase.payments.reduce((sum, payment) => sum + payment.amount, 0);
                    const quote = data.quotes.find((item) => item.id === purchase.relatedQuoteId);
                    return (
                      <tr key={purchase.id}>
                        <td>{purchase.purchaseDate || purchase.createdAt.slice(0, 10)}</td>
                        <td>{quote?.form.projectName || "-"}</td>
                        <td>{purchase.items.map((item) => item.category).join(", ")}</td>
                        <td>{purchase.items.map((item) => item.description).join(", ")}</td>
                        <td>{money(purchase.totalAmount)}원</td>
                        <td>{money(paid)}원</td>
                        <td>{money(Math.max(0, purchase.totalAmount - paid))}원</td>
                        <td><Status tone={purchase.paymentStatus}>{purchasePayLabels[purchase.paymentStatus]}</Status></td>
                        <td><div className="row-actions"><button className="ghost" disabled={paid >= purchase.totalAmount} onClick={() => openPayment(purchase)}>지급 입력</button><button className="icon danger" aria-label="매입 삭제" title="매입 삭제" onClick={() => deletePurchase(purchase)}><Trash2 size={15} /></button></div></td>
                      </tr>
                    );
                  })}
                  {!purchases.length && <tr><td colSpan={9} className="empty">등록된 매입이 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
