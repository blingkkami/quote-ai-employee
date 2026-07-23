import { useState } from "react";
import { Check, CreditCard, History, LoaderCircle, ShieldCheck, WalletCards } from "lucide-react";
import type { BillingProfile } from "../types";
import { BILLING_ENABLED, billingPlans, creditPackages, formatWon, type CreditPackageId, type PlanId } from "../lib/billing-plans";
import { startBillingCheckout, type BillingProductId } from "../lib/billing-checkout";
import { SectionTitle } from "../components/SectionTitle";
import { useBillingHistory } from "../hooks/useBillingAccount";

const planName = (planId: PlanId) => billingPlans.find((plan) => plan.id === planId)?.name ?? "무료 + 크레딧";
const productName = (productId: string) =>
  billingPlans.find((plan) => plan.id === productId)?.name
  ?? creditPackages.find((item) => item.id === productId)?.credits.toLocaleString("ko-KR").concat("cr")
  ?? productId;
const dateTime = (value?: string) => value ? new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "-";
const orderStatus = {
  pending: "결제 예약",
  paid: "결제 완료",
  failed: "결제 실패",
  cancelled: "취소",
  refunded: "환불"
} as const;
const creditReason = {
  signup: "가입 혜택",
  purchase: "크레딧 구매",
  tax_invoice: "세금계산서",
  quote_pdf: "견적서 PDF",
  transaction_statement: "거래명세서",
  email: "이메일 발송",
  unpaid_notice: "미수 안내",
  refund: "사용 복구",
  adjustment: "관리자 조정"
} as const;

