import { authorizedFetch } from "./authorized-fetch";

export type IssueCashbillCustomer = {
  name: string;
  businessNumber?: string;
  phone?: string;
  email?: string;
  taxExempt?: boolean;
};

export type IssueCashbillPayload = {
  quoteId: string;
  projectName: string;
  writeDate: string;
  total: number;
  customer: IssueCashbillCustomer;
  tradeUsage?: "소득공제" | "지출증빙";
};

export type IssueCashbillResult = {
  ok: boolean;
  mode?: string;
  cashReceiptStatus: "pending" | "issued" | "failed";
  popbillCashbillId?: string;
  message?: string;
};

export async function issueCashbill(payload: IssueCashbillPayload): Promise<IssueCashbillResult> {
  try {
    const response = await authorizedFetch("/api/popbill/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, documentType: "cash" })
    });

    const result = (await response.json()) as IssueCashbillResult;

    if (!response.ok) {
      return {
        ok: false,
        cashReceiptStatus: result?.cashReceiptStatus === "pending" ? "pending" : "failed",
        message: result?.message || `현금영수증 발행 요청 실패 (HTTP ${response.status})`
      };
    }

    return result;
  } catch (error) {
    return {
      ok: false,
      cashReceiptStatus: "failed",
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
