import { useState, type FormEvent } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";
import { requireSupabase } from "../lib/supabase";

export function PasswordRecovery({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("비밀번호는 8자 이상 입력해 주세요.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await requireSupabase().auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onComplete();
  };

  return (
    <section className="auth-page">
      <form className="auth-form recovery-form" onSubmit={submit}>
        <div className="auth-form-head">
          <span className="auth-form-icon"><KeyRound size={20} /></span>
          <div><p>계정 보안</p><h1>새 비밀번호 설정</h1></div>
        </div>
        <label>새 비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
        <label>새 비밀번호 확인<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
        {error && <p className="auth-feedback error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy && <LoaderCircle className="spin" size={17} />}{busy ? "변경 중" : "비밀번호 변경"}</button>
      </form>
    </section>
  );
}
