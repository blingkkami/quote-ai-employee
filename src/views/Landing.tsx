import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  FileText,
  HandCoins,
  Landmark,
  Mail,
  Receipt,
  Search,
  ShieldCheck,
  Stamp,
  Users
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "견적서·거래명세서",
    body: "익숙한 견적 양식을 그대로 사용하고, 실시간 미리보기와 자동 저장을 거쳐 PDF 문서로 발행합니다."
  },
  {
    icon: Receipt,
    title: "승인·세금계산서",
    body: "발행일과 비고를 확인한 뒤 승인합니다. 팝빌을 한 번 연결하면 이후 자동발행 흐름으로 이어집니다."
  },
  {
    icon: Users,
    title: "고객·매입처 관리",
    body: "고객과 매입처는 목록에서 빠르게 검색하고, 상세 화면에서 사업자 정보와 모든 거래 이력을 확인합니다."
  },
  {
    icon: HandCoins,
    title: "수금·매입 통합 원장",
    body: "부분 수금과 부분 지급을 날짜별로 기록해 매출·매입·미수금·미지급금을 한곳에서 관리합니다."
  },
  {
    icon: Mail,
    title: "내 메일로 고객 발송",
    body: "사용자의 발신메일을 한 번 연결한 뒤 견적서·거래명세서와 미수금 안내를 고객에게 바로 보냅니다."
  },
  {
    icon: ShieldCheck,
    title: "사업장별 안전한 데이터",
    body: "로그인 계정별로 업무 데이터가 분리 저장되어 다른 사용자에게 노출되지 않고 어느 기기에서나 이어집니다."
  }
];

const workflow = ["견적 작성", "승인 처리", "문서·세금계산서", "수금·매입", "미수·손익 확인"];

const previewNav = [
  [FileText, "견적 생성"],
  [Receipt, "승인·발행"],
  [Users, "고객 관리"],
  [Building2, "매입처 관리"],
  [BarChart3, "대시보드"]
] as const;

