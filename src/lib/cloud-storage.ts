import type { AppData } from "../types";
import { mergeAppData } from "./storage";
import { requireSupabase } from "./supabase";

type AppDataRow = {
  data: Partial<AppData>;
  updated_at: string;
};

export type CloudDataResult = {
  data: AppData | null;
  updatedAt?: string;
};

export async function loadCloudData(userId: string): Promise<CloudDataResult> {
  const { data, error } = await requireSupabase()
    .from("app_data")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle<AppDataRow>();

  if (error) throw new Error(`데이터를 불러오지 못했습니다. ${error.message}`);
  if (!data) return { data: null };

  return {
    data: mergeAppData(data.data),
    updatedAt: data.updated_at
  };
}

export async function saveCloudData(userId: string, data: AppData) {
  const { error } = await requireSupabase()
    .from("app_data")
    .upsert({ user_id: userId, data }, { onConflict: "user_id" });

  if (error) throw new Error(`데이터를 저장하지 못했습니다. ${error.message}`);
}

export function hasAppContent(data: AppData) {
  return Boolean(
    data.quotes.length
    || data.customers.length
    || data.vendors.length
    || data.sales.length
    || data.purchases.length
    || data.logoDataUrl
    || data.workspaceProfile.businessName
    || data.workspaceProfile.stampDataUrl
    || data.workspaceProfile.paymentAccount.bankName
    || data.workspaceProfile.paymentAccount.accountNumber
    || data.workspaceProfile.paymentAccount.accountHolder
    || data.taxApiIntegration.businessNumber
    || data.taxApiIntegration.contactEmail
    || data.taxApiIntegration.memo
    || data.taxApiIntegration.isConnected
  );
}
