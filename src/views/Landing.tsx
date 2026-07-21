import { ArrowRight, BarChart3, FileText, HandCoins, Receipt, Users } from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "견적 작성·PDF",
    body: "기존 견적 양식을 유지하면서 실시간 미리보기, 자동 저장, PDF 다운로드와 고객 이메일 발송까지 이어집니다."
  },
  {
    icon: Receipt,
    title: "승인·세금계산서",
    body: "승인할 견적과 발행일·방식을 확인합니다. 팝빌 연동이 완료된 경우에만 실제 자동 발행됩니다."
  },
  {
    icon: Users,
    title: "고객 정보 재사용",
    body: "사업자 정보와 기본 발행 방식을 불러오고, 이번 견적의 정보만 따로 수정해 보존합니다."
  },
  {
    icon: HandCoins,
    title: "수금·매입 통합 원장",
    body: "부분 수금과 부분 지급을 날짜별로 기록하고 매출·매입·미수·미지급을 함께 확인합니다."
  }
];

const workflow = ["견적 작성", "승인 처리", "발행 준비", "수금·매입", "분석 확인"];

export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <section className="landing">
      <div className="landing-inner">
        <span className="brand-mark landing-mark">BB</span>
        <p className="landing-kicker">견적·발행·정산 통합 업무 도구</p>
        <h1 className="landing-title">블링빌</h1>
        <p className="landing-tagline">견적서 작성부터 고객 정보, 세금계산서 발행 준비, 수금·매입 원장과 월간·연간 분석까지 한 흐름으로 관리합니다.</p>

        <div className="landing-flow" aria-label="블링빌 업무 흐름">
          {workflow.map((step, index) => (
            <div className="landing-flow-step" key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
              {index < workflow.length - 1 && <ArrowRight aria-hidden="true" size={16} />}
            </div>
          ))}
        </div>

        <button className="landing-cta" onClick={onStart}>견적 업무 시작하기 <ArrowRight size={17} /></button>

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

        <div className="landing-dashboard-note">
          <BarChart3 size={18} />
          <span>월간·연간 매출, 실제 입금·지출, 미수금과 추정 이익을 기간별로 확인할 수 있습니다.</span>
        </div>

        <p className="landing-foot">업무 데이터는 로그인 계정별로 분리되어 서버에 자동 저장됩니다. 실제 세금계산서 발행은 팝빌 연결 후 활성화됩니다.</p>
      </div>
    </section>
  );
}
