import React from "react";
import {
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  HandCoins,
  ReceiptText,
  Settings,
  Settings2,
  Users
} from "lucide-react";
import type { InvoicePreference, PaymentStatus, QuoteStatus } from "./types";

export type View = "quote" | "quotes" | "issue" | "customers" | "vendors" | "ledger" | "items" | "dashboard" | "billing" | "settings";

export const nav: { id: View; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "quote", label: "견적 생성", icon: FileText },
  { id: "quotes", label: "견적 목록", icon: ClipboardList },
  { id: "issue", label: "승인·발행", icon: ReceiptText },
  { id: "customers", label: "고객 관리", icon: Users },
  { id: "vendors", label: "매입처 관리", icon: Building2 },
  { id: "ledger", label: "거래처 원장", icon: HandCoins },
  { id: "items", label: "품목 현황", icon: Settings2 },
  { id: "dashboard", label: "대시보드", icon: BarChart3 },
  { id: "billing", label: "요금·크레딧", icon: CreditCard },
  { id: "settings", label: "설정", icon: Settings }
];

export const statusLabels: Record<QuoteStatus, string> = {
  draft: "작성중",
  delivered: "전달완료",
  approved: "승인",
  on_hold: "보류",
  cancelled: "취소"
};

export const payLabels: Record<PaymentStatus, string> = {
  unpaid: "미수",
  partial: "부분수금",
  paid: "완납"
};

export const purchasePayLabels: Record<PaymentStatus, string> = {
  unpaid: "미지급",
  partial: "부분지급",
  paid: "완납"
};

export const invoiceLabels: Record<InvoicePreference, string> = {
  tax_invoice_auto: "세금계산서 자동",
  tax_invoice_manual: "세금계산서 수동",
  invoice: "청구서",
  cash_receipt: "현금영수증"
};