export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <section className="landing">
      <div className="landing-inner">
        <header className="landing-hero">
          <span className="brand-mark landing-mark">BB</span>
          <p className="landing-kicker">견적·발행·정산을 한 흐름으로</p>
          <h1 className="landing-title">블링빌</h1>
          <p className="landing-tagline">견적서를 만드는 순간부터 고객 발송, 세금계산서, 수금과 매입, 미수금 관리까지 사업장의 반복 업무를 이어서 처리합니다.</p>
          <button className="landing-cta" onClick={onStart}>로그인하고 시작하기 <ArrowRight size={17} /></button>

          <div className="landing-quick-points" aria-label="핵심 특징">
            <span><ShieldCheck size={15} /> 사용자별 분리 저장</span>
            <span><Stamp size={15} /> 로고·도장 문서 반영</span>
            <span><Mail size={15} /> 고객 이메일 발송</span>
            <span><Landmark size={15} /> 계좌·미수금 안내</span>
          </div>

          <div className="landing-product-preview" aria-label="블링빌 운영 화면 예시">
            <aside className="landing-preview-sidebar">
              <div className="landing-preview-brand"><span>BB</span><strong>우리 스튜디오</strong><small>by 블링빌</small></div>
              <nav>
                {previewNav.map(([Icon, label], index) => (
                  <div className={index === 4 ? "active" : ""} key={label}><Icon size={14} /><span>{label}</span></div>
                ))}
              </nav>
            </aside>
            <div className="landing-preview-main">
              <div className="landing-preview-topbar">
                <div><strong>7월 운영 현황</strong><span>매출과 수금 흐름을 확인하세요.</span></div>
                <span className="landing-preview-saved"><CheckCircle2 size={14} /> 저장됨</span>
              </div>
              <div className="landing-preview-kpis">
                <div><span>이번 달 매출</span><strong>3,850,000원</strong><small>승인 견적 8건</small></div>
                <div><span>수금 완료</span><strong>3,120,000원</strong><small>입금 내역 11건</small></div>
                <div className="unpaid"><span>미수금</span><strong>730,000원</strong><small>고객 3곳 확인 필요</small></div>
              </div>
              <div className="landing-preview-content">
                <section className="landing-preview-list">
                  <div className="landing-preview-section-head"><strong>최근 거래</strong><span><Search size={13} /> 빠른 검색</span></div>
                  <div className="landing-preview-row head"><span>고객</span><span>프로젝트</span><span>상태</span><span>금액</span></div>
                  <div className="landing-preview-row"><strong>라이트 코스메틱</strong><span>상세페이지</span><i className="paid">수금완료</i><b>1,320,000원</b></div>
                  <div className="landing-preview-row"><strong>모노 스튜디오</strong><span>브랜드 디자인</span><i className="partial">부분수금</i><b>880,000원</b></div>
                  <div className="landing-preview-row"><strong>오브제 컴퍼니</strong><span>제품 비주얼</span><i className="pending">미수관리</i><b>550,000원</b></div>
                </section>
                <section className="landing-preview-document">
                  <div className="landing-preview-document-head"><span>거래명세서</span><small>2026년 7월 21일</small></div>
                  <div className="landing-preview-document-line"><span>공급받는 자</span><strong>모노 스튜디오</strong></div>
                  <div className="landing-preview-document-line"><span>합계금액</span><strong>880,000원</strong></div>
                  <div className="landing-preview-document-line account"><span>입금계좌</span><strong>국민은행 · 예금주 김대표</strong></div>
                  <div className="landing-preview-document-foot"><Stamp size={18} /><span>우리 스튜디오</span></div>
                </section>
              </div>
            </div>
          </div>
        </header>

        <section className="landing-section" aria-labelledby="landing-flow-title">
          <div className="landing-section-heading">
            <p>업무 흐름</p>
            <h2 id="landing-flow-title">한 번 입력한 정보가 다음 업무로 이어집니다</h2>
            <span>같은 고객 정보와 금액을 문서마다 다시 입력하지 않아도 됩니다.</span>
          </div>
          <div className="landing-flow" aria-label="블링빌 업무 흐름">
            {workflow.map((step, index) => (
              <div className="landing-flow-step" key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
                {index < workflow.length - 1 && <ArrowRight aria-hidden="true" size={16} />}
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section" aria-labelledby="landing-features-title">
          <div className="landing-section-heading">
            <p>주요 기능</p>
            <h2 id="landing-features-title">실제 운영에 필요한 기능을 한곳에</h2>
          </div>
          <div className="landing-grid">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article className="landing-card" key={feature.title}>
                  <span className="landing-card-icon"><Icon size={20} /></span>
                  <strong>{feature.title}</strong>
                  <p>{feature.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="landing-setup-band">
          <div><Stamp size={19} /><span><strong>사업장 브랜딩</strong>로고와 도장을 등록하면 앱과 문서에 계속 적용됩니다.</span></div>
          <div><Mail size={19} /><span><strong>발신메일 연결</strong>네이버·Gmail·Microsoft·회사 메일을 한 번 연결해 사용합니다.</span></div>
          <div><Receipt size={19} /><span><strong>팝빌 연결</strong>가입한 사업자가 직접 한 번 연결하면 이후 자동발행에 사용됩니다.</span></div>
        </section>

        <div className="landing-final-cta">
          <div>
            <p>오늘의 견적부터 정산까지</p>
            <strong>흩어진 업무를 블링빌에서 이어보세요.</strong>
          </div>
          <button onClick={onStart}>블링빌 시작하기 <ArrowRight size={17} /></button>
        </div>

        <p className="landing-foot">업무 데이터는 로그인 계정별로 분리 저장됩니다. 세금계산서 자동발행과 고객 메일 발송은 각 사용자의 연결 설정 후 활성화됩니다.</p>
      </div>
    </section>
  );
}
