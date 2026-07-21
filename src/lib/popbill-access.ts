import { authorizedFetch } from "./authorized-fetch";

export type PopbillProfile = {
  businessNumber: string;
  corpName: string;
  ceoName: string;
  address: string;
  bizType: string;
  bizClass: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  popbillUserId: string;
  popbillPassword?: string;
};

export type PopbillConnectionResult = {
  ok: boolean;
  configured: boolean;
  needsSignup?: boolean;
  existingMember?: boolean;
  environment?: "test" | "production";
  connection?: Record<string, string>;
  message: string;
};

const parseResult = async (response: Response): Promise<PopbillConnectionResult> => {
  const result = await response.json() as Partial<PopbillConnectionResult>;
  return {
    ...result,
    ok: response.ok && Boolean(result.ok),
    configured: response.ok && Boolean(result.configured),
    message: result.message || `팝빌 연결 요청에 실패했습니다. (HTTP ${response.status})`
  };
};

export const checkPopbill = async (businessNumber: string) => parseResult(await authorizedFetch("/api/popbill/connect", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mode: "check", businessNumber })
}));

export const joinPopbill = async (profile: PopbillProfile) => parseResult(await authorizedFetch("/api/popbill/connect", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mode: "join", profile })
}));

export const getPopbillStatus = async () => parseResult(await authorizedFetch("/api/popbill/status"));

export const disconnectPopbill = async () => parseResult(await authorizedFetch("/api/popbill/connect", {
  method: "DELETE"
}));
