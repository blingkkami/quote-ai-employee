export type QuoteStatus = "draft" | "delivered" | "approved" | "on_hold" | "cancelled";
export type PaymentStatus = "unpaid" | "partial" | "paid";
export type InvoiceIssuanceMode = "auto" | "manual";
export type InvoicePreference = "tax_invoice_auto" | "tax_invoice_manual" | "invoice" | "cash_receipt";
export type TaxApiProvider = "popbill" | "barobill" | "hometax";

export type TaxApiIntegration = {
  provider: TaxApiProvider;
  businessNumber: string;
  corpName?: string;
  ceoName?: string;
  address?: string;
  bizType?: string;
  bizClass?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail: string;
  popbillUserId?: string;
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

export type CustomerSnapshot = {
  name: string;
  businessNumber?: string;
  representativeName?: string;
  address?: string;
  contactPerson: string;
  contact: string;
  email?: string;
};

export type QuoteRecord = {
  id: string;
  status: QuoteStatus;
  paymentStatus: PaymentStatus;
  form: QuoteForm;
  items: QuoteItem[];
  customerId?: string;
  customerSnapshot?: CustomerSnapshot;
  approvedAt?: string;
  invoiceDate?: string;
  transactionStatementMemo?: string;
  taxInvoiceMemo?: string;
  invoiceIssuanceMode: InvoiceIssuanceMode;
  invoiceType: {
    issueInvoice: boolean;
    issueCashReceipt: boolean;
  };
  popbillInvoiceId?: string;
  popbillNtsConfirmNum?: string;
  invoiceStatus?: "pending" | "issued" | "sent" | "failed";
  invoiceNote?: string;
  documentEmailStatus?: "pending" | "sending" | "sent" | "failed";
  documentEmailRecipient?: string;
  documentEmailSentAt?: string;
  documentEmailId?: string;
  documentEmailNote?: string;
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
  unpaidNoticeSentAt?: string;
  unpaidNoticeRecipient?: string;
  unpaidNoticeAmount?: number;
  unpaidNoticeEmailId?: string;
  unpaidNoticeNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type Vendor = {
  id: string;
  name: string;
  businessNumber?: string;
  contactPerson?: string;
  contact?: string;
  address?: string;
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
  purchaseDate?: string;
  items: { category: string; description: string; price: number }[];
  totalAmount: number;
  paymentStatus: PaymentStatus;
  payments: { date: string; amount: number }[];
  createdAt: string;
  updatedAt: string;
};

export type DocumentEmailSettings = {
  autoSendOnApproval: boolean;
};

export type WorkspaceProfile = {
  businessName: string;
  stampDataUrl?: string;
  paymentAccount: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    showOnDocuments: boolean;
    showOnUnpaidNotices: boolean;
  };
};

export type AppData = {
  quotes: QuoteRecord[];
  customers: Customer[];
  vendors: Vendor[];
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
  taxApiIntegration: TaxApiIntegration;
  documentEmailSettings: DocumentEmailSettings;
  workspaceProfile: WorkspaceProfile;
  logoDataUrl?: string;
};
