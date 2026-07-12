import type { Customer, QuoteRecord, SaleRecord } from "../types";

export function syncCustomerTotals(customers: Customer[], sales: SaleRecord[], quotes: QuoteRecord[]) {
  return customers.map((customer) => {
    const customerSales = sales.filter((sale) => sale.customerId === customer.id);
    const quoteDates = quotes
      .filter((quote) => quote.customerId === customer.id)
      .map((quote) => quote.form.quoteDate || quote.createdAt.slice(0, 10))
      .filter(Boolean)
      .sort();
    return {
      ...customer,
      totalSales: customerSales.reduce((sum, sale) => sum + sale.amount, 0),
      unpaidAmount: customerSales.reduce((sum, sale) => sum + Math.max(0, sale.amount - sale.paidAmount), 0),
      firstQuoteAt: quoteDates[0] ?? "",
      lastQuoteAt: quoteDates[quoteDates.length - 1] ?? ""
    };
  });
}
