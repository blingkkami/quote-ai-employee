import { useEffect, useMemo, useState } from "react";
import { Plus, Printer } from "lucide-react";
import type { AppData, QuoteRecord, TaxApiIntegration } from "./types";
import { emptyQuote } from "./data/quote-defaults";
import { loadData, saveData } from "./lib/storage";
import { quoteSubtotal, quoteTotal, quoteVat } from "./lib/quote-calc";
import { uid } from "./lib/id";
import { issueTaxInvoice } from "./lib/tax-invoice";
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

function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [view, setView] = useState<View>("quote");
  const [draftQuote, setDraftQuote] = useState<QuoteRecord>(() => emptyQuote());
  const [activeQuoteId, setActiveQuoteId] = useState(data.quotes[0]?.id ?? "");
  const [query, setQuery] = useState("");

  useEffect(() => saveData(data), [data]);

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
      overdueCustomers: data.sales.filter((sale) => sale.paymentStatus !== "paid").length
    };
  }, [data]);

  const updateQuote = (quote: QuoteRecord) => {
    const exists = data.quotes.some((item) => item.id === quote.id);
    setData((prev) => ({
      ...prev,
      quotes: exists
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
    const customerId = quote.customerId;
    if (!customerId) {
      window.alert("승인하려면 먼저 고객을 선택해 주세요.");
      return;
    }
    const amount = quoteTotal(quote);
    const approved: QuoteRecord = {
      ...quote,
      customerId,
      status: "approved",
      approvedAt: new Date().toISOString().slice(0, 10),
      invoiceStatus: "pending",
      popbillInvoiceId: quote.popbillInvoiceId
    };
    const sale = data.sales.find((record) => record.quoteId === quote.id);
    setData((prev) => ({
      ...prev,
      quotes: prev.quotes.some((item) => item.id === quote.id)
        ? prev.quotes.map((item) => (item.id === quote.id ? approved : item))
        : [approved, ...prev.quotes],
      sales: sale
        ? prev.sales.map((record) => (record.quoteId === quote.id ? { ...record, amount, updatedAt: new Date().toISOString() } : record))
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
          ],
      customers: prev.customers.map((customer) =>
        customer.id === customerId
          ? {
              ...customer,
              lastQuoteAt: new Date().toISOString().slice(0, 10),
              totalSales: prev.sales.some((record) => record.quoteId === quote.id) ? customer.totalSales : customer.totalSales + amount,
              unpaidAmount: prev.sales.some((record) => record.quoteId === quote.id) ? customer.unpaidAmount : customer.unpaidAmount + amount,
              updatedAt: new Date().toISOString()
            }
          : customer
      )
    }));
    setActiveQuoteId(quote.id);
    setView("issue");

    if (quote.invoiceIssuanceMode !== "auto") return;

    const customer = data.customers.find((item) => item.id === customerId);

    // 사업자번호가 없으면 자동 발행을 건너뛰고 실패로 표시한다.
    if (!customer?.businessNumber) {
      setData((prev) => ({
        ...prev,
        quotes: prev.quotes.map((item) => (item.id === quote.id ? { ...item, invoiceStatus: "failed", invoiceNote: "고객 사업자번호가 없어 발행할 수 없습니다." } : item))
      }));
      return;
    }

    const result = await issueTaxInvoice({
      quoteId: quote.id,
      projectName: quote.form.projectName,
      writeDate: quote.form.quoteDate || new Date().toISOString().slice(0, 10),
      supplyCost: quoteSubtotal(quote),
      tax: quoteVat(quote),
      total: quoteTotal(quote),
      items: quote.items.map((item) => ({
        name: `${item.category} ${item.description}`.trim(),
        supplyCost: item.price,
        tax: Math.round(item.price * 0.1)
      })),
      customer: {
        businessNumber: customer.businessNumber ?? "",
        name: customer.name,
        ceoName: customer.representativeName,
        email: customer.email,
        contactName: customer.contactPerson,
        address: customer.address
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
              invoiceNote: result.message
            }
          : item
      ),
      taxApiIntegration: result.ok
        ? { ...prev.taxApiIntegration, lastIssuedAt: new Date().toISOString() }
        : prev.taxApiIntegration
    }));
  };

  const recordPayment = (saleId: string, amount: number) => {
    if (!amount || amount < 1) return;
    setData((prev) => {
      const sales = prev.sales.map((sale) => {
        if (sale.id !== saleId) return sale;
        const paidAmount = Math.min(sale.amount, sale.paidAmount + amount);
        return {
          ...sale,
          paidAmount,
          paymentStatus: paidAmount >= sale.amount ? "paid" as const : "partial" as const,
          payments: [...sale.payments, { date: new Date().toISOString().slice(0, 10), amount }],
          updatedAt: new Date().toISOString()
        };
      });
      const customers = prev.customers.map((customer) => {
        const customerSales = sales.filter((sale) => sale.customerId === customer.id);
        return {
          ...customer,
          totalSales: customerSales.reduce((sum, sale) => sum + sale.amount, 0),
          unpaidAmount: customerSales.reduce((sum, sale) => sum + Math.max(0, sale.amount - sale.paidAmount), 0),
          updatedAt: new Date().toISOString()
        };
      });
      return { ...prev, sales, customers };
    });
  };

  const updateTaxApiIntegration = (taxApiIntegration: TaxApiIntegration) => {
    setData((prev) => ({
      ...prev,
      taxApiIntegration
    }));
  };

  const exportCsv = () => {
    const rows = [
      ["견적ID", "고객", "프로젝트", "공급가", "부가세", "합계", "발행방식"],
      ...data.quotes.map((quote) => [
        quote.id,
        data.customers.find((customer) => customer.id === quote.customerId)?.name ?? "",
        quote.form.projectName,
        quoteSubtotal(quote),
        quoteVat(quote),
        quoteTotal(quote),
        quote.invoiceIssuanceMode
      ])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `세금계산서_수동발행_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">BQ</span>
          <div>
            <strong>블링까미</strong>
            <small>AI Quote Employee</small>
          </div>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p>v7 운영 워크플로우</p>
            <h1>{nav.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className="top-actions">
            <button className="ghost" onClick={() => window.print()}>
              <Printer size={17} /> PDF/인쇄
            </button>
            <button
              onClick={createNewQuote}
            >
              <Plus size={17} /> 새 견적
            </button>
          </div>
        </header>

        {view === "quote" && (
          <QuoteBuilder
            quote={activeQuote}
            customers={data.customers}
            onSave={updateQuote}
            onApprove={approveQuote}
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
          />
        )}
        {view === "issue" && <IssueCenter quote={activeQuote} customers={data.customers} onApprove={approveQuote} onExportCsv={exportCsv} />}
        {view === "customers" && <CustomerManager data={data} setData={setData} />}
        {view === "vendors" && <VendorManager data={data} setData={setData} />}
        {view === "ledger" && <Ledger data={data} onPayment={recordPayment} />}
        {view === "items" && <ItemInsights data={data} />}
        {view === "dashboard" && <Dashboard data={data} totals={totals} />}
        {view === "settings" && <SettingsView integration={data.taxApiIntegration} onChange={updateTaxApiIntegration} />}
      </main>
    </div>
  );
}

export default App;
