import { useEffect, useMemo, useRef, useState } from "react";
import { Info, Plus, Printer } from "lucide-react";
import type { AppData, QuoteRecord, SaleRecord, TaxApiIntegration } from "./types";
import { emptyQuote } from "./data/quote-defaults";
import { loadData, saveData } from "./lib/storage";
import { quoteHasContent, quoteSubtotal, quoteTotal, quoteVat } from "./lib/quote-calc";
import { uid } from "./lib/id";
import { getTaxInvoiceStatus, issueTaxInvoice } from "./lib/tax-invoice";
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

function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [view, setView] = useState<View>("quote");
  const [draftQuote, setDraftQuote] = useState<QuoteRecord>(() => emptyQuote());
  const [activeQuoteId, setActiveQuoteId] = useState(data.quotes[0]?.id ?? "");
  const [issueQuoteId, setIssueQuoteId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [approvingQuoteId, setApprovingQuoteId] = useState("");
  const [showLanding, setShowLanding] = useState(true);
  const approvingIds = useRef(new Set<string>());

  useEffect(() => {
    saveData(data);
  }, [data]);

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

  const startFromLanding = () => {
    const quote = emptyQuote();
    setDraftQuote(quote);
    setActiveQuoteId(quote.id);
    setView("quote");
    setShowLanding(false);
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
    const approved: QuoteRecord = {
      ...quote,
      customerId,
      customerSnapshot: quote.customerSnapshot ?? (customer ? {
        name: customer.name,
        businessNumber: customer.businessNumber,
        representativeName: customer.representativeName,
        address: customer.address,
        contactPerson: customer.contactPerson,
        contact: customer.contact,
        email: customer.email
      } : undefined),
      status: "approved",
      approvedAt: today(),
      invoiceDate: quote.invoiceDate || today(),
      invoiceStatus: "pending",
      popbillInvoiceId: quote.popbillInvoiceId
    };
    setData((prev) => {
      const quotes = prev.quotes.some((item) => item.id === quote.id)
        ? prev.quotes.map((item) => (item.id === quote.id ? approved : item))
        : [approved, ...prev.quotes];
      const previousSale = prev.sales.find((record) => record.quoteId === quote.id);
      const sales: SaleRecord[] = previousSale
        ? prev.sales.map((record) =>
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
            ...prev.sales
          ];
      const saleForQuote = sales.find((record) => record.quoteId === quote.id);
      const syncedQuotes = saleForQuote
        ? quotes.map((item) => item.id === quote.id ? { ...item, paymentStatus: saleForQuote.paymentStatus } : item)
        : quotes;
      return { ...prev, quotes: syncedQuotes, sales, customers: syncCustomerTotals(prev.customers, sales, syncedQuotes) };
    });
    setActiveQuoteId(quote.id);
    setIssueQuoteId(quote.id);
    setView("issue");

    if (quote.invoiceIssuanceMode !== "auto" || !quote.invoiceType.issueInvoice) {
      setData((prev) => ({
        ...prev,
        quotes: prev.quotes.map((item) =>
          item.id === quote.id
            ? { ...item, invoiceStatus: "pending", invoiceNote: quote.invoiceType.issueInvoice ? "수동 발행 대기 중입니다." : "세금계산서 발행 대상이 아닙니다." }
            : item
        )
      }));
      approvingIds.current.delete(quote.id);
      setApprovingQuoteId("");
      return;
    }

    // 사업자번호가 없으면 자동 발행을 건너뛰고 실패로 표시한다.
    const invoiceCustomer = approved.customerSnapshot;
    if (!invoiceCustomer?.businessNumber) {
      setData((prev) => ({
        ...prev,
        quotes: prev.quotes.map((item) => (item.id === quote.id ? { ...item, invoiceStatus: "failed", invoiceNote: "고객 사업자번호가 없어 발행할 수 없습니다." } : item))
      }));
      approvingIds.current.delete(quote.id);
      setApprovingQuoteId("");
      return;
    }

    const result = await issueTaxInvoice({
      quoteId: quote.id,
      projectName: quote.form.projectName,
      writeDate: approved.invoiceDate || today(),
      supplyCost: quoteSubtotal(quote),
      tax: quoteVat(quote),
      total: quoteTotal(quote),
      items: quote.items.map((item) => ({
        name: `${item.category} ${item.description}`.trim(),
        supplyCost: item.price,
        tax: Math.round(item.price * 0.1)
      })),
      customer: {
        businessNumber: invoiceCustomer.businessNumber ?? "",
        name: invoiceCustomer.name,
        ceoName: invoiceCustomer.representativeName,
        email: invoiceCustomer.email,
        contactName: invoiceCustomer.contactPerson,
        address: invoiceCustomer.address
      }
    });

    setData((prev) => ({
      ...prev,
      quotes: prev.quotes.map((item) =>
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
        ? { ...prev.taxApiIntegration, lastIssuedAt: new Date().toISOString() }
        : prev.taxApiIntegration
    }));
    approvingIds.current.delete(quote.id);
    setApprovingQuoteId("");
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
      taxApiIntegration
    }));
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
      window.alert(`PDF 생성에 실패했습니다. ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clone.remove();
    }
  };

  const exportCsv = (quote: QuoteRecord) => {
    const rows = [
      ["견적ID", "발행일", "고객", "사업자번호", "프로젝트", "공급가", "부가세", "합계", "발행방식"],
      [
        quote.id,
        quote.invoiceDate || today(),
        quote.customerSnapshot?.name ?? data.customers.find((customer) => customer.id === quote.customerId)?.name ?? "",
        quote.customerSnapshot?.businessNumber ?? data.customers.find((customer) => customer.id === quote.customerId)?.businessNumber ?? "",
        quote.form.projectName,
        quoteSubtotal(quote),
        quoteVat(quote),
        quoteTotal(quote),
        quote.invoiceIssuanceMode
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

  if (showLanding) {
    return (
      <Landing
        onStart={startFromLanding}
      />
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">BB</span>
          <div>
            <strong>블링빌</strong>
            <small>견적서·세금계산서 발행</small>
          </div>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                aria-label={item.label}
                title={item.label}
                className={view === item.id ? "active" : ""}
                onClick={() => {
                  if (item.id === "issue") setIssueQuoteId(null);
                  setView(item.id);
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <button className="link sidebar-about" onClick={() => setShowLanding(true)}>
          <Info size={14} /> 앱 소개
        </button>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p>블링빌</p>
            <h1>{nav.find((item) => item.id === view)?.label}</h1>
          </div>
          {view === "quote" && (
            <div className="top-actions">
              <button className="ghost" onClick={handlePrint}>
                <Printer size={17} /> PDF 다운로드
              </button>
              <button
                onClick={createNewQuote}
              >
                <Plus size={17} /> 새 견적
              </button>
            </div>
          )}
        </header>

        {view === "quote" && (
          <QuoteBuilder
            quote={activeQuote}
            customers={data.customers}
            onSave={updateQuote}
            onApprove={approveQuote}
            logo={data.logoDataUrl}
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
            onExportCsv={exportCsv}
            isApproving={Boolean(issueQuoteId && approvingQuoteId === issueQuoteId)}
          />
        )}
        {view === "customers" && <CustomerManager data={data} setData={setData} />}
        {view === "vendors" && <VendorManager data={data} setData={setData} />}
        {view === "ledger" && <Ledger data={data} onPayment={recordPayment} onPurchasePayment={recordPurchasePayment} />}
        {view === "items" && <ItemInsights data={data} />}
        {view === "dashboard" && <Dashboard data={data} totals={totals} />}
        {view === "settings" && <SettingsView integration={data.taxApiIntegration} onChange={updateTaxApiIntegration} />}
      </main>
    </div>
  );
}

export default App;
