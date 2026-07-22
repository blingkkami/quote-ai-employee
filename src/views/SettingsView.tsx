import { useEffect, useRef, useState } from "react";
import { BookOpen, CheckCircle2, Download, Link2, LoaderCircle, RefreshCw, Save, Settings2, Unlink, Upload } from "lucide-react";
import type { AppData, DocumentEmailSettings, TaxApiIntegration, WorkspaceProfile } from "../types";
import { SectionTitle } from "../components/SectionTitle";
import { Input } from "../components/Input";
import { AddressInput } from "../components/AddressInput";
import { Status } from "../components/Status";
import {
  checkBusinessStatus,
  checkPopbill,
  connectExistingPopbill,
  disconnectPopbill,
  getPopbillStatus,
  joinPopbill,
  lookupCompany,
  type BusinessStatusResult,
  type PopbillConnectionResult,
  type PopbillProfile
} from "../lib/popbill-access";
import { formatBusinessNumber, formatPhoneNumber } from "../lib/input-format";
import { exportBackup, parseBackup } from "../lib/backup";
import { PopbillGuide } from "./PopbillGuide";
import { EmailConnectionSettings } from "../components/EmailConnectionSettings";
import { BusinessBrandSettings } from "../components/BusinessBrandSettings";

const connectionField = (connection: Record<string, string> | undefined, name: string, fallback = "") => connection?.[name] || fallback;

