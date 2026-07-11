export type QuoteStatus = "draft" | "delivered" | "approved" | "on_hold" | "cancelled";
export type PaymentStatus = "unpaid" | "partial" | "paid";
export type InvoiceIssuanceMode = "auto" | "manual";
export type InvoicePreference = "tax_invoice_auto" | "tax_invoice_manual" | "invoice" | "cash_receipt";
export type TaxApiProvider = "popbill" | "barobill" | "hometax";

export type TaxApiIntegration = {
  provider: TaxApiProvider;
  businessNumber: string;
  contactEmail: string;
  isConnected: boolean;
  lastTestedAt?: string;
  lastIssuedAt?: string;
  memo?: string;
};

export type QuoteForm = {
  quoteDate: string;
  validDuration: string;
  issuerName: string;
  projectName: string;
  deliveryFormat: string;
  deliverySchedule: string;
  finalCategory: string;
  finalDescription: string;
  notes: string;
  message: string;
  signOffSender: string;
  signOffDate: string;
};

export type QuoteItem = {
  id: string;
  category: string;
  description: string;
  price: number;
};

export type QuoteRecord = {
  id: string;
  status: QuoteStatus;
  paymentStatus: PaymentStatus;
  form: QuoteForm;
  items: QuoteItem[];
  customerId?: string;
  approvedAt?: string;
  invoiceDate?: string;
  invoiceIssuanceMode: InvoiceIssuanceMode;
  invoiceType: {
    issueInvoice: boolean;
    issueCashReceipt: boolean;
  };
  popbillInvoiceId?: string;
  invoiceStatus?: "pending" | "issued" | "sent" | "failed";
  createdAt: string;
  updatedAt: string;
};

export type Customer = {
  id: string;
  name: string;
  businessNumber?: string;
  representativeName?: string;
  address?: string;
  contactPerson: string;
  contact: string;
  email?: string;
  paymentCycle: "per_transaction" | "monthly_batch";
  invoicePreference: InvoicePreference;
  memo?: string;
  firstQuoteAt: string;
  lastQuoteAt: string;
  totalSales: number;
  unpaidAmount: number;
  createdAt: string;
  updatedAt: string;
};

export type Vendor = {
  id: string;
  name: string;
  businessNumber?: string;
  contactPerson?: string;
  contact?: string;
  hasPurchaseTransaction: boolean;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type SaleRecord = {
  id: string;
  quoteId: string;
  customerId: string;
  amount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  payments: { date: string; amount: number }[];
  createdAt: string;
  updatedAt: string;
};

export type PurchaseRecord = {
  id: string;
  vendorId: string;
  relatedQuoteId?: string;
  items: { category: string; description: string; price: number }[];
  totalAmount: number;
  paymentStatus: PaymentStatus;
  payments: { date: string; amount: number }[];
  createdAt: string;
  updatedAt: string;
};

export type AppData = {
  quotes: QuoteRecord[];
  customers: Customer[];
  vendors: Vendor[];
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
  taxApiIntegration: TaxApiIntegration;
};