export function BillingView({
  billing,
  userId,
  onRefresh
}: {
  billing: BillingProfile;
  userId: string;
  onRefresh: () => Promise<void>;
}) {
  const [processing, setProcessing] = useState<BillingProductId | "">("");
  const history = useBillingHistory(userId);

  const checkout = async (productId: BillingProductId) => {
    if (!BILLING_ENABLED) {
      window.alert("유료 결제는 정식 오픈 준비 중입니다. 지금은 모든 기능을 무료로 사용하실 수 있어요.");
      return;
    }
    if (processing) return;
    setProcessing(productId);
    try {
      const result = await startBillingCheckout(productId);
      if (!("redirected" in result)) {
        await Promise.all([onRefresh(), history.refresh()]);
        window.alert(result.message || "결제가 완료되었습니다.");
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    } finally {
      setProcessing("");
    }
  };

  const currentPlan = billingPlans.find((plan) => plan.id === billing.planId) ?? billingPlans[0];
  const remainingIncluded = Math.max(0, currentPlan.includedTaxInvoices - billing.includedInvoiceUsed);

  return (
    <section className="billing-page">
      {!BILLING_ENABLED && (
        <div className="notice billing-preview-note">
          <strong>지금은 모든 기능을 무료로 사용하실 수 있습니다.</strong>
          <span>아래 요금제와 크레딧은 정식 오픈 예정 안내이며, 실제 결제는 아직 진행되지 않습니다.</span>
        </div>
      )}
      <div className="billing-summary-grid">
        <div className="panel billing-summary-card">
          <span><ShieldCheck size={18} /> 현재 요금제</span>
          <strong>{planName(billing.planId)}</strong>
          <small>
            {billing.status === "past_due"
              ? "결제 실패 · 기능 사용을 확인해 주세요"
              : currentPlan.monthlyPrice
                ? `${formatWon(currentPlan.monthlyPrice)}/월 · ${new Date(billing.allowanceEndsAt).toLocaleDateString("ko-KR")}까지`
                : "월 이용료 없음"}
          </small>
        </div>
        <div className="panel billing-summary-card">
          <span><WalletCards size={18} /> 보유 크레딧</span>
          <strong>{billing.creditBalance.toLocaleString("ko-KR")}cr</strong>
          <small>자동 충전·자동 초과 결제 없음</small>
        </div>
        <div className="panel billing-summary-card">
          <span><CreditCard size={18} /> 이번 달 세금계산서</span>
          <strong>{currentPlan.includedTaxInvoices ? `${remainingIncluded}건 남음` : "크레딧 사용"}</strong>
          <small>{currentPlan.includedTaxInvoices ? `${billing.includedInvoiceUsed}/${currentPlan.includedTaxInvoices}건 사용` : "발행 1건당 2cr"}</small>
        </div>
      </div>

      <div className="panel billing-products">
        <SectionTitle title="정액권 선택" hint="입문과 Pro의 1cr 발행·발송 기능은 무제한이며, Pro 50과 100은 포함 건수만 다릅니다." />
        <div className="billing-plan-grid">
          {billingPlans.filter((plan) => plan.id !== "free").map((plan) => (
            <article key={plan.id} className={billing.planId === plan.id ? "current" : ""}>
              <span>{billing.planId === plan.id ? "현재 이용 중" : plan.id === "starter" ? "기본 관리" : "운영 현황 포함"}</span>
              <h3>{plan.name}</h3>
              <strong>{formatWon(plan.monthlyPrice)}<small>/월</small></strong>
              <ul>
                <li><Check size={15} /> 세금계산서 월 {plan.includedTaxInvoices}건</li>
                <li><Check size={15} /> PDF·거래명세서·메일 무제한</li>
                <li><Check size={15} /> 원장·미수·매입 관리</li>
                {plan.operationsDashboard && <li><Check size={15} /> 운영 현황 대시보드</li>}
              </ul>
              <button
                disabled={Boolean(processing) || billing.planId !== "free"}
                onClick={() => void checkout(plan.id as BillingProductId)}
              >
                {processing === plan.id ? <LoaderCircle className="spin" size={16} /> : <CreditCard size={16} />}
                {billing.planId === plan.id ? "이용 중" : billing.planId !== "free" ? "변경 정책 확정 후" : "정기결제 시작"}
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="panel billing-products">
        <SectionTitle title="크레딧 추가 구매" hint="무료 사용자는 발행·발송 시 차감하고, 정액권 사용자는 세금계산서 포함 건수 소진 후 사용합니다." />
        <div className="billing-credit-grid">
          {creditPackages.map((item) => (
            <article key={item.id}>
              <strong>{item.credits}cr</strong>
              <span>{formatWon(item.price)}</span>
              <small>{Math.round(item.price / item.credits).toLocaleString("ko-KR")}원/cr</small>
              <button disabled={Boolean(processing)} onClick={() => void checkout(item.id as CreditPackageId)}>
                {processing === item.id ? <LoaderCircle className="spin" size={16} /> : <CreditCard size={16} />} 구매
              </button>
            </article>
          ))}
        </div>
        <p className="billing-policy-note">결제 금액과 상태는 브라우저 응답을 믿지 않고 서버가 PortOne에서 다시 조회한 뒤에만 요금제 또는 크레딧을 적용합니다.</p>
      </div>

      <div className="panel billing-history-panel">
        <SectionTitle title="결제·크레딧 내역" hint="최근 20건을 표시합니다. 실패한 외부 발행·발송은 같은 승인 번호로 자동 복구됩니다." />
        <div className="billing-history-grid">
          <section>
            <h3><CreditCard size={17} /> 결제 주문</h3>
            <div className="billing-table-wrap">
              <table>
                <thead>
                  <tr><th>일시</th><th>상품</th><th>금액</th><th>상태</th></tr>
                </thead>
                <tbody>
                  {history.orders.map((order) => (
                    <tr key={order.id}>
                      <td>{dateTime(order.paidAt ?? order.scheduledAt ?? order.createdAt)}</td>
                      <td>{productName(order.productId)}</td>
                      <td>{formatWon(order.amount)}</td>
                      <td><span className={`billing-status ${order.status}`}>{orderStatus[order.status]}</span></td>
                    </tr>
                  ))}
                  {!history.loading && history.orders.length === 0 && (
                    <tr><td colSpan={4} className="billing-empty">아직 결제 내역이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h3><History size={17} /> 크레딧 증감</h3>
            <div className="billing-table-wrap">
              <table>
                <thead>
                  <tr><th>일시</th><th>내용</th><th>증감</th><th>잔액</th></tr>
                </thead>
                <tbody>
                  {history.ledger.map((entry) => (
                    <tr key={entry.id}>
                      <td>{dateTime(entry.createdAt)}</td>
                      <td>{creditReason[entry.reason]}</td>
                      <td className={entry.delta > 0 ? "credit-plus" : "credit-minus"}>
                        {entry.delta > 0 ? "+" : ""}{entry.delta}cr
                      </td>
                      <td>{entry.balanceAfter}cr</td>
                    </tr>
                  ))}
                  {!history.loading && history.ledger.length === 0 && (
                    <tr><td colSpan={4} className="billing-empty">아직 크레딧 내역이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
