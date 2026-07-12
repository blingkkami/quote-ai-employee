import React, { useState } from "react";
import { Plus, Trash2, WalletCards } from "lucide-react";
import type { AppData, PurchaseRecord, Vendor } from "../types";
import { uid } from "../lib/id";
import { money } from "../lib/format";
import { today } from "../lib/date";
import { payLabels } from "../constants";
import { Status } from "../components/Status";
import { SectionTitle } from "../components/SectionTitle";

export function VendorManager({ data, setData }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>> }) {
  const [activeVendorId, setActiveVendorId] = useState(data.vendors[0]?.id ?? "");
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
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false);

  const activeVendor = data.vendors.find((vendor) => vendor.id === activeVendorId) ?? data.vendors[0];
  const purchases = data.purchases.filter((purchase) => purchase.vendorId === activeVendor?.id);
  const payingPurchase = data.purchases.find((purchase) => purchase.id === payingPurchaseId);

  const openCreateVendor = () => {
    setEditingVendorId(null);
    setVendorName("");
    setVendorBusinessNumber("");
    setVendorContactPerson("");
    setVendorContact("");
    setVendorFormOpen(true);
  };

  const openEditVendor = (vendor: Vendor) => {
    setEditingVendorId(vendor.id);
    setVendorName(vendor.name);
    setVendorBusinessNumber(vendor.businessNumber ?? "");
    setVendorContactPerson(vendor.contactPerson ?? "");
    setVendorContact(vendor.contact ?? "");
    setVendorFormOpen(true);
  };

  const saveVendor = () => {
    if (!vendorName.trim()) return;
    const patch = {
      name: vendorName.trim(),
      businessNumber: vendorBusinessNumber.trim() || undefined,
      contactPerson: vendorContactPerson.trim() || undefined,
      contact: vendorContact.trim() || undefined
    };
    if (editingVendorId) {
      patchVendor(editingVendorId, patch);
    } else {
      const now = new Date().toISOString();
      const vendor: Vendor = { id: uid("ven"), ...patch, hasPurchaseTransaction: false, createdAt: now, updatedAt: now };
      setData((prev) => ({ ...prev, vendors: [vendor, ...prev.vendors] }));
      setActiveVendorId(vendor.id);
    }
    setVendorFormOpen(false);
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
    const remaining = data.vendors.filter((item) => item.id !== vendor.id);
    setData((prev) => ({ ...prev, vendors: prev.vendors.filter((item) => item.id !== vendor.id) }));
    setActiveVendorId(remaining[0]?.id ?? "");
  };

  const addPurchase = () => {
    const numericAmount = Number(amount);
    if (!activeVendor || !description.trim() || numericAmount < 1) return;
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
    if (nextAmount < 1) return;
    setData((prev) => ({
      ...prev,
      purchases: prev.purchases.map((purchase) => {
        if (purchase.id !== payingPurchase.id) return purchase;
        const payments = [...purchase.payments, { date: paymentDate, amount: nextAmount }];
        const paidTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
        return { ...purchase, payments, paymentStatus: paidTotal >= purchase.totalAmount ? "paid" : "partial", updatedAt: new Date().toISOString() };
      })
    }));
    setPayingPurchaseId("");
    setPaymentAmount("");
  };

  return (
    <section className="vendor-page">
      <div className="panel">
        <div className="toolbar vendor-head">
          <SectionTitle title="매입처" hint="외주·인쇄·제작비 거래처와 실제 매입 기록을 함께 관리합니다." />
          <button onClick={openCreateVendor}><Plus size={17} /> 매입처 추가</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>매입처</th><th>사업자번호</th><th>담당자</th><th>연락처</th><th>매입 건수</th><th></th></tr></thead>
            <tbody>
              {data.vendors.map((vendor) => (
                <tr key={vendor.id} className={vendor.id === activeVendor?.id ? "selected-row" : ""}>
                  <td><button className="link" onClick={() => setActiveVendorId(vendor.id)}>{vendor.name}</button></td>
                  <td>{vendor.businessNumber || "-"}</td>
                  <td>{vendor.contactPerson || "-"}</td>
                  <td>{vendor.contact || "-"}</td>
                  <td>{data.purchases.filter((purchase) => purchase.vendorId === vendor.id).length}건</td>
                  <td><div className="row-actions"><button className="ghost" onClick={() => openEditVendor(vendor)}>수정</button><button className="icon danger" aria-label="매입처 삭제" title="매입처 삭제" onClick={() => deleteVendor(vendor)}><Trash2 size={15} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {vendorFormOpen && (
        <div className="panel">
          <SectionTitle title={editingVendorId ? "매입처 수정" : "새 매입처"} />
          <div className="grid two">
            <label>매입처명<input placeholder="매입처명을 입력하세요" value={vendorName} onChange={(event) => setVendorName(event.target.value)} /></label>
            <label>사업자번호<input value={vendorBusinessNumber} onChange={(event) => setVendorBusinessNumber(event.target.value)} /></label>
            <label>담당자<input value={vendorContactPerson} onChange={(event) => setVendorContactPerson(event.target.value)} /></label>
            <label>연락처<input value={vendorContact} onChange={(event) => setVendorContact(event.target.value)} /></label>
          </div>
          <div className="actions">
            <button disabled={!vendorName.trim()} onClick={saveVendor}>저장</button>
            <button className="ghost" onClick={() => setVendorFormOpen(false)}>취소</button>
          </div>
        </div>
      )}

      {activeVendor && (
        <>
          {purchaseFormOpen && (
          <div className="panel purchase-entry">
            <div className="toolbar">
              <SectionTitle title={`${activeVendor.name} 매입 입력`} hint="견적과 연결하면 품목·수익 분석에 함께 반영됩니다." />
              <button className="ghost" onClick={() => setPurchaseFormOpen(false)}>취소</button>
            </div>
            <div className="purchase-form">
              <label>매입일<input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} /></label>
              <label>연결 견적<select value={relatedQuoteId} onChange={(event) => setRelatedQuoteId(event.target.value)}><option value="">연결 안 함</option>{data.quotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.form.projectName || quote.id}</option>)}</select></label>
              <label>구분<input placeholder="예: 인쇄, 외주" value={category} onChange={(event) => setCategory(event.target.value)} /></label>
              <label className="purchase-description">내용<input placeholder="매입 내용을 입력하세요" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
              <label>금액<input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
              <button disabled={!description.trim() || Number(amount) < 1} onClick={addPurchase}><Plus size={16} /> 매입 저장</button>
            </div>
          </div>
          )}

          {payingPurchase && (
            <div className="panel payment-entry">
              <SectionTitle title="지급 입력" hint="실제 지급일과 금액을 입력합니다." />
              <div className="grid payment-grid">
                <label>지급일<input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
                <label>지급액<input type="number" min="1" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label>
                <div className="actions"><button onClick={submitPayment}><WalletCards size={16} /> 지급 반영</button><button className="ghost" onClick={() => setPayingPurchaseId("")}>취소</button></div>
              </div>
            </div>
          )}

          <div className="panel">
            <div className="toolbar vendor-head">
              <SectionTitle title={`${activeVendor.name} 매입 내역`} hint="견적과 연결하면 품목·수익 분석에 함께 반영됩니다." />
              <button onClick={() => setPurchaseFormOpen(true)}><Plus size={17} /> 매입 입력</button>
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
                        <td>{money(purchase.totalAmount - paid)}원</td>
                        <td><Status tone={purchase.paymentStatus}>{payLabels[purchase.paymentStatus]}</Status></td>
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
