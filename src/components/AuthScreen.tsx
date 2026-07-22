import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, LoaderCircle, LockKeyhole, Mail, RefreshCw } from "lucide-react";
import { requireSupabase } from "../lib/supabase";

type AuthMode = "signin" | "signup" | "forgot" | "verify";

function getAuthErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (normalized.includes("email not confirmed")) return "이메일 인증을 완료한 뒤 로그인해 주세요.";
  if (normalized.includes("user already registered")) return "이미 가입된 이메일입니다. 로그인해 주세요.";
  if (normalized.includes("password should be")) return "비밀번호는 8자 이상 입력해 주세요.";
  if (normalized.includes("rate limit")) return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  return message;
}

export function AuthScreen({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword("");
    setPasswordConfirm("");
    setError("");
    setMessage("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("이메일을 입력해 주세요.");
      return;
    }
    if (mode !== "forgot" && password.length < 8) {
      setError("비밀번호는 8자 이상 입력해 주세요.");
      return;
    }
    if (mode === "signup" && password !== passwordConfirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setBusy(true);
    try {
      const client = requireSupabase();
      if (mode === "signin") {
        const { error: signInError } = await client.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });
        if (signInError) throw signInError;
      } else if (mode === "signup") {
        const { data, error: signUpError } = await client.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { locale: "ko" }
          }
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setPendingEmail(normalizedEmail);
          setMode("verify");
          setPassword("");
          setPasswordConfirm("");
        }
      } else {
        const { error: resetError } = await client.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: window.location.origin
        });
        if (resetError) throw resetError;
        setMessage("비밀번호 재설정 메일을 보냈습니다. 메일의 링크를 열어 주세요.");
      }
    } catch (submitError) {
      const rawMessage = submitError instanceof Error ? submitError.message : String(submitError);
      setError(getAuthErrorMessage(rawMessage));
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    if (!pendingEmail) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const client = requireSupabase();
      const { error: resendError } = await client.auth.resend({
        type: "signup",
        email: pendingEmail,
        options: { emailRedirectTo: window.location.origin }
      });
      if (resendError) throw resendError;
      setMessage("인증 메일을 다시 보냈습니다. 받은편지함과 스팸함을 확인해 주세요.");
    } catch (resendError) {
      const rawMessage = resendError instanceof Error ? resendError.message : String(resendError);
      setError(getAuthErrorMessage(rawMessage));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "signin" ? "로그인" : mode === "signup" ? "회원가입" : mode === "forgot" ? "비밀번호 찾기" : "이메일 인증";

  return (
    <section className="auth-page">
      <button className="auth-back link" onClick={onBack} type="button">
        <ArrowLeft size={16} /> 소개 화면
      </button>
      <div className="auth-shell">
        <div className="auth-brand-panel">
          <span className="brand-mark auth-mark">BB</span>
          <p>견적·발행·정산 통합 업무 도구</p>
          <h1>블링빌</h1>
          <strong>내 계정의 업무 데이터로 시작하세요.</strong>
          <span>어느 기기에서 로그인해도 고객, 견적, 수금과 매입 내역을 이어서 관리할 수 있습니다.</span>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <div className="auth-form-head">
            <span className="auth-form-icon"><KeyRound size={20} /></span>
            <div>
              <p>계정</p>
              <h2>{title}</h2>
            </div>
          </div>

          {mode !== "forgot" && mode !== "verify" && (
            <div className="auth-tabs" role="tablist" aria-label="로그인 방식">
              <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => changeMode("signin")}>로그인</button>
              <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => changeMode("signup")}>회원가입</button>
            </div>
          )}

          {mode !== "verify" && (
            <label>
              이메일
              <span className="auth-input">
                <Mail size={17} aria-hidden="true" />
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="name@example.com" required />
              </span>
            </label>
          )}

          {mode !== "forgot" && mode !== "verify" && (
            <label>
              비밀번호
              <span className="auth-input">
                <LockKeyhole size={17} aria-hidden="true" />
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="8자 이상" minLength={8} required />
              </span>
            </label>
          )}

          {mode === "signup" && (
            <label>
              비밀번호 확인
              <span className="auth-input">
                <LockKeyhole size={17} aria-hidden="true" />
                <input type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} autoComplete="new-password" placeholder="비밀번호 다시 입력" minLength={8} required />
              </span>
            </label>
          )}

          {mode === "verify" && (
            <div className="auth-verification" role="status">
              <span className="auth-verification-icon"><CheckCircle2 size={23} /></span>
              <strong>인증 메일을 보냈습니다</strong>
              <span className="auth-verification-email">{pendingEmail}</span>
              <ol>
                <li>받은편지함에서 블링빌 인증 메일을 여세요.</li>
                <li><b>이메일 인증하기</b> 버튼을 누르세요.</li>
                <li>블링빌로 돌아오면 가입이 완료됩니다.</li>
              </ol>
              <small>메일이 보이지 않으면 스팸함도 확인해 주세요.</small>
            </div>
          )}

          {error && <p className="auth-feedback error" role="alert">{error}</p>}
          {message && <p className="auth-feedback success" role="status">{message}</p>}

          {mode !== "verify" && (
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={17} />}
              {busy ? "처리 중" : mode === "signin" ? "로그인" : mode === "signup" ? "회원가입" : "재설정 메일 보내기"}
            </button>
          )}

          {mode === "verify" && (
            <>
              <button className="auth-submit" type="button" disabled={busy} onClick={resendConfirmation}>
                {busy ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}
                {busy ? "보내는 중" : "인증 메일 다시 보내기"}
              </button>
              <button className="link auth-secondary" type="button" onClick={() => changeMode("signup")}>이메일 주소 수정</button>
              <button className="link auth-secondary" type="button" onClick={() => changeMode("signin")}>이미 인증했다면 로그인</button>
            </>
          )}

          {mode === "signin" && <button className="link auth-secondary" type="button" onClick={() => changeMode("forgot")}>비밀번호를 잊으셨나요?</button>}
          {mode === "forgot" && <button className="link auth-secondary" type="button" onClick={() => changeMode("signin")}><ArrowLeft size={15} /> 로그인으로 돌아가기</button>}
        </form>
      </div>
    </section>
  );
}
