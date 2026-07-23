import { useCallback, useEffect, useState } from "react";
import type { BillingProfile } from "../types";
import { requireSupabase } from "../lib/supabase";

const freeBilling: BillingProfile = {
  planId: "free",
  status: "active",
  creditBalance: 0,
  includedInvoiceUsed: 0,
  allowanceStartedAt: new Date(0).toISOString(),
  allowanceEndsAt: new Date(0).toISOString()
};

export function useBillingAccount(userId?: string) {
  const [billing, setBilling] = useState<BillingProfile>(freeBilling);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setBilling(freeBilling);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await requireSupabase()
        .from("billing_accounts")
        .select("plan_id, status, credit_balance, included_invoice_used, allowance_started_at, allowance_ends_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error || !data) return;
      setBilling({
        planId: data.plan_id,
        status: data.status,
        creditBalance: data.credit_balance,
        includedInvoiceUsed: data.included_invoice_used,
        allowanceStartedAt: data.allowance_started_at,
        allowanceEndsAt: data.allowance_ends_at
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { billing, loading, refresh };
}

export type BillingOrder = {
  id: string;
  productType: "subscription" | "credits";
  productId: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "cancelled" | "refunded";
  scheduledAt?: string;
  paidAt?: string;
  createdAt: string;
};

export type CreditLedgerEntry = {
  id: string;
  delta: number;
  balanceAfter: number;
  reason: "signup" | "purchase" | "tax_invoice" | "quote_pdf" | "transaction_statement" | "email" | "unpaid_notice" | "refund" | "adjustment";
  createdAt: string;
};

export function useBillingHistory(userId?: string) {
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setOrders([]);
      setLedger([]);
      return;
    }
    setLoading(true);
    try {
      const client = requireSupabase();
      const [orderResult, ledgerResult] = await Promise.all([
        client
          .from("billing_orders")
          .select("id, product_type, product_id, amount, status, scheduled_at, paid_at, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
        client
          .from("credit_ledger")
          .select("id, delta, balance_after, reason, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20)
      ]);
      if (!orderResult.error) {
        setOrders((orderResult.data ?? []).map((item) => ({
          id: item.id,
          productType: item.product_type,
          productId: item.product_id,
          amount: item.amount,
          status: item.status,
          scheduledAt: item.scheduled_at ?? undefined,
          paidAt: item.paid_at ?? undefined,
          createdAt: item.created_at
        })));
      }
      if (!ledgerResult.error) {
        setLedger((ledgerResult.data ?? []).map((item) => ({
          id: item.id,
          delta: item.delta,
          balanceAfter: item.balance_after,
          reason: item.reason,
          createdAt: item.created_at
        })));
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { orders, ledger, loading, refresh };
}
