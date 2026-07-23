import { authorizedFetch } from "./authorized-fetch";

export type UnpaidNoticeResult = {
  ok: boolean;
  emailId?: string;
  provider?: string;
  sender?: string;
  recipient?: string;
  totalAmount?: number;
  message?: string;
};

export async function sendUnpaidNotice(customerId: string, billingReference: string): Promise<UnpaidNoticeResult> {
  const response = await authorizedFetch("/api/email/send-unpaid-notice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerId, billingReference })
  });
  const result = (await response.json()) as UnpaidNoticeResult;
  if (!response.ok) throw new Error(result.message || `미수금 안내 발송 실패 (HTTP ${response.status})`);
  return result;
}
