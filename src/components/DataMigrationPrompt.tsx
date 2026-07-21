import { useState } from "react";
import { Database, LoaderCircle } from "lucide-react";
import type { AppData } from "../types";

type Props = {
  data: AppData;
  onImport: () => Promise<void>;
  onStartFresh: () => Promise<void>;
};

export function DataMigrationPrompt({ data, onImport, onStartFresh }: Props) {
  const [busy, setBusy] = useState<"import" | "fresh" | "">("");
  const [error, setError] = useState("");

  const run = async (action: "import" | "fresh") => {
    if (busy) return;
    setBusy(action);
    setError("");
    try {
      await (action === "import" ? onImport() : onStartFresh());
    } catch (migrationError) {
      setError(migrationError instanceof Error ? migrationError.message : String(migrationError));
      setBusy("");
    }
  };

  return (
    <div className="migration-backdrop" role="dialog" aria-modal="true" aria-labelledby="migration-title">
      <div className="migration-dialog">
        <span className="migration-icon"><Database size={22} /></span>
        <p>처음 로그인한 계정</p>
        <h2 id="migration-title">이 브라우저의 기존 데이터를 가져올까요?</h2>
        <span>가져오면 현재 로그인한 계정에 안전하게 저장되고, 이 브라우저의 이전 저장본은 삭제됩니다.</span>
        <dl className="migration-counts">
          <div><dt>견적</dt><dd>{data.quotes.length}건</dd></div>
          <div><dt>고객</dt><dd>{data.customers.length}명</dd></div>
          <div><dt>매입처</dt><dd>{data.vendors.length}곳</dd></div>
          <div><dt>거래 기록</dt><dd>{data.sales.length + data.purchases.length}건</dd></div>
        </dl>
        {error && <p className="auth-feedback error" role="alert">{error}</p>}
        <div className="migration-actions">
          <button type="button" onClick={() => void run("import")} disabled={Boolean(busy)}>{busy === "import" && <LoaderCircle className="spin" size={17} />}기존 데이터 가져오기</button>
          <button className="ghost" type="button" onClick={() => void run("fresh")} disabled={Boolean(busy)}>{busy === "fresh" && <LoaderCircle className="spin" size={17} />}새 계정으로 시작</button>
        </div>
      </div>
    </div>
  );
}
