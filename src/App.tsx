import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { CircleHelp, Cloud, Info, LockKeyhole, LogOut, Plus, Printer, UserRound } from "lucide-react";
import type { AppData, QuoteRecord, SaleRecord, TaxApiIntegration } from "./types";
import { emptyQuote } from "./data/quote-defaults";
import { quoteHasContent, quoteSubtotal, quoteTotal, quoteVat } from "./lib/quote-calc";
import { uid } from "./lib/id";
import { getTaxInvoiceStatus, issueTaxInvoice } from "./lib/tax-invoice";
import { issueCashbill } from "./lib/cashbill";
import { syncCustomerTotals } from "./lib/finance";
import { today } from "./lib/date";
import { nav, View } from "./constants";
import { QuoteBuilder } from "./views/QuoteBuilder";
import { QuoteList } from "./views/QuoteList";
import { IssueCenter } from "./views/IssueCenter";
import { CustomerManager } from "./views/CustomerManager";
import { VendorManager } from "./views/VendorManager";
import { Ledger } from "./views/Ledger";
import { ItemInsights } from "./views/ItemInsights";
import { Dashboard } from "./views/Dashboard";
import { SettingsView } from "./views/SettingsView";
import { Landing } from "./views/Landing";
import { AuthScreen } from "./components/AuthScreen";
import { PasswordRecovery } from "./components/PasswordRecovery";
import { DataMigrationPrompt } from "./components/DataMigrationPrompt";
import { AppLoading } from "./components/AppLoading";
import { useAuthSession } from "./hooks/useAuthSession";
import { useCloudAppData, type SyncState } from "./hooks/useCloudAppData";
import { isSupabaseConfigured, requireSupabase } from "./lib/supabase";
import { sendQuoteDocuments } from "./lib/document-email";
import { DocumentRenderStage } from "./components/DocumentRenderStage";
import { hasPaymentAccount, paymentAccountText } from "./lib/payment-account";
import { sendUnpaidNotice } from "./lib/unpaid-notice";
import { SupportCenter } from "./components/SupportCenter";
import { canOpenView } from "./lib/billing-plans";
import { useBillingAccount } from "./hooks/useBillingAccount";
import type { BillingProfile } from "./types";
import { grantSignupCredits, type BillableAction } from "./lib/billing";
import { BillingView } from "./views/BillingView";
import { completeRedirectedCheckout } from "./lib/billing-checkout";

type WorkspaceAppProps = {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  userId: string;
  userEmail: string;
  syncState: SyncState;
  syncError: string;
  lastSyncedAt?: string;
  onRetrySync: () => void;
  onPersistData: (data: AppData) => Promise<void>;
  onSignOut: () => Promise<void>;
  onShowLanding: () => void;
  billing: BillingProfile;
  onBillingRefresh: () => Promise<void>;
};

