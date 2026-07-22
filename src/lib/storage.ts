import type { AppData } from "../types";
import { defaultData } from "../data/seed";
import { syncCustomerTotals } from "./finance";
import { uid } from "./id";
import { quoteHasContent } from "./quote-calc";

export const STORAGE_KEY = "blingkkami-ai-quote-employee:v8";

export function mergeAppData(parsed: Partial<AppData>): AppData {
  const customers = Array.isArray(parsed.customers) ? parsed.customers : [];
    const quotes = (Array.isArray(parsed.quotes) ? parsed.quotes : []).map((quote) => {
      const customer = customers.find((item) => item.id === quote.customerId);
      return {
        ...quote,
        items: Array.isArray(quote.items) && quote.items.length
          ? quote.items
          : [{ id: uid("item"), category: "", description: "", price: 0 }],
        invoiceIssuanceMode: quote.invoiceIssuanceMode ?? "auto",
        invoiceType: quote.invoiceType ?? { issueInvoice: true, issueCashReceipt: false },
        invoiceStatus: quote.invoiceStatus ?? "pending",
        documentEmailStatus: quote.documentEmailStatus ?? "pending",
        customerSnapshot: quote.customerSnapshot ?? (customer ? {
          name: customer.name,
          businessNumber: customer.businessNumber,
          representativeName: customer.representativeName,
          address: customer.address,
          contactPerson: customer.contactPerson,
          contact: customer.contact,
          email: customer.email,
          taxExempt: customer.taxExempt
        } : undefined)
      };
    }).filter((quote) => quote.status !== "draft" || Boolean(quote.customerId) || quoteHasContent(quote));
    const sales = (Array.isArray(parsed.sales) ? parsed.sales : []).map((sale) => {
      const payments = Array.isArray(sale.payments) && sale.payments.length
        ? sale.payments
        : sale.paidAmount > 0 ? [{ date: sale.updatedAt.slice(0, 10), amount: sale.paidAmount }] : [];
      const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      return {
        ...sale,
        payments,
        paidAmount,
        paymentStatus: paidAmount >= sale.amount ? "paid" as const : paidAmount > 0 ? "partial" as const : "unpaid" as const
      };
    });
    const syncedQuotes = quotes.map((quote) => {
      const sale = sales.find((record) => record.quoteId === quote.id);
      return sale ? { ...quote, paymentStatus: sale.paymentStatus } : quote;
    });
    const purchases = (Array.isArray(parsed.purchases) ? parsed.purchases : []).map((purchase) => {
      const payments = Array.isArray(purchase.payments) ? purchase.payments : [];
      const paid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      return {
        ...purchase,
        payments,
        paymentStatus: paid >= purchase.totalAmount ? "paid" as const : paid > 0 ? "partial" as const : "unpaid" as const
      };
    });
    const taxApiIntegration = { ...defaultData.taxApiIntegration, ...parsed.taxApiIntegration };
    const documentEmailSettings = { ...defaultData.documentEmailSettings, ...parsed.documentEmailSettings };
    const workspaceProfile = {
      ...defaultData.workspaceProfile,
      ...parsed.workspaceProfile,
      paymentAccount: {
        ...defaultData.workspaceProfile.paymentAccount,
        ...parsed.workspaceProfile?.paymentAccount
      }
    };
    if (!workspaceProfile.businessName.trim() && taxApiIntegration.corpName?.trim()) workspaceProfile.businessName = taxApiIntegration.corpName.trim();
    if (!taxApiIntegration.isConnected) taxApiIntegration.lastIssuedAt = undefined;
    const data: AppData = {
      ...defaultData,
      ...parsed,
      quotes: syncedQuotes,
      customers,
      vendors: Array.isArray(parsed.vendors) ? parsed.vendors : [],
      sales,
      purchases,
      taxApiIntegration,
      documentEmailSettings,
      workspaceProfile
    };
    return {
      ...data,
      customers: syncCustomerTotals(customers, sales, syncedQuotes)
    };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData;
    return mergeAppData(JSON.parse(raw) as Partial<AppData>);
  } catch {
    return defaultData;
  }
}

export function loadLegacyData(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return mergeAppData(JSON.parse(raw) as Partial<AppData>);
  } catch {
    return null;
  }
}

export function clearLegacyData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장소 접근이 제한된 브라우저에서는 서버 저장만 유지합니다.
  }
}

export function saveData(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
