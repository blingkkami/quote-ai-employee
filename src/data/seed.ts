import type { AppData, Customer, PurchaseRecord, QuoteRecord, SaleRecord, Vendor } from "../types";
import { now, today } from "../lib/date";
import { initialQuoteForm } from "./quote-defaults";

const seedCustomers: Customer[] = [
  {
    id: "cus_seed_1",
    name: "누보 스킨랩",
    businessNumber: "123-45-67890",
    representativeName: "김누보",
    address: "서울시 강남구 테헤란로 100",
    contactPerson: "박매니저",
    contact: "010-1234-7788",
    email: "hello@nuvoskin.example",
    paymentCycle: "per_transaction",
    invoicePreference: "tax_invoice_auto",
    memo: "상세페이지 촬영 및 AI 보정 정기 의뢰",
    firstQuoteAt: today(),
    lastQuoteAt: today(),
    totalSales: 0,
    unpaidAmount: 0,
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: "cus_seed_2",
    name: "라온 리빙",
    businessNumber: "234-56-78901",
    representativeName: "이라온",
    address: "경기도 성남시 분당구 판교로 55",
    contactPerson: "최MD",
    contact: "010-5521-9012",
    email: "md@raonliving.example",
    paymentCycle: "monthly_batch",
    invoicePreference: "tax_invoice_manual",
    memo: "월말 정산 선호",
    firstQuoteAt: today(),
    lastQuoteAt: today(),
    totalSales: 0,
    unpaidAmount: 0,
    createdAt: now(),
    updatedAt: now()
  }
];

const seedVendors: Vendor[] = [
  {
    id: "ven_seed_1",
    name: "프린트온",
    businessNumber: "345-67-89012",
    contactPerson: "인쇄팀",
    contact: "02-111-2222",
    hasPurchaseTransaction: true,
    memo: "출력/소량 패키지 제작",
    createdAt: now(),
    updatedAt: now()
  }
];

const seedQuotes: QuoteRecord[] = [
  {
    id: "quo_seed_1",
    status: "approved",
    paymentStatus: "partial",
    form: {
      ...initialQuoteForm,
      projectName: "누보 스킨랩 신제품 상세페이지",
      finalDescription: "상세페이지 1종, 썸네일 4종, AI 제품 배경컷"
    },
    items: [
      { id: "item_seed_1", category: "기획/디자인", description: "상세페이지 구성 및 디자인", price: 1200000 },
      { id: "item_seed_2", category: "AI 비주얼", description: "제품 배경 이미지 6컷", price: 480000 }
    ],
    customerId: "cus_seed_1",
    approvedAt: today(),
    invoiceDate: today(),
    invoiceIssuanceMode: "auto",
    invoiceType: { issueInvoice: true, issueCashReceipt: false },
    popbillInvoiceId: "PB-DEMO-001",
    invoiceStatus: "issued",
    createdAt: now(),
    updatedAt: now()
  }
];

const seedSales: SaleRecord[] = [
  {
    id: "sale_seed_1",
    quoteId: "quo_seed_1",
    customerId: "cus_seed_1",
    amount: 1848000,
    paidAmount: 900000,
    paymentStatus: "partial",
    payments: [{ date: today(), amount: 900000 }],
    createdAt: now(),
    updatedAt: now()
  }
];

const seedPurchases: PurchaseRecord[] = [
  {
    id: "pur_seed_1",
    vendorId: "ven_seed_1",
    relatedQuoteId: "quo_seed_1",
    items: [{ category: "출력", description: "컬러 교정 출력", price: 120000 }],
    totalAmount: 120000,
    paymentStatus: "unpaid",
    payments: [],
    createdAt: now(),
    updatedAt: now()
  }
];

export const defaultData: AppData = {
  quotes: seedQuotes,
  customers: seedCustomers,
  vendors: seedVendors,
  sales: seedSales,
  purchases: seedPurchases,
  taxApiIntegration: {
    provider: "popbill",
    businessNumber: "",
    contactEmail: "",
    isConnected: false,
    memo: ""
  }
};
