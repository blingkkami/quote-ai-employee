import { Cloud, LoaderCircle } from "lucide-react";

export function AppLoading({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <section className="app-loading">
      <span className="brand-mark">BB</span>
      {error ? <Cloud size={24} /> : <LoaderCircle className="spin" size={24} />}
      <strong>{error ? "데이터를 불러오지 못했습니다" : "내 업무 데이터를 불러오는 중"}</strong>
      {error && <p>{error}</p>}
      {error && onRetry && <button type="button" onClick={onRetry}>다시 시도</button>}
    </section>
  );
}
