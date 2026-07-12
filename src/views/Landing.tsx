import { BarChart3, FileText, Receipt, Users } from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "견적서 작성",
    body: "기존 양식 그대로. 입력하면 실시간 미리보기, PDF 다운로드까지."
  },
  {
    icon: Receipt,
    title: "세금계산서 발행",
    body: "승인 한 번으로 발행 준비. 팝빌 연동 시 실제 발행."
  },
  {
    icon: Users,
    title: "고객·거래처 관리",
    body: "고객별 원장, 부분 수금, 매입 기록을 한 곳에서."
  },
  {
    icon: BarChart3,
    title: "대시보드",
    body: "이번 달 매출·미수금·이익을 한눈에."
  }
];

export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <section className="landing">
      <div className="landing-inner">
        <span className="brand-mark landing-mark">BB</span>
        <h1 className="landing-title">블링빌</h1>
        <p className="landing-tagline">견적서 작성부터 세금계산서 발행, 수금 관리까지 — 1인 스튜디오의 견적 사무실</p>

        <div className="landing-grid">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div className="landing-card" key={feature.title}>
                <span className="landing-card-icon">
                  <Icon size={20} />
                </span>
                <strong>{feature.title}</strong>
                <p>{feature.body}</p>
              </div>
            );
          })}
        </div>

        <button className="landing-cta" onClick={onStart}>시작하기</button>
        <p className="landing-foot">데이터는 이 브라우저에만 저장됩니다.</p>
      </div>
    </section>
  );
}
