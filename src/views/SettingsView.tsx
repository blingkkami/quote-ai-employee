import { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import type { TaxApiIntegration, TaxApiProvider } from "../types";
import { SectionTitle } from "../components/SectionTitle";
import { Input } from "../components/Input";
import { Status } from "../components/Status";
import { getPopbillAccessToken, popbillAccessHeaders, setPopbillAccessToken } from "../lib/popbill-access";

const providerLabels: Record<TaxApiProvider, string> = {
  popbill: "팝빌",
  barobill: "바로빌",
  hometax: "홈택스"
};

type ConnectionCheck = { configured: boolean; environment?: string; missing?: string[]; message: string };

export function SettingsView({ integration, onChange }: { integration: TaxApiIntegration; onChange: (integration: TaxApiIntegration) => void }) {
  const [draft, setDraft] = useState(integration);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ConnectionCheck | null>(null);
  const [accessToken, setAccessToken] = useState(() => getPopbillAccessToken());

  useEffect(() => setDraft(integration), [integration]);
  const patchDraft = (patch: Partial<TaxApiIntegration>) => setDraft((prev) => ({ ...prev, ...patch }));

  const saveSettings = () => onChange({ ...draft, isConnected: result?.configured ?? draft.isConnected });
  const checkConnection = async () => {
    setChecking(true);
    try {
      if (draft.provider !== "popbill") {
        const next = { configured: false, message: `${providerLabels[draft.provider]} 연결은 아직 지원하지 않습니다.` };
        setResult(next);
        onChange({ ...draft, isConnected: false, lastTestedAt: new Date().toISOString() });
        return;
      }
      if (!accessToken.trim()) {
        const next = { configured: false, message: "발행 보안키를 입력해 주세요." };
        setResult(next);
        onChange({ ...draft, isConnected: false, lastTestedAt: new Date().toISOString() });
        return;
      }
      setPopbillAccessToken(accessToken.trim());
      const response = await fetch("/api/popbill/status", { headers: popbillAccessHeaders() });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("팝빌 서버 상태 응답을 확인할 수 없습니다.");
      }
      const next = await response.json() as ConnectionCheck;
      setResult(next);
      onChange({ ...draft, isConnected: Boolean(next.configured), lastTestedAt: new Date().toISOString() });
    } catch (error) {
      const next = { configured: false, message: error instanceof Error ? error.message : "연동 상태를 확인하지 못했습니다." };
      setResult(next);
      onChange({ ...draft, isConnected: false, lastTestedAt: new Date().toISOString() });
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="settings-page">
      <div className="panel settings-card">
        <div className="settings-card-head">
          <SectionTitle title="세금계산서 API 연동" hint="화면 입력값이 아니라 Vercel 서버 환경변수를 기준으로 실제 연결 상태를 확인합니다." />
          <Status tone={draft.isConnected ? "issued" : "pending"}>{draft.isConnected ? "서버 설정 확인" : "미연결"}</Status>
        </div>

        <div className="grid two">
          <label>연동 업체<select value={draft.provider} onChange={(event) => { patchDraft({ provider: event.target.value as TaxApiProvider, isConnected: false }); setResult(null); }}>{Object.entries(providerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <Input label="공급자 사업자등록번호" value={draft.businessNumber} placeholder="000-00-00000" onChange={(value) => patchDraft({ businessNumber: value })} />
          <Input label="발행 담당자 이메일" value={draft.contactEmail} placeholder="tax@example.com" onChange={(value) => patchDraft({ contactEmail: value })} />
          <Input label="메모" value={draft.memo ?? ""} placeholder="발행 담당자 또는 확인사항" onChange={(value) => patchDraft({ memo: value })} />
        </div>

        <div className="secure-box">
          <SectionTitle title="Vercel 서버 인증정보" hint="팝빌 비밀키는 서버에만 두고, 발행 보안키는 현재 브라우저 탭에만 보관합니다." />
          <Input
            label="발행 보안키"
            type="password"
            value={accessToken}
            placeholder="Vercel의 POPBILL_ACCESS_TOKEN"
            onChange={(value) => {
              setAccessToken(value);
              if (!value) setPopbillAccessToken("");
              setResult(null);
            }}
          />
          <div className="env-list">
            <code>POPBILL_LINK_ID</code><code>POPBILL_SECRET_KEY</code><code>POPBILL_CORP_NUM</code><code>POPBILL_CORP_NAME</code><code>POPBILL_CEO_NAME</code><code>POPBILL_USER_ID</code><code>POPBILL_ACCESS_TOKEN</code>
          </div>
          {result && <div className={result.configured ? "notice" : "alert danger-alert"}>{result.message}{result.environment ? ` 현재 ${result.environment === "production" ? "운영" : "테스트"} 환경입니다.` : ""}</div>}
        </div>

        <div className="settings-summary">
          <span>사용 업체: {providerLabels[draft.provider]}</span>
          <span>마지막 확인: {draft.lastTestedAt ? new Date(draft.lastTestedAt).toLocaleString("ko-KR") : "없음"}</span>
          <span>마지막 실제 발행: {draft.lastIssuedAt ? new Date(draft.lastIssuedAt).toLocaleString("ko-KR") : "없음"}</span>
        </div>

        <div className="actions">
          <button onClick={checkConnection} disabled={checking}><RefreshCw size={16} /> {checking ? "확인 중" : "서버 연동 상태 확인"}</button>
          <button className="ghost" onClick={saveSettings}><Save size={16} /> 기본정보 저장</button>
        </div>
      </div>
    </section>
  );
}
