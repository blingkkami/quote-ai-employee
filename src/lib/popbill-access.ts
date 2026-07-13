export type PopbillConnectionResult = {
  ok: boolean;
  configured: boolean;
  message: string;
};

const parseResult = async (response: Response): Promise<PopbillConnectionResult> => {
  const result = await response.json() as Partial<PopbillConnectionResult>;
  return {
    ok: response.ok && Boolean(result.ok),
    configured: response.ok && Boolean(result.configured),
    message: result.message || `팝빌 연결 요청에 실패했습니다. (HTTP ${response.status})`
  };
};

export const connectPopbill = async (accessToken: string) => parseResult(await fetch("/api/popbill/connect", {
  method: "POST",
  credentials: "same-origin",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ accessToken })
}));

export const disconnectPopbill = async () => parseResult(await fetch("/api/popbill/connect", {
  method: "DELETE",
  credentials: "same-origin"
}));
