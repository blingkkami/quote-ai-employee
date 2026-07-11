import type { AppData } from "../types";
import { money } from "../lib/format";
import { payLabels } from "../constants";
import { Status } from "../components/Status";
import { DataTable } from "../components/DataTable";

export function Ledger({ data, onPayment }: { data: AppData; onPayment: (saleId: string, amount: number) => void }) {
  return (
    <section className="panel">
      <DataTable
        headers={["고객", "프로젝트", "매출", "입금", "미수금", "수금 상태", "빠른 수금"]}
        rows={data.sales.map((sale) => {
          const quote = data.quotes.find((item) => item.id === sale.quoteId);
          const customer = data.customers.find((item) => item.id === sale.customerId);
          return [
            customer?.name ?? "-",
            quote?.form.projectName ?? "-",
            `${money(sale.amount)}원`,
            `${money(sale.paidAmount)}원`,
            `${money(sale.amount - sale.paidAmount)}원`,
            <Status key="status" tone={sale.paymentStatus}>{payLabels[sale.paymentStatus]}</Status>,
            <button key="pay" className="ghost" disabled={sale.paymentStatus === "paid"} onClick={() => onPayment(sale.id, sale.amount - sale.paidAmount)}>잔액 수금</button>
          ];
        })}
      />
    </section>
  );
}
