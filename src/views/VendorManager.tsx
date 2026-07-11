import React from "react";
import { Plus } from "lucide-react";
import type { AppData, PurchaseRecord, Vendor } from "../types";
import { uid } from "../lib/id";
import { Editable } from "../components/Editable";
import { DataTable } from "../components/DataTable";

export function VendorManager({ data, setData }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>> }) {
  const addVendor = () => {
    const now = new Date().toISOString();
    setData((prev) => ({
      ...prev,
      vendors: [{ id: uid("ven"), name: "신규 매입처", hasPurchaseTransaction: false, createdAt: now, updatedAt: now }, ...prev.vendors]
    }));
  };
  const patchVendor = (id: string, patch: Partial<Vendor>) => {
    setData((prev) => ({
      ...prev,
      vendors: prev.vendors.map((item) => (item.id === id ? { ...item, ...patch } : item))
    }));
  };
  const addPurchase = (vendorId: string) => {
    const now = new Date().toISOString();
    const record: PurchaseRecord = {
      id: uid("pur"),
      vendorId,
      items: [{ category: "외주", description: "매입 항목", price: 0 }],
      totalAmount: 0,
      paymentStatus: "unpaid",
      payments: [],
      createdAt: now,
      updatedAt: now
    };
    setData((prev) => ({
      ...prev,
      vendors: prev.vendors.map((vendor) => (vendor.id === vendorId ? { ...vendor, hasPurchaseTransaction: true, updatedAt: now } : vendor)),
      purchases: [record, ...prev.purchases]
    }));
  };
  return (
    <section className="panel">
      <div className="toolbar">
        <button onClick={addVendor}><Plus size={17} /> 매입처 추가</button>
      </div>
      <DataTable
        headers={["매입처", "사업자번호", "담당자", "거래 여부", "매입 기록"]}
        rows={data.vendors.map((vendor) => [
          <Editable key="name" value={vendor.name} onChange={(value) => patchVendor(vendor.id, { name: value })} />,
          <Editable key="biz" value={vendor.businessNumber ?? ""} onChange={(value) => patchVendor(vendor.id, { businessNumber: value })} />,
          <Editable key="person" value={vendor.contactPerson ?? ""} onChange={(value) => patchVendor(vendor.id, { contactPerson: value })} />,
          vendor.hasPurchaseTransaction ? "있음" : "없음",
          <button key="purchase" className="ghost" onClick={() => addPurchase(vendor.id)}>매입 추가</button>
        ])}
      />
    </section>
  );
}
