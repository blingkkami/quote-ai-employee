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

export type BusinessStatusResult = {
  ok: boolean;
  checked: boolean;
  active: boolean | null;
  message: string;
};

export const checkBusinessStatus = async (businessNumber: string): Promise<BusinessStatusResult> => {
  try {
    const response = await authorizedFetch("/api/popbill/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "status", businessNumber })
    });
    const result = await response.json() as Partial<BusinessStatusResult>;
    return {
      ok: response.ok && Boolean(result.ok),
      checked: Boolean(result.checked),
      active: result.active ?? null,
      message: result.message || `사업자 상태조회에 실패했습니다. (HTTP ${response.status})`
    };
  } catch (error) {
    return { ok: false, checked: false, active: null, message: error instanceof Error ? error.message : String(error) };
  }
};

export type CompanyLookupResult = {
  ok: boolean;
  found: boolean;
  corpName?: string;
  ceoName?: string;
  address?: string;
  taxType?: "과세" | "면세" | "unknown";
  message: string;
};

export const lookupCompany = async (businessNumber: string): Promise<CompanyLookupResult> => {
  try {
    const response = await authorizedFetch("/api/popbill/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "lookup", businessNumber })
    });
    const result = await response.json() as Partial<CompanyLookupResult>;
    return {
      ok: response.ok && Boolean(result.ok),
      found: Boolean(result.found),
      corpName: result.corpName,
      ceoName: result.ceoName,
      address: result.address,
      taxType: result.taxType,
      message: result.message || `기업정보조회에 실패했습니다. (HTTP ${response.status})`
    };
  } catch (error) {
    return { ok: false, found: false, message: error instanceof Error ? error.message : String(error) };
  }
};