function WorkspaceApp({
  data,
  setData,
  userId,
  userEmail,
  syncState,
  syncError,
  lastSyncedAt,
  onRetrySync,
  onPersistData,
  onSignOut,
  onShowLanding,
  billing,
  onBillingRefresh
}: WorkspaceAppProps) {
  const [view, setView] = useState<View>(() => new URLSearchParams(window.location.search).has("email_connection") ? "settings" : "quote");
  const [draftQuote, setDraftQuote] = useState<QuoteRecord>(() => emptyQuote());
  const [activeQuoteId, setActiveQuoteId] = useState(data.quotes[0]?.id ?? "");
  const [issueQuoteId, setIssueQuoteId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [approvingQuoteId, setApprovingQuoteId] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const approvingIds = useRef(new Set<string>());
  const effectivePlanId = billing.status === "active" ? billing.planId : "free";

  // 실제 크레딧 차감과 실패 복구는 서버 API가 검증된 user_id로 원자적으로 처리한다.
  // 클라이언트는 발행/발송 API에 넘길 참조번호만 생성한다(브라우저에서 직접 차감·복구 불가).
  const authorizeBundle = async (features: BillableAction[], actionId: string) => {
    return features.map((feature) => ({ feature, referenceId: `${actionId}:${feature}` }));
  };

  const reverseBundle = async (_approved: { feature: BillableAction; referenceId: string }[]) => {
    // 서버 API가 외부 발행/발송 실패 시 복구를 담당하므로 클라이언트에서는 아무것도 하지 않는다.
  };

  const activeQuote = data.quotes.find((quote) => quote.id === activeQuoteId) ?? (view === "quote" ? draftQuote : data.quotes[0] ?? draftQuote);

  const totals = useMemo(() => {
    const sales = data.sales.reduce((sum, sale) => sum + sale.amount, 0);
    const paid = data.sales.reduce((sum, sale) => sum + sale.paidAmount, 0);
    const purchase = data.purchases.reduce((sum, record) => sum + record.totalAmount, 0);
    const purchasePaid = data.purchases.reduce((sum, record) => sum + record.payments.reduce((p, item) => p + item.amount, 0), 0);
    return {
      sales,
      paid,
      unpaid: sales - paid,
      purchase,
      purchaseUnpaid: purchase - purchasePaid,
      margin: sales - purchase,
      overdueCustomers: new Set(data.sales.filter((sale) => sale.paymentStatus !== "paid").map((sale) => sale.customerId)).size
    };
  }, [data]);

  const itemSuggestions = useMemo(() => {
    const unique = new Map<string, { category: string; description: string }>();
    data.quotes.flatMap((quote) => quote.items).forEach((item) => {
      if (!item.category.trim() && !item.description.trim()) return;
      const key = `${item.category.trim()}\u0000${item.description.trim()}`;
      unique.set(key, { category: item.category.trim(), description: item.description.trim() });
    });
    return [...unique.values()];
  }, [data.quotes]);

  const updateQuote = (quote: QuoteRecord) => {
    if (quote.status === "draft" && !quote.customerId && !quoteHasContent(quote)) {
      setData((prev) => ({ ...prev, quotes: prev.quotes.filter((item) => item.id !== quote.id) }));
      setDraftQuote(quote);
      setActiveQuoteId(quote.id);
      return;
    }
    setData((prev) => ({
      ...prev,
      quotes: prev.quotes.some((item) => item.id === quote.id)
        ? prev.quotes.map((item) => (item.id === quote.id ? { ...quote, updatedAt: new Date().toISOString() } : item))
        : [{ ...quote, updatedAt: new Date().toISOString() }, ...prev.quotes]
    }));
    setDraftQuote(quote);
    setActiveQuoteId(quote.id);
  };

  const createNewQuote = () => {
    const quote = emptyQuote();
    setDraftQuote(quote);
    setActiveQuoteId(quote.id);
    setView("quote");
  };

  const approveQuote = async (quote: QuoteRecord) => {
    if (approvingIds.current.has(quote.id)) return;
    if (quote.invoiceStatus === "issued" || quote.invoiceStatus === "sent") {
      window.alert("이미 발행된 세금계산서라 중복 요청을 차단했습니다. 변경이 필요하면 팝빌 관리자에서 수정세금계산서를 처리해 주세요.");
      setActiveQuoteId(quote.id);
      setIssueQuoteId(quote.id);
      setView("issue");
      return;
    }
    const customerId = quote.customerId;
    if (!customerId) {
      window.alert("승인하려면 먼저 고객을 선택해 주세요.");
      return;
    }
    const amount = quoteTotal(quote);
    if (!quote.form.projectName.trim()) {
      window.alert("프로젝트명을 입력해 주세요.");
      return;
    }
    if (amount < 1) {
      window.alert("금액이 입력된 작업 항목을 한 개 이상 추가해 주세요.");
      return;
    }
    const existingSale = data.sales.find((record) => record.quoteId === quote.id);
    const recordedPayments = existingSale?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0;
    if (recordedPayments > amount) {
      window.alert(`이미 수금된 ${recordedPayments.toLocaleString("ko-KR")}원보다 견적 금액을 낮출 수 없습니다.`);
      return;
    }
    approvingIds.current.add(quote.id);
    setApprovingQuoteId(quote.id);
    const customer = data.customers.find((item) => item.id === customerId);
    const now = new Date().toISOString();
    const approved: QuoteRecord = {
      ...quote,
      customerId,
      customerSnapshot: customer ? {
        name: customer.name,
        businessNumber: customer.businessNumber,
        representativeName: customer.representativeName,
        address: customer.address,
        contactPerson: customer.contactPerson,
        contact: customer.contact,
        email: customer.email,
        taxExempt: customer.taxExempt
      } : quote.customerSnapshot,
      status: "approved",
      approvedAt: today(),
      invoiceDate: quote.invoiceDate || today(),
      invoiceStatus: "pending",
      popbillInvoiceId: quote.popbillInvoiceId,
      documentEmailStatus: quote.documentEmailStatus === "sent"
        ? "sent"
        : data.documentEmailSettings.autoSendOnApproval ? "sending" : "pending",
      updatedAt: now
    };
    const quotes = data.quotes.some((item) => item.id === quote.id)
      ? data.quotes.map((item) => (item.id === quote.id ? approved : item))
      : [approved, ...data.quotes];
    const previousSale = data.sales.find((record) => record.quoteId === quote.id);
    const sales: SaleRecord[] = previousSale
      ? data.sales.map((record) =>
            record.quoteId === quote.id
              ? {
                  ...record,
                  customerId,
                  amount,
                  paidAmount: record.payments.reduce((sum, payment) => sum + payment.amount, 0),
                  paymentStatus: recordedPayments >= amount ? "paid" : recordedPayments > 0 ? "partial" : "unpaid",
                  updatedAt: new Date().toISOString()
                }
              : record
          )
      : [
            {
              id: uid("sale"),
              quoteId: quote.id,
              customerId,
              amount,
              paidAmount: 0,
              paymentStatus: "unpaid",
              payments: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            ...data.sales
          ];
    const saleForQuote = sales.find((record) => record.quoteId === quote.id);
    const syncedQuotes = saleForQuote
      ? quotes.map((item) => item.id === quote.id ? { ...item, paymentStatus: saleForQuote.paymentStatus } : item)
      : quotes;
    let workingData: AppData = {
      ...data,
      quotes: syncedQuotes,
      sales,
      customers: syncCustomerTotals(data.customers, sales, syncedQuotes)
    };
    setData(workingData);
    try {
      await onPersistData(workingData);
    } catch {
      approvingIds.current.delete(quote.id);
      setApprovingQuoteId("");
      window.alert("견적을 서버에 저장하지 못해 승인과 자동발송을 중단했습니다. 네트워크를 확인해 주세요.");
      return;
    }
    setActiveQuoteId(quote.id);
    setIssueQuoteId(quote.id);
    setView("issue");

    if (data.documentEmailSettings.autoSendOnApproval && quote.documentEmailStatus !== "sent" && approved.customerSnapshot) {
      let emailPatch: Partial<QuoteRecord>;
      const billingApproval = await authorizeBundle(
        ["quote_pdf", "transaction_statement", "email"],
        `approval-email:${quote.id}:${crypto.randomUUID()}`
      );
      if (!billingApproval) {
        emailPatch = { documentEmailStatus: "failed", documentEmailNote: "크레딧 또는 요금제 사용 범위를 확인해 주세요." };
        workingData = {
          ...workingData,
          quotes: workingData.quotes.map((item) => item.id === quote.id ? { ...item, ...emailPatch } : item)
        };
        await onPersistData(workingData).catch(() => undefined);
      } else {
      try {
        const emailResult = await sendQuoteDocuments(
          approved,
          approved.customerSnapshot,
          Object.fromEntries(billingApproval.map((item) => [item.feature, item.referenceId]))
        );
        emailPatch = emailResult.ok
          ? {
              documentEmailStatus: "sent",
              documentEmailRecipient: emailResult.recipient || approved.customerSnapshot.email,
              documentEmailSentAt: new Date().toISOString(),
              documentEmailId: emailResult.emailId,
              documentEmailNote: emailResult.message
            }
          : { documentEmailStatus: "failed", documentEmailNote: emailResult.message };
        if (!emailResult.ok) await reverseBundle(billingApproval);
      } catch (error) {
        emailPatch = { documentEmailStatus: "failed", documentEmailNote: error instanceof Error ? error.message : String(error) };
        await reverseBundle(billingApproval);
      }
      workingData = {
        ...workingData,
        quotes: workingData.quotes.map((item) => item.id === quote.id ? { ...item, ...emailPatch } : item)
      };
      await onPersistData(workingData).catch(() => undefined);
      }
    }

    // 현금영수증은 세금계산서와 독립적으로 발행된다(자동 발행 설정일 때만 실제 호출).
    // 세금계산서 발행 여부와 무관하게, 승인 마무리 시 함께 처리한다.
    const applyCashPatch = (base: AppData, patch: Partial<QuoteRecord>): AppData => ({
      ...base,
      quotes: base.quotes.map((item) => (item.id === quote.id ? { ...item, ...patch } : item))
    });
    const finishApproval = async (base: AppData) => {
      let next = base;
      if (quote.invoiceType.issueCashReceipt && quote.invoiceIssuanceMode === "auto") {
        const cashCustomer = approved.customerSnapshot;
        if (!cashCustomer) {
          next = applyCashPatch(next, { cashReceiptStatus: "failed", cashReceiptNote: "고객 정보가 없어 현금영수증을 발행할 수 없습니다." });
        } else {
          const cashResult = await issueCashbill({
            quoteId: quote.id,
            projectName: quote.form.projectName,
            writeDate: approved.invoiceDate || today(),
            total: quoteTotal(quote),
            customer: {
              name: cashCustomer.name,
              businessNumber: cashCustomer.businessNumber,
              phone: cashCustomer.contact,
              email: cashCustomer.email,
              taxExempt: cashCustomer.taxExempt
            }
          });
          next = applyCashPatch(next, {
            cashReceiptStatus: cashResult.cashReceiptStatus,
            ...(cashResult.popbillCashbillId ? { popbillCashbillId: cashResult.popbillCashbillId } : {}),
            cashReceiptNote: cashResult.message
          });
        }
      }
      await onPersistData(next).catch(() => setData(next));
      approvingIds.current.delete(quote.id);
      setApprovingQuoteId("");
    };

    if (quote.invoiceIssuanceMode !== "auto" || !quote.invoiceType.issueInvoice) {
      workingData = {
        ...workingData,
        quotes: workingData.quotes.map((item) =>
          item.id === quote.id
            ? { ...item, invoiceStatus: "pending", invoiceNote: quote.invoiceType.issueInvoice ? "수동 발행 대기 중입니다." : "세금계산서 발행 대상이 아닙니다." }
            : item
        )
      };
      await finishApproval(workingData);
      return;
    }

    // 사업자번호가 없으면 자동 발행을 건너뛰고 실패로 표시한다.
    const invoiceCustomer = approved.customerSnapshot;
    if (!invoiceCustomer?.businessNumber) {
      workingData = {
        ...workingData,
        quotes: workingData.quotes.map((item) => (item.id === quote.id ? { ...item, invoiceStatus: "failed", invoiceNote: "고객 사업자번호가 없어 발행할 수 없습니다." } : item))
      };
      await finishApproval(workingData);
      return;
    }

    const taxBillingReference = `tax-invoice:${quote.id}`;
    const taxBilling = await authorizeBundle(["tax_invoice"], taxBillingReference);
    if (!taxBilling) {
      workingData = {
        ...workingData,
        quotes: workingData.quotes.map((item) => item.id === quote.id
          ? { ...item, invoiceStatus: "failed", invoiceNote: "포함 건수 또는 크레딧이 부족해 발행을 중단했습니다." }
          : item)
      };
      await finishApproval(workingData);
      return;
    }

    const result = await issueTaxInvoice({
      billingReference: taxBilling[0].referenceId,
      quoteId: quote.id,
      projectName: quote.form.projectName,
      writeDate: approved.invoiceDate || today(),
      supplyCost: quoteSubtotal(quote),
      tax: quoteVat(quote),
      total: quoteTotal(quote),
      items: quote.items.map((item) => ({
        name: `${item.category} ${item.description}`.trim(),
        supplyCost: item.price,
        tax: invoiceCustomer.taxExempt ? 0 : Math.round(item.price * 0.1)
      })),
      customer: {
        businessNumber: invoiceCustomer.businessNumber ?? "",
        name: invoiceCustomer.name,
        ceoName: invoiceCustomer.representativeName,
        email: invoiceCustomer.email,
        contactName: invoiceCustomer.contactPerson,
        address: invoiceCustomer.address,
        taxExempt: invoiceCustomer.taxExempt
      },
      taxInvoiceMemo: approved.taxInvoiceMemo,
      paymentAccount: data.workspaceProfile.paymentAccount.showOnDocuments && hasPaymentAccount(data.workspaceProfile)
        ? {
            bankName: data.workspaceProfile.paymentAccount.bankName,
            accountNumber: data.workspaceProfile.paymentAccount.accountNumber,
            accountHolder: data.workspaceProfile.paymentAccount.accountHolder
          }
        : undefined
    });
    if (!result.ok) await reverseBundle(taxBilling);

    workingData = {
      ...workingData,
      quotes: workingData.quotes.map((item) =>
        item.id === quote.id
          ? {
              ...item,
              invoiceStatus: result.invoiceStatus,
              popbillInvoiceId: result.popbillInvoiceId ?? item.popbillInvoiceId,
              popbillNtsConfirmNum: result.popbillNtsConfirmNum ?? item.popbillNtsConfirmNum,
              invoiceNote: result.message
            }
          : item
      ),
      taxApiIntegration: result.ok
        ? { ...workingData.taxApiIntegration, lastIssuedAt: new Date().toISOString() }
        : workingData.taxApiIntegration
    };
    await finishApproval(workingData);
  };

  const resendDocuments = async (quote: QuoteRecord) => {
    if (approvingIds.current.has(quote.id)) return;
    const customer = data.customers.find((item) => item.id === quote.customerId) ?? quote.customerSnapshot;
    if (!customer?.email) {
      window.alert("고객 이메일을 먼저 등록해 주세요.");
      return;
    }
    const billingApproval = await authorizeBundle(
      ["quote_pdf", "transaction_statement", "email"],
      `document-email:${quote.id}:${crypto.randomUUID()}`
    );
    if (!billingApproval) return;
    approvingIds.current.add(quote.id);
    setApprovingQuoteId(quote.id);
    const sendingData: AppData = {
      ...data,
      quotes: data.quotes.map((item) => item.id === quote.id ? { ...item, documentEmailStatus: "sending" } : item)
    };
    setData(sendingData);
    try {
      await onPersistData(sendingData);
      const result = await sendQuoteDocuments(
        quote,
        customer,
        Object.fromEntries(billingApproval.map((item) => [item.feature, item.referenceId]))
      );
      if (!result.ok) await reverseBundle(billingApproval);
      const nextData = {
        ...sendingData,
        quotes: sendingData.quotes.map((item) => item.id === quote.id ? {
          ...item,
          documentEmailStatus: result.ok ? "sent" as const : "failed" as const,
          documentEmailRecipient: result.ok ? result.recipient || customer.email : item.documentEmailRecipient,
          documentEmailSentAt: result.ok ? new Date().toISOString() : item.documentEmailSentAt,
          documentEmailId: result.ok ? result.emailId : item.documentEmailId,
          documentEmailNote: result.message
        } : item)
      };
      await onPersistData(nextData);
    } catch (error) {
      await reverseBundle(billingApproval);
      const message = error instanceof Error ? error.message : String(error);
      setData((prev) => ({ ...prev, quotes: prev.quotes.map((item) => item.id === quote.id ? { ...item, documentEmailStatus: "failed", documentEmailNote: message } : item) }));
    } finally {
      approvingIds.current.delete(quote.id);
      setApprovingQuoteId("");
    }
  };

  const refreshInvoiceStatus = async (quote: QuoteRecord) => {
    if (!quote.popbillInvoiceId || approvingIds.current.has(quote.id)) return;
    approvingIds.current.add(quote.id);
    setApprovingQuoteId(quote.id);
    try {
      const result = await getTaxInvoiceStatus(quote.popbillInvoiceId);
      setData((prev) => ({
        ...prev,
        quotes: prev.quotes.map((item) => item.id === quote.id ? {
          ...item,
          invoiceStatus: result.invoiceStatus,
          popbillNtsConfirmNum: result.popbillNtsConfirmNum ?? item.popbillNtsConfirmNum,
          invoiceNote: result.message
        } : item)
      }));
    } finally {
      approvingIds.current.delete(quote.id);
      setApprovingQuoteId("");
    }
  };

  const recordPayment = (saleId: string, amount: number, date: string) => {
    if (!amount || amount < 1) return;
    setData((prev) => {
      const sales = prev.sales.map((sale) => {
        if (sale.id !== saleId) return sale;
        const paidAmount = Math.min(sale.amount, sale.paidAmount + amount);
        return {
          ...sale,
          paidAmount,
          paymentStatus: paidAmount >= sale.amount ? "paid" as const : "partial" as const,
          payments: [...sale.payments, { date: date || today(), amount: paidAmount - sale.paidAmount }],
          updatedAt: new Date().toISOString()
        };
      });
      const paidSale = sales.find((sale) => sale.id === saleId);
      const quotes = paidSale
        ? prev.quotes.map((quote) => quote.id === paidSale.quoteId ? { ...quote, paymentStatus: paidSale.paymentStatus } : quote)
        : prev.quotes;
      return { ...prev, sales, quotes, customers: syncCustomerTotals(prev.customers, sales, quotes) };
    });
  };

  const recordPurchasePayment = (purchaseId: string, amount: number, date: string) => {
    if (!amount || amount < 1 || !date) return;
    setData((prev) => ({
      ...prev,
      purchases: prev.purchases.map((purchase) => {
        if (purchase.id !== purchaseId) return purchase;
        const paid = purchase.payments.reduce((sum, payment) => sum + payment.amount, 0);
        const applied = Math.min(amount, Math.max(0, purchase.totalAmount - paid));
        if (!applied) return purchase;
        const payments = [...purchase.payments, { date, amount: applied }];
        const paidTotal = paid + applied;
        return {
          ...purchase,
          payments,
          paymentStatus: paidTotal >= purchase.totalAmount ? "paid" as const : "partial" as const,
          updatedAt: new Date().toISOString()
        };
      })
    }));
  };

  const deleteQuote = (quoteId: string) => {
    setData((prev) => {
      const quotes = prev.quotes.filter((quote) => quote.id !== quoteId);
      const sales = prev.sales.filter((sale) => sale.quoteId !== quoteId);
      const purchases = prev.purchases.map((purchase) =>
        purchase.relatedQuoteId === quoteId ? { ...purchase, relatedQuoteId: undefined } : purchase
      );
      return { ...prev, quotes, sales, purchases, customers: syncCustomerTotals(prev.customers, sales, quotes) };
    });
    if (activeQuoteId === quoteId) createNewQuote();
  };

  const duplicateQuote = (quote: QuoteRecord) => {
    const now = new Date().toISOString();
    const copy: QuoteRecord = {
      ...quote,
      id: uid("quo"),
      status: "draft",
      paymentStatus: "unpaid",
      approvedAt: undefined,
      invoiceDate: undefined,
      transactionStatementMemo: "",
      taxInvoiceMemo: "",
      invoiceStatus: "pending",
      invoiceNote: undefined,
      popbillInvoiceId: undefined,
      popbillNtsConfirmNum: undefined,
      form: { ...quote.form, projectName: `${quote.form.projectName || "견적"} 복사본` },
      items: quote.items.map((item) => ({ ...item, id: uid("item") })),
      createdAt: now,
      updatedAt: now
    };
    setData((prev) => ({ ...prev, quotes: [copy, ...prev.quotes] }));
    setActiveQuoteId(copy.id);
    setView("quote");
  };

  const updateTaxApiIntegration = (taxApiIntegration: TaxApiIntegration) => {
    setData((prev) => ({
      ...prev,
      taxApiIntegration,
      workspaceProfile: prev.workspaceProfile.businessName.trim() || !taxApiIntegration.corpName?.trim()
        ? prev.workspaceProfile
        : { ...prev.workspaceProfile, businessName: taxApiIntegration.corpName.trim() }
    }));
    if (taxApiIntegration.isConnected && taxApiIntegration.businessNumber) {
      void grantSignupCredits(taxApiIntegration.businessNumber)
        .then(() => onBillingRefresh())
        .catch(() => undefined);
    }
  };

  const handlePrint = async () => {
    const projectName = activeQuote.form.projectName.trim() || "견적서";
    const quoteDate = activeQuote.form.quoteDate || today();
    const sanitize = (value: string) => value.replace(/[\\/:*?"<>|]/g, "-");
    const paper = document.querySelector<HTMLElement>(".qp-paper");
    if (!paper) {
      window.alert("견적 생성 화면에서 PDF를 다운로드해 주세요.");
      return;
    }
    const billingApproval = await authorizeBundle(["quote_pdf"], `quote-pdf:${activeQuote.id}:${crypto.randomUUID()}`);
    if (!billingApproval) return;
    const clone = paper.cloneNode(true) as HTMLElement;
    clone.style.position = "fixed";
    clone.style.left = "-10000px";
    clone.style.top = "0";
    clone.style.width = "794px";
    clone.style.height = "auto";
    clone.style.transform = "none";
    clone.style.boxShadow = "none";
    document.body.appendChild(clone);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(clone, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const width = 210;
      const pageHeightPx = Math.floor((canvas.width * 297) / width);
      for (let offset = 0, page = 0; offset < canvas.height; offset += pageHeightPx, page += 1) {
        const sliceHeight = Math.min(pageHeightPx, canvas.height - offset);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const context = pageCanvas.getContext("2d");
        if (!context) throw new Error("PDF 페이지를 생성할 수 없습니다.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        context.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
        if (page > 0) pdf.addPage();
        pdf.addImage(
          pageCanvas.toDataURL("image/jpeg", 0.94),
          "JPEG",
          0,
          0,
          width,
          (sliceHeight * width) / canvas.width,
          undefined,
          "FAST"
        );
      }
      const url = URL.createObjectURL(pdf.output("blob"));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sanitize(`견적서_${projectName}_${quoteDate}`)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      await reverseBundle(billingApproval);
      window.alert(`PDF 생성에 실패했습니다. ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clone.remove();
    }
  };

  const exportCsv = (quote: QuoteRecord) => {
    const documentAccount = data.workspaceProfile.paymentAccount.showOnDocuments && hasPaymentAccount(data.workspaceProfile)
      ? paymentAccountText(data.workspaceProfile)
      : "";
    const rows = [
      ["견적ID", "발행일", "고객", "사업자번호", "프로젝트", "공급가", "부가세", "합계", "발행방식", "입금계좌", "세금계산서 비고"],
      [
        quote.id,
        quote.invoiceDate || today(),
        quote.customerSnapshot?.name ?? data.customers.find((customer) => customer.id === quote.customerId)?.name ?? "",
        quote.customerSnapshot?.businessNumber ?? data.customers.find((customer) => customer.id === quote.customerId)?.businessNumber ?? "",
        quote.form.projectName,
        quoteSubtotal(quote),
        quoteVat(quote),
        quoteTotal(quote),
        quote.invoiceIssuanceMode,
        documentAccount,
        quote.taxInvoiceMemo ?? ""
      ]
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const project = quote.form.projectName.trim().replace(/[\\/:*?"<>|]/g, "-") || "견적";
    link.download = `세금계산서_수동발행_${project}_${quote.invoiceDate || today()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const syncLabel = syncState === "saving" ? "저장 중" : syncState === "error" ? "저장 오류" : "저장됨";
  const syncTitle = syncError || (lastSyncedAt ? `마지막 저장 ${new Date(lastSyncedAt).toLocaleString("ko-KR")}` : "계정 데이터 자동 저장");
  const workspaceName = data.workspaceProfile.businessName.trim() || data.taxApiIntegration.corpName?.trim() || "블링빌";
  const hasCustomBrand = workspaceName !== "블링빌" || Boolean(data.logoDataUrl);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className={`brand-mark ${data.logoDataUrl ? "has-logo" : ""}`}>
            {data.logoDataUrl ? <img src={data.logoDataUrl} alt={`${workspaceName} 로고`} /> : "BB"}
          </span>
          <div className="brand-copy">
            <div className="brand-name-line">
              <strong title={workspaceName}>{workspaceName}</strong>
              {hasCustomBrand && <small>by 블링빌</small>}
            </div>
            <small>견적·발행·정산</small>
          </div>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            const allowed = canOpenView(effectivePlanId, item.id);
            return (
              <button
                key={item.id}
                aria-label={item.label}
                title={item.label}
                className={`${view === item.id ? "active" : ""} ${allowed ? "" : "plan-locked"}`}
                onClick={() => {
                  if (!allowed) {
                    window.alert(item.id === "dashboard"
                      ? "운영 현황은 Pro 요금제에서 사용할 수 있습니다."
                      : "원장·미수·매입 관리 기능은 입문 이상 요금제에서 사용할 수 있습니다.");
                    return;
                  }
                  if (item.id === "issue") setIssueQuoteId(null);
                  setView(item.id);
                }}
              >
                <Icon size={18} />
                  <span>{item.label}</span>
                  {!allowed && <LockKeyhole size={13} aria-label="요금제 업그레이드 필요" />}
              </button>
            );
          })}
        </nav>
        <button className="link sidebar-about" onClick={onShowLanding}>
          <Info size={14} /> 앱 소개
        </button>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="workspace-context"><span>{workspaceName}</span>{hasCustomBrand && <small>블링빌</small>}</p>
            <h1>{nav.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className="topbar-right">
            {view === "quote" && (
              <div className="top-actions">
                <button className="ghost" onClick={handlePrint}>
                  <Printer size={17} /> PDF 다운로드
                </button>
                <button onClick={createNewQuote}>
                  <Plus size={17} /> 새 견적
                </button>
              </div>
            )}
            <button type="button" className="ghost support-open" onClick={() => setSupportOpen(true)}>
              <CircleHelp size={17} /> 고객센터
            </button>
            <div className="account-strip">
              <button
                type="button"
                className={`sync-indicator ${syncState}`}
                title={syncTitle}
                aria-label={`${syncLabel}. ${syncTitle}`}
                onClick={syncState === "error" ? onRetrySync : undefined}
              >
                <Cloud size={15} /> <span>{syncLabel}</span>
              </button>
              <span className="user-email" title={userEmail}><UserRound size={15} /> {userEmail}</span>
              <button className="icon account-signout" type="button" title="로그아웃" aria-label="로그아웃" onClick={() => void onSignOut()}>
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </header>

        {view === "quote" && (
          <QuoteBuilder
            quote={activeQuote}
            customers={data.customers}
            onSave={updateQuote}
            onApprove={approveQuote}
            logo={data.logoDataUrl}
            workspaceProfile={data.workspaceProfile}
            itemSuggestions={itemSuggestions}
            isApproving={approvingQuoteId === activeQuote.id}
            onLogoChange={(logoDataUrl?: string) => setData((prev) => ({ ...prev, logoDataUrl }))}
            onCustomerUpdate={(customer) =>
              setData((prev) => ({
                ...prev,
                customers: prev.customers.map((item) => (item.id === customer.id ? customer : item))
              }))
            }
          />
        )}
        {view === "quotes" && (
          <QuoteList
            quotes={data.quotes}
            customers={data.customers}
            query={query}
            setQuery={setQuery}
            onOpen={(id) => {
              setActiveQuoteId(id);
              setView("quote");
            }}
            onChange={updateQuote}
            onDelete={deleteQuote}
            onDuplicate={duplicateQuote}
          />
        )}
        {view === "issue" && (
          <IssueCenter
            quote={data.quotes.find((quote) => quote.id === issueQuoteId)}
            quotes={data.quotes}
            customers={data.customers}
            onSelectQuote={(id) => {
              setIssueQuoteId(id);
              setActiveQuoteId(id);
            }}
            onClose={() => setIssueQuoteId(null)}
            onApprove={approveQuote}
            onChangeQuote={updateQuote}
            onCustomerUpdate={(customer) =>
              setData((prev) => ({
                ...prev,
                customers: prev.customers.map((item) => (item.id === customer.id ? customer : item))
              }))
            }
            onRefreshStatus={refreshInvoiceStatus}
            onSendDocuments={resendDocuments}
            onExportCsv={exportCsv}
            isApproving={Boolean(issueQuoteId && approvingQuoteId === issueQuoteId)}
            logo={data.logoDataUrl}
            workspaceProfile={data.workspaceProfile}
          />
        )}
        {view === "customers" && (
          <CustomerManager
            data={data}
            setData={setData}
            onSendUnpaidNotice={async (customerId) => {
              await onPersistData(data);
              const billingApproval = await authorizeBundle(["unpaid_notice"], `unpaid-notice:${customerId}:${crypto.randomUUID()}`);
              if (!billingApproval) return { ok: false, message: "크레딧 또는 요금제 사용 범위를 확인해 주세요." };
              try {
                const result = await sendUnpaidNotice(customerId, billingApproval[0].referenceId);
                if (!result.ok) await reverseBundle(billingApproval);
                return result;
              } catch (error) {
                await reverseBundle(billingApproval);
                throw error;
              }
            }}
          />
        )}
        {view === "vendors" && <VendorManager data={data} setData={setData} />}
        {view === "ledger" && <Ledger data={data} onPayment={recordPayment} onPurchasePayment={recordPurchasePayment} />}
        {view === "items" && <ItemInsights data={data} />}
        {view === "dashboard" && <Dashboard data={data} totals={totals} />}
        {view === "billing" && <BillingView billing={billing} userId={userId} onRefresh={onBillingRefresh} />}
        {view === "settings" && <SettingsView integration={data.taxApiIntegration} onChange={updateTaxApiIntegration} data={data} onRestore={setData} onDocumentEmailSettingsChange={(settings) => setData((prev) => ({ ...prev, documentEmailSettings: settings }))} onWorkspaceProfileChange={(workspaceProfile) => setData((prev) => ({ ...prev, workspaceProfile }))} onLogoChange={(logoDataUrl) => setData((prev) => ({ ...prev, logoDataUrl }))} />}
      </main>
      <DocumentRenderStage
        quote={activeQuote}
        customer={activeQuote.customerSnapshot}
        supplier={data.taxApiIntegration}
        logo={data.logoDataUrl}
        workspaceProfile={data.workspaceProfile}
      />
      <SupportCenter
        open={supportOpen}
        userEmail={userEmail}
        workspaceName={workspaceName}
        currentView={nav.find((item) => item.id === view)?.label ?? "업무 화면"}
        onClose={() => setSupportOpen(false)}
      />
    </div>
  );
}

function App() {
  const [showLanding, setShowLanding] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    return !window.location.hash.includes("type=recovery") && !query.has("email_connection") && !query.has("billing_return");
  });
  const auth = useAuthSession();
  const cloud = useCloudAppData(auth.session?.user.id);
  const billingAccount = useBillingAccount(auth.session?.user.id);
  const checkoutReturnHandled = useRef(false);

  useEffect(() => {
    if (!auth.session) return;
    const query = new URLSearchParams(window.location.search);
    const orderId = query.get("orderId");
    if (!query.has("billing_return") || !orderId || checkoutReturnHandled.current) return;
    checkoutReturnHandled.current = true;
    const redirectError = query.get("message");
    const redirectErrorCode = query.get("code");
    const checkoutType = query.get("checkoutType");
    const billingKey = query.get("billingKey") || undefined;
    if (redirectErrorCode || redirectError) {
      window.alert(`결제가 완료되지 않았습니다. ${redirectError || redirectErrorCode}`);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (checkoutType === "subscription" && !billingKey) {
      window.alert("정기결제 카드 등록 결과를 확인하지 못했습니다. 다시 시도해 주세요.");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    void completeRedirectedCheckout(orderId, billingKey)
      .then(async (result) => {
        await billingAccount.refresh();
        window.alert(result.message || "결제가 완료되었습니다.");
      })
      .catch((error) => window.alert(error instanceof Error ? error.message : String(error)))
      .finally(() => {
        window.history.replaceState({}, "", window.location.pathname);
      });
  }, [auth.session, billingAccount.refresh]);

  if (showLanding) {
    return <Landing onStart={() => setShowLanding(false)} />;
  }

  if (!isSupabaseConfigured) {
    return (
      <AppLoading
        error="로그인 서버 설정이 필요합니다. VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY를 확인해 주세요."
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (auth.loading) return <AppLoading />;

  if (auth.isPasswordRecovery && auth.session) {
    return <PasswordRecovery onComplete={auth.finishPasswordRecovery} />;
  }

  if (!auth.session) {
    return <AuthScreen onBack={() => setShowLanding(true)} />;
  }

  if (cloud.loading || (!cloud.data && !cloud.loadError)) return <AppLoading />;

  if (cloud.loadError || !cloud.data) {
    return <AppLoading error={cloud.loadError || "데이터를 불러오지 못했습니다."} onRetry={() => window.location.reload()} />;
  }

  const signOut = async () => {
    await cloud.flush();
    const { error } = await requireSupabase().auth.signOut();
    if (error) window.alert(`로그아웃하지 못했습니다. ${error.message}`);
  };

  return (
    <>
      <WorkspaceApp
        data={cloud.data}
        setData={cloud.setData}
        userId={auth.session.user.id}
        userEmail={auth.session.user.email ?? "로그인 계정"}
        syncState={cloud.syncState}
        syncError={cloud.syncError}
        lastSyncedAt={cloud.lastSyncedAt}
        onRetrySync={cloud.retry}
        onPersistData={cloud.persistNow}
        onSignOut={signOut}
        onShowLanding={() => setShowLanding(true)}
        billing={billingAccount.billing}
        onBillingRefresh={billingAccount.refresh}
      />
      {cloud.migrationData && (
        <DataMigrationPrompt data={cloud.migrationData} onImport={cloud.importLegacyData} onStartFresh={cloud.startFresh} />
      )}
    </>
  );
}

export default App;
