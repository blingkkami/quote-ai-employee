import { useEffect, useRef, useState } from "react";
import { BookOpen, Download, LogOut, RefreshCw, Save, Settings2, Upload } from "lucide-react";
import type { AppData, TaxApiIntegration, TaxApiProvider } from "../types";
import { SectionTitle } from "../components/SectionTitle";
import { Input } from "../components/Input";
import { Status } from "../components/Status";
import { connectPopbill, disconnectPopbill } from "../lib/popbill-access";
import { formatBusinessNumber } from "../lib/input-format";
import { exportBackup, parseBackup } from "../lib/backup";
import { PopbillGuide } from "./PopbillGuide";

const providerLabels: Record<TaxApiProvider, string> = {
  popbill: "팝빌",
  barobill: "바로빌",
  hometax: "홈택스"
};

type ConnectionCheck = { configured: boolean; environment?: string; missing?: string[]; message: string };

export function SettingsView({ integration, onChange, data, onRestore }: { integration: TaxApiIntegration; onChange: (integration: TaxApiIntegration) => void; data: AppData; onRestore: (next: AppData) => void }) {
  const [draft, setDraft] = useState(integration);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ConnectionCheck | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [activeTab, setActiveTab] = useState<"settings" | "guide">("settings");
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseBackup(String(reader.result ?? ""));
        if (window.confirm("현재 브라우저의 데이터가 백업 파일 내용으로 교체됩니다. 계속할까요?")) {
          onRestore(parsed);
          window.alert("백업을 불러왔습니다.");
        }
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "백업 파일을 불러오지 못했습니다.");
      }
    };
    reader.onerror = () => window.alert("백업 파일을 읽지 못했습니다.");
    reader.readAsText(file);
  };

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
      if (accessToken.trim()) {
        const connected = await connectPopbill(accessToken.trim());
        if (!connected.ok) {
          setResult(connected);
          onChange({ ...draft, isConnected: false, lastTestedAt: new Date().toISOString() });
          return;
        }
        setAccessToken("");
      }
      const response = await fetch("/api/popbill/status", { credentials: "same-origin" });
      if (!response.headers.get("content-type")?.includes("application/json")) {
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
  const disconnectConnection = async () => {
    setChecking(true);
    try {
      const next = await disconnectPopbill();
      setResult(next);
      setAccessToken("");
      onChange({ ...draft, isConnected: false, lastTestedAt: new Date().toISOString() });
    } catch (error) {
      setResult({ configured: false, message: error instanceof Error ? error.message : "연결을 해제하지 못했습니다." });
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="settings-page">
      <div className="panel settings-card">
        <div className="settings-card-head">
          <SectionTitle title="세금계산서 API 연동" hint="최초 1회 연결 후 같은 브라우저에서 팝빌 자동 발행을 계속 사용합니다." />
          <Status tone={draft.isConnected ? "issued" : "pending"}>{draft.isConnected ? "연결 확인" : "미연결"}</Status>
        </div>

        <div className="settings-tabs" role="tablist" aria-label="팝빌 설정 메뉴">
          <button role="tab" aria-selected={activeTab === "settings"} className={activeTab === "settings" ? "active" : ""} onClick={() => setActiveTab("settings")}><Settings2 size={16} /> 연동 설정</button>
          <button role="tab" aria-selected={activeTab === "guide"} className={activeTab === "guide" ? "active" : ""} onClick={() => setActiveTab("guide")}><BookOpen size={16} /> 등록·발행 가이드</button>
        </div>

        {activeTab === "settings" ? <div className="settings-content">
          <div className="settings-section">
            <SectionTitle title="기본 정보" hint="세금계산서를 발행할 공급자 정보를 입력합니다." />
            <div className="grid two">
              <label>연동 업체<select value={draft.provider} onChange={(event) => { patchDraft({ provider: event.target.value as TaxApiProvider, isConnected: false }); setResult(null); }}><option value="popbill">팝빌</option><option value="barobill" disabled>바로빌 · 준비 중</option><option value="hometax" disabled>홈택스 · 준비 중</option></select></label>
              <Input label="공급자 사업자등록번호" value={draft.businessNumber} placeholder="000-00-00000" inputMode="numeric" maxLength={12} format={formatBusinessNumber} onChange={(value) => patchDraft({ businessNumber: value })} />
              <Input label="발행 담당자 이메일" value={draft.contactEmail} placeholder="tax@example.com" onChange={(value) => patchDraft({ contactEmail: value })} />
              <Input label="메모" value={draft.memo ?? ""} placeholder="발행 담당자 또는 확인사항" onChange={(value) => patchDraft({ memo: value })} />
            </div>
          </div>

          <div className="secure-box">
            <SectionTitle title="팝빌 최초 연결" hint="팝빌 등록 과정에서 발급받은 보안키를 한 번 입력하면 이후에는 다시 입력하지 않습니다." />
            <Input
              label="발행 보안키"
              type="password"
              value={accessToken}
              placeholder="발급받은 보안키 입력"
              onChange={(value) => {
                setAccessToken(value);
                setResult(null);
              }}
            />
            {result && <div className={result.configured ? "notice" : "alert danger-alert"}>{result.message}{result.environment ? ` 현재 ${result.environment === "production" ? "운영" : "테스트"} 환경입니다.` : ""}</div>}
          </div>

          <div className="settings-summary">
            <span>사용 업체: {providerLabels[draft.provider]}</span>
            <span>마지막 확인: {draft.lastTestedAt ? new Date(draft.lastTestedAt).toLocaleString("ko-KR") : "없음"}</span>
            <span>마지막 실제 발행: {draft.lastIssuedAt ? new Date(draft.lastIssuedAt).toLocaleString("ko-KR") : "없음"}</span>
          </div>

          <div className="actions settings-actions">
            <button onClick={checkConnection} disabled={checking}><RefreshCw size={16} /> {checking ? "확인 중" : accessToken ? "연결하고 상태 확인" : "연결 상태 확인"}</button>
            <button className="ghost" onClick={saveSettings}><Save size={16} /> 기본정보 저장</button>
            <button className="ghost" onClick={disconnectConnection} disabled={checking}><LogOut size={16} /> 이 브라우저 연결 해제</button>
          </div>
        </div> : <PopbillGuide onUseAccessToken={(token) => { setAccessToken(token); setResult(null); setActiveTab("settings"); }} />}
      </div>

      <div className="panel">
        <SectionTitle title="데이터 백업" hint="파일로 내보내 안전하게 보관하거나, 백업 파일에서 데이터를 복원합니다." />
        <p className="muted">모든 데이터는 이 브라우저에만 저장됩니다. 정기적으로 내보내기해 파일을 안전한 곳에 보관하세요.</p>
        <div className="actions">
          <button onClick={() => exportBackup(data)}><Download size={16} /> 데이터 내보내기</button>
          <button className="ghost" onClick={() => importInputRef.current?.click()}><Upload size={16} /> 백업 파일 가져오기</button>
        </div>
        <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={handleImportFile} />
      </div>
    </section>
  );
}
