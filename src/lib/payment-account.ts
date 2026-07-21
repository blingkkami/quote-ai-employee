import type { WorkspaceProfile } from "../types";

export function hasPaymentAccount(profile: WorkspaceProfile) {
  const account = profile.paymentAccount;
  return Boolean(account.bankName.trim() && account.accountNumber.trim() && account.accountHolder.trim());
}

export function paymentAccountText(profile: WorkspaceProfile) {
  const account = profile.paymentAccount;
  if (!hasPaymentAccount(profile)) return "";
  return `${account.bankName.trim()} · ${account.accountNumber.trim()} · 예금주 ${account.accountHolder.trim()}`;
}