export function SettingsView({ integration, onChange, data, onRestore, onDocumentEmailSettingsChange, onWorkspaceProfileChange, onLogoChange }: { integration: TaxApiIntegration; onChange: (integration: TaxApiIntegration) => void; data: AppData; onRestore: (next: AppData) => void; onDocumentEmailSettingsChange: (settings: DocumentEmailSettings) => void; onWorkspaceProfileChange: (profile: WorkspaceProfile) => void; onLogoChange: (logo?: string) => void }) {
  const [draft, setDraft] = useState(integration);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<PopbillConnectionResult | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [showExistingConnection, setShowExistingConnection] = useState(false);
  const [popbillPassword, setPopbillPassword] = useState("");
  const [activeTab, setActiveTab] = useState<"settings" | "guide">("settings");
  const [statusResult, setStatusResult] = useState<BusinessStatusResult | null>(null);
  const [profileLookupHint, setProfileLookupHint] = useState("");
  const lookedUpBizRef = useRef("");
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(integration), [integration]);

  // 기업정보조회 자동완성: 가입 정보 입력 중 사업자번호가 10자리가 되면 비어 있는 항목만 채운다.
  const profileBusinessNumber = draft.businessNumber;
  useEffect(() => {
    if (draft.isConnected) return;
    const biz = profileBusinessNumber.replace(/\D/g, "");
    if (biz.length !== 10) {
      setProfileLookupHint("");
      return;
    }
    if (lookedUpBizRef.current === biz) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      lookedUpBizRef.current = biz;
      try {
        const info = await lookupCompany(biz);
        if (cancelled || !info.ok || !info.found) return;
        let applied = false;
        setDraft((prev) => {
          const patch: Partial<TaxApiIntegration> = {};
          if (info.corpName && !prev.corpName?.trim()) patch.corpName = info.corpName;
          if (info.ceoName && !prev.ceoName?.trim()) patch.ceoName = info.ceoName;
          if (info.address && !prev.address?.trim()) patch.address = info.address;
          if (!Object.keys(patch).length) return prev;
          applied = true;
          return { ...prev, ...patch };
        });
        if (applied && !cancelled) setProfileLookupHint("사업자번호로 상호·대표자·주소를 자동으로 채웠어요. 필요하면 수정하세요.");
      } catch {
        // 조회 실패 시 수동 입력을 그대로 유지한다.
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft.isConnected, profileBusinessNumber]);
  const patchDraft = (patch: Partial<TaxApiIntegration>) => setDraft((prev) => ({ ...prev, ...patch }));

  const applyConnectedResult = (next: PopbillConnectionResult) => {
    const connection = next.connection;
    const connected: TaxApiIntegration = {
      ...draft,
      provider: "popbill",
      businessNumber: formatBusinessNumber(connectionField(connection, "corp_num", draft.businessNumber)),
      corpName: connectionField(connection, "corp_name", draft.corpName),
      ceoName: connectionField(connection, "ceo_name", draft.ceoName),
      address: connectionField(connection, "address", draft.address),
      bizType: connectionField(connection, "biz_type", draft.bizType),
      bizClass: connectionField(connection, "biz_class", draft.bizClass),
      contactName: connectionField(connection, "contact_name", draft.contactName),
      contactEmail: connectionField(connection, "contact_email", draft.contactEmail),
      contactPhone: connectionField(connection, "contact_phone", draft.contactPhone),
      popbillUserId: connectionField(connection, "popbill_user_id", draft.popbillUserId),
      isConnected: true,
      lastTestedAt: new Date().toISOString()
    };
    setDraft(connected);
    onChange(connected);
    setShowSignup(false);
    setShowExistingConnection(false);
    setPopbillPassword("");
  };

  const runConnectionAction = async (action: () => Promise<PopbillConnectionResult>): Promise<PopbillConnectionResult> => {
    setChecking(true);
    setResult(null);
    try {
      const next = await action();
      setResult(next);
      if (next.configured) applyConnectedResult(next);
      return next;
    } catch (error) {
      const next: PopbillConnectionResult = { ok: false, configured: false, message: error instanceof Error ? error.message : "팝빌 요청을 처리하지 못했습니다." };
      setResult(next);
      return next;
    } finally {
      setChecking(false);
    }
  };

  const beginConnection = async () => {
    setStatusResult(null);
    const digits = draft.businessNumber.replace(/\D/g, "");
    const statusPromise = digits.length === 10 ? checkBusinessStatus(draft.businessNumber) : null;
    const next = await runConnectionAction(() => checkPopbill(draft.businessNumber));
    if (next.needsSignup) setShowSignup(true);
    if (next.needsExistingConnection) setShowExistingConnection(true);
    if (statusPromise) {
      try {
        const status = await statusPromise;
        if (status.checked) setStatusResult(status);
      } catch {
        // 상태조회 실패는 연결 흐름을 막지 않는다.
      }
    }
  };

  const profile: PopbillProfile = {
    businessNumber: draft.businessNumber,
    corpName: draft.corpName ?? "",
    ceoName: draft.ceoName ?? "",
    address: draft.address ?? "",
    bizType: draft.bizType ?? "",
    bizClass: draft.bizClass ?? "",
    contactName: draft.contactName ?? "",
    contactEmail: draft.contactEmail,
    contactPhone: draft.contactPhone ?? "",
    popbillUserId: draft.popbillUserId ?? "",
    popbillPassword
  };

  const completeSignup = async () => {
    await runConnectionAction(() => joinPopbill(profile));
  };

  const completeExistingConnection = async () => {
    await runConnectionAction(() => connectExistingPopbill(draft.businessNumber, draft.popbillUserId ?? ""));
  };

  const checkStatus = async () => {
    const next = await runConnectionAction(getPopbillStatus);
    if (!next.configured) onChange({ ...draft, isConnected: false, lastTestedAt: new Date().toISOString() });
  };

  const disconnect = async () => {
    if (!window.confirm("이 계정의 팝빌 자동발행 연결을 해제할까요? 발행 기록은 삭제되지 않습니다.")) return;
    const next = await runConnectionAction(disconnectPopbill);
    if (next.ok) {
      const disconnected = { ...draft, isConnected: false, lastTestedAt: new Date().toISOString() };
      setDraft(disconnected);
      onChange(disconnected);
      setShowSignup(false);
      setShowExistingConnection(false);
    }
  };

  const saveSettings = () => {
    onChange(draft);
    setResult({ ok: true, configured: draft.isConnected, message: "담당자 기본정보를 저장했습니다." });
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseBackup(String(reader.result ?? ""));
        if (window.confirm("현재 계정의 데이터가 백업 파일 내용으로 교체됩니다. 계속할까요?")) {
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

  return (
    <section className="settings-page">
      <BusinessBrandSettings
        profile={data.workspaceProfile}
        logo={data.logoDataUrl}
        onProfileChange={onWorkspaceProfileChange}
        onLogoChange={onLogoChange}
      />

      <div className="panel settings-card">
        <div className="settings-card-head">
          <SectionTitle title="팝빌 자동발행" hint="이 계정에서 사용할 사업자를 한 번 연결하면 이후에는 다시 설정하지 않습니다." />
          <Status tone={draft.isConnected ? "issued" : "pending"}>{draft.isConnected ? "자동발행 연결됨" : "연결 필요"}</Status>
        </div>

        <div className="settings-tabs" role="tablist" aria-label="팝빌 설정 메뉴">
          <button role="tab" aria-selected={activeTab === "settings"} className={activeTab === "settings" ? "active" : ""} onClick={() => setActiveTab("settings")}><Settings2 size={16} /> 연결 설정</button>
          <button role="tab" aria-selected={activeTab === "guide"} className={activeTab === "guide" ? "active" : ""} onClick={() => setActiveTab("guide")}><BookOpen size={16} /> 발행 안내</button>
        </div>

        {activeTab === "settings" ? <div className="settings-content popbill-connect-flow">
          <ol className="connect-steps" aria-label="팝빌 연결 단계">
            <li className="done"><span>1</span><strong>사업자 확인</strong></li>
            <li className={showSignup || draft.isConnected ? "done" : ""}><span>2</span><strong>팝빌 연결</strong></li>
            <li className={draft.isConnected ? "done" : ""}><span>3</span><strong>자동발행 준비</strong></li>
          </ol>

          {draft.isConnected ? (
            <div className="connected-summary">
              <CheckCircle2 size={26} />
              <div><strong>{draft.corpName || "연결된 사업자"}</strong><span>{draft.businessNumber} · 승인 시 자동발행 사용 가능</span></div>
              <button className="ghost" onClick={checkStatus} disabled={checking}><RefreshCw size={16} /> 상태 확인</button>
            </div>
          ) : (
            <div className="settings-section connection-start">
              <SectionTitle title="사업자번호로 시작" hint="이미 입력한 정보가 있으면 그대로 불러옵니다." />
              <div className="connection-start-row">
                <Input label="사업자등록번호" value={draft.businessNumber} placeholder="000-00-00000" inputMode="numeric" maxLength={12} format={formatBusinessNumber} onChange={(value) => { patchDraft({ businessNumber: value, isConnected: false }); setResult(null); setShowSignup(false); setShowExistingConnection(false); setStatusResult(null); }} />
                <button onClick={beginConnection} disabled={checking || draft.businessNumber.replace(/\D/g, "").length !== 10}>
                  {checking ? <LoaderCircle className="spin" size={17} /> : <Link2 size={17} />}{checking ? "확인 중" : "연결 시작"}
                </button>
              </div>
            </div>
          )}

          {statusResult && !draft.isConnected && (
            <div
              className={statusResult.active === true ? "notice" : statusResult.active === false ? "alert danger-alert" : "field-help"}
              role="status"
            >
              {statusResult.message}
            </div>
          )}

          {showExistingConnection && !draft.isConnected && (
            <div className="settings-section popbill-signup-form">
              <SectionTitle title="기존 팝빌 회원 연결" hint="팝빌에 등록된 담당자 이메일과 현재 블링빌 로그인 이메일을 확인해 안전하게 연결합니다." />
              <div className="popbill-account-fields">
                <Input label="팝빌 아이디" value={draft.popbillUserId ?? ""} placeholder="가입할 때 만든 팝빌 아이디" onChange={(value) => patchDraft({ popbillUserId: value })} />
                <p>비밀번호는 다시 입력하지 않습니다. 팝빌의 담당자 이메일이 블링빌 로그인 이메일과 같아야 합니다.</p>
              </div>
              <div className="actions">
                <button onClick={completeExistingConnection} disabled={checking || !/^[A-Za-z0-9._-]{6,50}$/.test(draft.popbillUserId ?? "")}>
                  {checking ? <LoaderCircle className="spin" size={17} /> : <Link2 size={17} />}{checking ? "확인 중" : "기존 회원 연결"}
                </button>
                <button className="ghost" onClick={() => setShowExistingConnection(false)} disabled={checking}>취소</button>
              </div>
            </div>
          )}

          {showSignup && !draft.isConnected && (
            <div className="settings-section popbill-signup-form">
              <SectionTitle title="팝빌 가입 정보" hint="아래 정보로 팝빌 가입과 블링빌 연결을 한 번에 완료합니다." />
              <div className="grid two">
                <Input label="상호" value={draft.corpName ?? ""} placeholder="사업자등록증의 상호" onChange={(value) => patchDraft({ corpName: value })} />
                <Input label="대표자명" value={draft.ceoName ?? ""} placeholder="대표자명" onChange={(value) => patchDraft({ ceoName: value })} />
                <Input label="업태" value={draft.bizType ?? ""} placeholder="예: 서비스업" onChange={(value) => patchDraft({ bizType: value })} />
                <Input label="종목" value={draft.bizClass ?? ""} placeholder="예: 디자인" onChange={(value) => patchDraft({ bizClass: value })} />
              </div>
              {profileLookupHint && <p className="field-help">{profileLookupHint}</p>}
              <AddressInput label="사업장 주소" value={draft.address ?? ""} onChange={(value) => patchDraft({ address: value })} />
              <div className="grid two">
                <Input label="담당자명" value={draft.contactName ?? ""} placeholder="세금계산서 담당자" onChange={(value) => patchDraft({ contactName: value })} />
                <Input label="담당자 연락처" value={draft.contactPhone ?? ""} placeholder="010-0000-0000" inputMode="tel" format={formatPhoneNumber} onChange={(value) => patchDraft({ contactPhone: value })} />
                <Input label="담당자 이메일" value={draft.contactEmail} placeholder="tax@example.com" onChange={(value) => patchDraft({ contactEmail: value })} />
              </div>
              <div className="popbill-account-fields">
                <Input label="팝빌 아이디" value={draft.popbillUserId ?? ""} placeholder="영문·숫자 6자 이상" onChange={(value) => patchDraft({ popbillUserId: value })} />
                <Input label="팝빌 비밀번호" type="password" value={popbillPassword} placeholder="8~20자" onChange={setPopbillPassword} />
                <p>비밀번호는 팝빌 가입 요청에만 사용하며 블링빌에 저장하지 않습니다.</p>
              </div>
              <div className="actions">
                <button onClick={completeSignup} disabled={checking}>{checking ? <LoaderCircle className="spin" size={17} /> : <CheckCircle2 size={17} />}{checking ? "연결 중" : "가입하고 자동발행 연결"}</button>
                <button className="ghost" onClick={() => setShowSignup(false)} disabled={checking}>취소</button>
              </div>
            </div>
          )}

          {result && <div className={result.ok ? "notice" : "alert danger-alert"} role="status">{result.message}{result.environment ? ` 현재 ${result.environment === "production" ? "운영" : "테스트"} 환경입니다.` : ""}</div>}

          <div className="settings-section">
            <SectionTitle title="발행 담당자 기본정보" hint="연결 후에도 담당자 정보와 메모를 관리할 수 있습니다." />
            <div className="grid two">
              <Input label="담당자 이메일" value={draft.contactEmail} placeholder="tax@example.com" onChange={(value) => patchDraft({ contactEmail: value })} />
              <Input label="메모" value={draft.memo ?? ""} placeholder="발행 관련 내부 메모" onChange={(value) => patchDraft({ memo: value })} />
            </div>
            <div className="actions settings-actions">
              <button className="ghost" onClick={saveSettings}><Save size={16} /> 기본정보 저장</button>
              {draft.isConnected && <button className="ghost danger-alert" onClick={disconnect} disabled={checking}><Unlink size={16} /> 연결 해제</button>}
            </div>
          </div>
        </div> : <PopbillGuide />}
      </div>

      <EmailConnectionSettings
        settings={data.documentEmailSettings}
        defaultSenderName={integration.corpName || integration.contactName || ""}
        onChange={onDocumentEmailSettingsChange}
      />

      <div className="panel">
        <SectionTitle title="데이터 백업" hint="서버 저장과 별도로 파일 백업을 보관하거나 복원할 수 있습니다." />
        <p className="muted">업무 데이터는 로그인 계정에 자동 저장됩니다. 중요한 시점에는 별도 백업 파일도 보관해 주세요.</p>
        <div className="actions">
          <button onClick={() => exportBackup(data)}><Download size={16} /> 데이터 내보내기</button>
          <button className="ghost" onClick={() => importInputRef.current?.click()}><Upload size={16} /> 백업 파일 가져오기</button>
        </div>
        <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={handleImportFile} />
      </div>
    </section>
  );
}
