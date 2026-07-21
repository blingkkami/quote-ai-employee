import { authorizedFetch } from "./authorized-fetch";

export type EmailProvider = "google" | "microsoft" | "naver" | "smtp";

export type EmailConnectionStatus = {
  ok: boolean;
  connected: boolean;
  provider?: EmailProvider;
  email?: string;
  displayName?: string;
  connectedAt?: string;
  message?: string;
};

async function readResult(response: Response): Promise<EmailConnectionStatus & { authorizationUrl?: string }> {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new Error("메일 연결 서버의 응답을 확인하지 못했습니다.");
  const result = await response.json() as EmailConnectionStatus & { authorizationUrl?: string };
  if (!response.ok) throw new Error(result.message || `메일 연결 요청에 실패했습니다. (HTTP ${response.status})`);
  return result;
}

export async function getEmailConnectionStatus() {
  return readResult(await authorizedFetch("/api/email/status"));
}

export async function startEmailOAuth(provider: "google" | "microsoft") {
  const result = await readResult(await authorizedFetch("/api/email/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider })
  }));
  if (!result.authorizationUrl) throw new Error("메일 계정 승인 주소를 받지 못했습니다.");
  window.location.assign(result.authorizationUrl);
}

export async function connectSmtpEmail(input: {
  provider: "naver" | "smtp";
  fromEmail: string;
  fromName?: string;
  username?: string;
  password: string;
  host?: string;
  port?: number;
  secure?: boolean;
}) {
  return readResult(await authorizedFetch("/api/email/smtp-connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  }));
}

export async function disconnectEmail() {
  return readResult(await authorizedFetch("/api/email/connect", { method: "DELETE" }));
}

