import { useState, type FormEvent } from "react";
import { ArrowLeft, KeyRound, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { requireSupabase } from "../lib/supabase";

type AuthMode = "signin" | "signup" | "forgot";

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
          options: { emailRedirectTo: window.location.origin }
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          changeMode("signin");
          setMessage("가입 확인 메일을 보냈습니다. 이메일 인증 후 로그인해 주세요.");
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

  const title = mode === "signin" ? "로그인" : mode === "signup" ? "회원가입" : "비밀번호 찾기";

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

          {mode !== "forgot" && (
            <div className="auth-tabs" role="tablist" aria-label="로그인 방식">
              <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => changeMode("signin")}>로그인</button>
              <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => changeMode("signup")}>회원가입</button>
            </div>
          )}

          <label>
            이메일
            <span className="auth-input">
              <Mail size={17} aria-hidden="true" />
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="name@example.com" required />
            </span>
          </label>

          {mode !== "forgot" && (
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

          {error && <p className="auth-feedback error" role="alert">{error}</p>}
          {message && <p className="auth-feedback success" role="status">{message}</p>}

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy && <LoaderCircle className="spin" size={17} />}
            {busy ? "처리 중" : mode === "signin" ? "로그인" : mode === "signup" ? "회원가입" : "재설정 메일 보내기"}
          </button>

          {mode === "signin" && <button className="link auth-secondary" type="button" onClick={() => changeMode("forgot")}>비밀번호를 잊으셨나요?</button>}
          {mode === "forgot" && <button className="link auth-secondary" type="button" onClick={() => changeMode("signin")}><ArrowLeft size={15} /> 로그인으로 돌아가기</button>}
        </form>
      </div>
    </section>
  );
}
