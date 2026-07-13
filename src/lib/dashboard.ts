import type { AppData, PurchaseRecord, SaleRecord } from "../types";
import { monthKey, yearKey } from "./date";

export type DashboardPeriod = "month" | "year";

export type SalePaymentEvent = {
  sale: SaleRecord;
  date: string;
  amount: number;
};

export type PurchasePaymentEvent = {
  purchase: PurchaseRecord;
  date: string;
  amount: number;
};

const matchesPeriod = (value: string, period: DashboardPeriod, key: string) =>
  (period === "month" ? monthKey(value) : yearKey(value)) === key;

export const saleRecordDate = (data: AppData, sale: SaleRecord) =>
  data.quotes.find((quote) => quote.id === sale.quoteId)?.approvedAt || sale.createdAt;

export function dashboardPeriodData(data: AppData, period: DashboardPeriod, key: string) {
  const sales = data.sales.filter((sale) => matchesPeriod(saleRecordDate(data, sale), period, key));
  const purchases = data.purchases.filter((purchase) =>
    matchesPeriod(purchase.purchaseDate || purchase.createdAt, period, key)
  );
  const payments: SalePaymentEvent[] = data.sales.flatMap((sale) =>
    sale.payments
      .filter((payment) => matchesPeriod(payment.date, period, key))
      .map((payment) => ({ sale, ...payment }))
  );
  const purchasePayments: PurchasePaymentEvent[] = data.purchases.flatMap((purchase) =>
    purchase.payments
      .filter((payment) => matchesPeriod(payment.date, period, key))
      .map((payment) => ({ purchase, ...payment }))
  );
  const salesTotal = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const unpaid = sales.reduce((sum, sale) => sum + Math.max(0, sale.amount - sale.paidAmount), 0);
  const purchaseCost = purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);

  return {
    sales,
    purchases,
    payments,
    purchasePayments,
    totals: {
      sales: salesTotal,
      paid: payments.reduce((sum, payment) => sum + payment.amount, 0),
      unpaid,
      expense: purchasePayments.reduce((sum, payment) => sum + payment.amount, 0),
      purchaseCost,
      margin: salesTotal - purchaseCost,
      overdueCustomers: new Set(sales.filter((sale) => sale.paymentStatus !== "paid").map((sale) => sale.customerId)).size
    }
  };
}
