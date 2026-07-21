import { useEffect, useState } from "react";
import { Building2, CheckCircle2, LoaderCircle, Mail, Unlink } from "lucide-react";
import type { DocumentEmailSettings } from "../types";
import { Input } from "./Input";
import { SectionTitle } from "./SectionTitle";
import { Status } from "./Status";
import {
  connectSmtpEmail,
  disconnectEmail,
  getEmailConnectionStatus,
  startEmailOAuth,
  type EmailConnectionStatus
} from "../lib/email-connection";

type SetupMode = "none" | "naver" | "smtp";

const providerLabels = {
  google: "Google 메일",
  microsoft: "Microsoft 메일",
  naver: "네이버 메일",
  smtp: "회사·기타 메일"
} as const;

export function EmailConnectionSettings({
  settings,
  defaultSenderName,
  onChange
}: {
  settings: DocumentEmailSettings;
  defaultSenderName: string;
  onChange: (settings: DocumentEmailSettings) => void;
}) {
  const [connection, setConnection] = useState<EmailConnectionStatus>({ ok: true, connected: false });
  const [mode, setMode] = useState<SetupMode>("none");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [senderName, setSenderName] = useState(defaultSenderName);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPort, setSmtpPort] = useState<465 | 587>(587);

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const next = await getEmailConnectionStatus();
      setConnection(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "메일 연결 상태를 확인하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackStatus = params.get("email_connection");
    if (callbackStatus === "connected") setMessage("발신메일 연결이 완료되었습니다.");
    if (callbackStatus === "error") setMessage(params.get("detail") || "발신메일 연결을 완료하지 못했습니다.");
    if (callbackStatus) {
      params.delete("email_connection");
      params.delete("provider");
      params.delete("detail");
      const nextQuery = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`);
    }
    void refreshStatus();
  }, []);

  const connectOAuth = async (provider: "google" | "microsoft") => {
    setLoading(true);
    setMessage("");
    try {
      await startEmailOAuth(provider);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "메일 연결을 시작하지 못했습니다.");
      setLoading(false);
    }
  };

  const connectSmtp = async () => {
    setLoading(true);
    setMessage("");
    try {
      const next = await connectSmtpEmail({
        provider: mode === "naver" ? "naver" : "smtp",
        fromEmail: email,
        fromName: senderName || defaultSenderName,
        username: mode === "naver" ? email : smtpUsername || email,
        password,
        ...(mode === "smtp" ? { host: smtpHost, port: smtpPort, secure: smtpPort === 465 } : {})
      });
      setConnection(next);
      setPassword("");
      setMode("none");
      setMessage(next.message || "발신메일 연결이 완료되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "메일 서버에 연결하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm("연결된 발신메일을 해제할까요? 이후 자동발송이 중단됩니다.")) return;
    setLoading(true);
    try {
      const next = await disconnectEmail();
      setConnection(next);
      setMessage(next.message || "발신메일 연결을 해제했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "메일 연결을 해제하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel settings-card email-settings-card">
      <div className="settings-card-head">
        <SectionTitle title="내 발신메일 연결" hint="한 번 연결하면 견적 승인 시 내 메일 주소로 고객에게 자동 발송합니다." />
        <Status tone={connection.connected ? "issued" : "pending"}>{connection.connected ? "연결됨" : "연결 필요"}</Status>
      </div>

      {connection.connected ? (
        <div className="email-connected-summary">
          <CheckCircle2 size={26} />
          <div>
            <strong>{connection.email}</strong>
            <span>{providerLabels[connection.provider ?? "smtp"]} · 계속 자동 사용</span>
          </div>
          <button className="ghost" onClick={disconnect} disabled={loading}><Unlink size={16} /> 연결 해제</button>
        </div>
      ) : (
        <>
          <div className="email-provider-grid" aria-label="발신메일 종류 선택">
            <button type="button" className="email-provider-option" onClick={() => connectOAuth("google")} disabled={loading}>
              <Mail size={21} /><strong>Google 메일</strong><span>Gmail·Google Workspace</span>
            </button>
            <button type="button" className="email-provider-option" onClick={() => connectOAuth("microsoft")} disabled={loading}>
              <Mail size={21} /><strong>Microsoft 메일</strong><span>Outlook·Microsoft 365</span>
            </button>
            <button type="button" className={`email-provider-option ${mode === "naver" ? "active" : ""}`} onClick={() => setMode(mode === "naver" ? "none" : "naver")} disabled={loading}>
              <Mail size={21} /><strong>네이버 메일</strong><span>이메일과 비밀번호로 연결</span>
            </button>
            <button type="button" className={`email-provider-option ${mode === "smtp" ? "active" : ""}`} onClick={() => setMode(mode === "smtp" ? "none" : "smtp")} disabled={loading}>
              <Building2 size={21} /><strong>회사·기타 메일</strong><span>자체 도메인 SMTP</span>
            </button>
          </div>

          {mode !== "none" && (
            <div className="email-smtp-form">
              <SectionTitle
                title={mode === "naver" ? "네이버 메일 연결" : "회사·기타 메일 연결"}
                hint={mode === "naver" ? "네이버 메일에서 IMAP/SMTP 사용을 켠 뒤 입력해 주세요." : "메일 관리자에게 SMTP 서버 정보를 확인해 주세요."}
              />
              <div className="grid two">
                <Input label="발신 이메일" value={email} placeholder={mode === "naver" ? "name@naver.com" : "name@company.com"} onChange={(value) => { setEmail(value); if (!smtpUsername) setSmtpUsername(value); }} />
                <Input label="보내는 이름" value={senderName} placeholder={defaultSenderName || "회사명 또는 담당자명"} onChange={setSenderName} />
                {mode === "smtp" && <Input label="SMTP 서버" value={smtpHost} placeholder="smtp.company.com" onChange={setSmtpHost} />}
                {mode === "smtp" && <Input label="로그인 아이디" value={smtpUsername} placeholder="보통 발신 이메일과 동일" onChange={setSmtpUsername} />}
                <Input label={mode === "naver" ? "네이버 비밀번호" : "메일 비밀번호"} type="password" value={password} placeholder="연결 확인 후 암호화 저장" onChange={setPassword} />
                {mode === "smtp" && <label>보안 연결<select value={smtpPort} onChange={(event) => setSmtpPort(Number(event.target.value) as 465 | 587)}><option value={587}>TLS · 587 (권장)</option><option value={465}>SSL · 465</option></select></label>}
              </div>
              {mode === "naver" && <p className="field-help">2단계 인증을 사용 중이면 네이버에서 발급한 애플리케이션 비밀번호를 입력해 주세요.</p>}
              <div className="actions">
                <button type="button" onClick={connectSmtp} disabled={loading || !email || !password || (mode === "smtp" && !smtpHost)}>
                  {loading ? <LoaderCircle className="spin" size={17} /> : <CheckCircle2 size={17} />}{loading ? "연결 확인 중" : "연결하고 저장"}
                </button>
                <button type="button" className="ghost" onClick={() => setMode("none")} disabled={loading}>취소</button>
              </div>
            </div>
          )}
        </>
      )}

      <label className="email-auto-toggle">
        <input
          type="checkbox"
          checked={settings.autoSendOnApproval}
          onChange={(event) => onChange({ ...settings, autoSendOnApproval: event.target.checked })}
        />
        <span><strong>승인 시 문서 자동발송</strong><small>견적서와 거래명세서 PDF를 고객 이메일로 함께 보냅니다.</small></span>
      </label>
      {loading && mode === "none" && <div className="email-loading"><LoaderCircle className="spin" size={16} /> 연결 상태 확인 중</div>}
      {message && <div className={message.includes("완료") || message.includes("해제") ? "notice" : "alert danger-alert"} role="status">{message}</div>}
    </div>
  );
}

