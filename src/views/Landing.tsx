import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  FileCheck2,
  FileText,
  HandCoins,
  Landmark,
  Mail,
  Receipt,
  Search,
  Send,
  Stamp,
  Users
} from "lucide-react";
import { useState } from "react";
import { billingPlans, creditPackages, formatWon, planFeatureAccess, type BillableFeature } from "../lib/billing-plans";

const workflow = [
  { number: "01", title: "견적 작성", body: "고객과 항목을 입력하면 문서가 실시간으로 완성됩니다." },
  { number: "02", title: "승인·발행", body: "승인된 견적을 거래명세서와 세금계산서로 이어갑니다." },
  { number: "03", title: "고객 발송", body: "연결한 내 메일로 필요한 문서를 고객에게 보냅니다." },
  { number: "04", title: "수금·매입", body: "부분 수금과 매입 지급을 날짜별로 기록합니다." },
  { number: "05", title: "미수·손익 확인", body: "남은 금액과 사업 흐름을 대시보드에서 확인합니다." }
];

const featureCards = [
  {
    icon: FileText,
    title: "한 번 입력으로 문서 완성",
    body: "견적서와 거래명세서를 실시간 미리보기로 확인하고, 로고·도장이 반영된 PDF로 바로 발행합니다."
  },
  {
    icon: Receipt,
    title: "발행 누락 없이 다음 단계로",
    body: "승인된 견적을 세금계산서 발행으로 자연스럽게 이어갑니다. 팝빌을 연동한 사업자만 실제 발행됩니다."
  },
  {
    icon: Users,
    title: "고객별 거래를 한눈에",
    body: "이름·사업자번호로 빠르게 찾고, 상세 화면에서 누적 매출과 전체 거래 내역을 바로 확인합니다."
  },
  {
    icon: HandCoins,
    title: "남은 금액이 바로 보이는 원장",
    body: "부분 수금과 부분 지급을 실제 입출금 날짜로 기록해 미수금·미지급금 잔액을 항상 최신으로 유지합니다."
  },
  {
    icon: Mail,
    title: "내 메일 주소로 그대로 발송",
    body: "Gmail·Microsoft·네이버·회사 메일을 연결해 문서와 미수금 안내를 내 주소에서 보냅니다."
  },
  {
    icon: BarChart3,
    title: "이번 달 사업 흐름 확인",
    body: "월간·연간 매출, 수금, 매입, 미수금과 추정 이익을 한 화면에서 비교합니다."
  }
];

const faqs = [
  {
    question: "팝빌 정보는 사용할 때마다 입력해야 하나요?",
    answer: "아니요. 세금계산서를 발행할 사업자가 최초 한 번 연동하면 설정이 유지되고, 이후에는 승인된 발행 건에 사용됩니다. 연동되지 않은 계정은 실제 발행 완료로 표시하지 않습니다."
  },
  {
    question: "네이버 메일이나 회사 메일도 연결할 수 있나요?",
    answer: "Gmail과 Microsoft 계정은 간편 연결 방식으로, 네이버와 일반 회사 메일은 SMTP 정보로 한 번 연결해 계속 사용하는 구조입니다."
  },
  {
    question: "휴대폰으로도 쓸 수 있나요?",
    answer: "설치 없이 휴대폰 브라우저에서 바로 로그인해 사용합니다. 현장에서 견적을 확인하고 수정하거나 수금을 기록하기 좋고, A4 견적서 미리보기와 PDF 출력은 화면이 넓은 PC나 태블릿이 더 편합니다."
  }
];

const featureRows: { key: BillableFeature; label: string; credit?: string }[] = [
  { key: "customerManagement", label: "고객관리" },
  { key: "quoteDrafting", label: "견적서 작성·저장" },
  { key: "businessSettings", label: "사업장 설정" },
  { key: "businessStatusCheck", label: "사업자등록상태조회", credit: "0cr" },
  { key: "taxInvoice", label: "전자세금계산서 발행", credit: "2cr" },
  { key: "quotePdf", label: "견적서 PDF 발행·발송", credit: "1cr" },
  { key: "transactionStatement", label: "거래명세서 발행", credit: "1cr" },
  { key: "email", label: "메일 발송", credit: "1cr" },
  { key: "unpaidNotice", label: "미수금 안내", credit: "1cr" },
  { key: "ledger", label: "원장" },
  { key: "receivablesAndPurchases", label: "미수·매입 관리" },
  { key: "operationsDashboard", label: "운영 현황" }
];

const accessText = (feature: BillableFeature, planId: "free" | "starter" | "pro50") => {
  const access = planFeatureAccess[planId][feature];
  if (feature === "taxInvoice" && planId === "starter") return "월 10건";
  if (feature === "taxInvoice" && planId === "pro50") return "월 50/100건";
  if (access === "credit") return featureRows.find((row) => row.key === feature)?.credit ?? "크레딧";
  if (access === "unlimited") return "무제한";
  if (access === "blocked") return "—";
  return "포함";
};

export function Landing({ onStart }: { onStart: () => void }) {
  const [proInvoiceLimit, setProInvoiceLimit] = useState<50 | 100>(50);
  const proPlan = billingPlans.find((plan) => plan.id === (proInvoiceLimit === 50 ? "pro50" : "pro100"))!;
  const starterPlan = billingPlans.find((plan) => plan.id === "starter")!;

  return (
    <div className="landing landing-sales">
      <header className="landing-nav-shell">
        <nav className="landing-nav" aria-label="소개 메뉴">
          <a className="landing-nav-brand" href="#top" aria-label="블링빌 처음으로">
            <span>BB</span>
            <strong>블링빌</strong>
          </a>
          <div className="landing-nav-links">
            <a href="#workflow">업무 흐름</a>
            <a href="#features">주요 기능</a>
            <a href="#pricing">요금제</a>
            <a href="#setup">연결 설정</a>
            <a href="#faq">자주 묻는 질문</a>
          </div>
          <button className="landing-nav-login" onClick={onStart}>로그인</button>
        </nav>
      </header>

      <main id="top">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <p className="landing-kicker">프리랜서·1인 사업장을 위한 견적·발행·수금 워크플로우</p>
            <h1>블링빌</h1>
            <strong>반복 입력과 발행 누락을 줄입니다</strong>
            <p>견적서를 한 번 작성하면 거래명세서·세금계산서 발행, 고객 발송, 수금·미수 관리까지 같은 정보로 이어집니다. 문서마다 고객과 금액을 다시 입력할 필요가 없습니다.</p>
            <div className="landing-hero-actions">
              <button onClick={onStart}>무료로 시작하기 <ArrowRight size={18} /></button>
              <a href="#features">기능 먼저 보기</a>
            </div>
            <div className="landing-hero-proof" aria-label="블링빌 핵심 특징">
              <span><Check size={15} /> 자동 저장</span>
              <span><Check size={15} /> 어디서나 이어쓰기</span>
              <span><Check size={15} /> 로고·도장 적용</span>
              <span><Check size={15} /> 내 메일 발송</span>
            </div>
          </div>

          <figure className="landing-product-stage">
            <div className="landing-stage-toolbar">
              <span><i /> <i /> <i /></span>
              <strong>우리 사업장의 오늘을 한눈에</strong>
              <span className="landing-stage-status"><CheckCircle2 size={14} /> 자동 저장됨</span>
            </div>
            <div className="landing-stage-preview-crop">
              <img src="/blingbill-dashboard-preview.png" alt="블링빌 대시보드에서 매출, 수금, 미수금과 거래명세서를 확인하는 화면" />
            </div>
          </figure>
        </section>

        <section className="landing-audience" aria-label="이런 분께 맞습니다">
          <strong>이런 분께 맞습니다</strong>
          <span>디자인·개발 프리랜서</span>
          <span>1인·소규모 사업장</span>
          <span>견적과 세금계산서를 자주 다루는 팀</span>
        </section>

        <section className="landing-document-strip" aria-label="지원 업무">
          <div><FileText size={19} /><span><strong>견적서</strong>실시간 미리보기·PDF</span></div>
          <div><FileCheck2 size={19} /><span><strong>거래명세서</strong>계좌·비고·도장 반영</span></div>
          <div><Receipt size={19} /><span><strong>세금계산서</strong>팝빌 연동 발행</span></div>
          <div><Send size={19} /><span><strong>미수금 안내</strong>고객 이메일 발송</span></div>
        </section>

        <section className="landing-section landing-workflow" id="workflow">
          <div className="landing-section-heading">
            <p>하나로 이어지는 업무</p>
            <h2>한 번 입력한 정보가 다음 단계로 이어집니다</h2>
            <span>같은 고객 정보와 금액을 문서마다 다시 입력하지 않고, 승인부터 정산까지 연결합니다.</span>
          </div>
          <div className="landing-workflow-list">
            {workflow.map((step, index) => (
              <article key={step.number}>
                <span>{step.number}</span>
                <div><strong>{step.title}</strong><p>{step.body}</p></div>
                {index < workflow.length - 1 && <ArrowRight size={17} aria-hidden="true" />}
              </article>
            ))}
          </div>
        </section>

        <section className="landing-operation-band">
          <div className="landing-operation-copy">
            <p>빠르게 찾고, 바로 처리합니다</p>
            <h2>고객과 거래가 늘어나도<br />복잡해지지 않도록</h2>
            <span>고객과 매입처는 먼저 깔끔한 목록으로 확인하고, 검색하거나 클릭하면 상세 정보와 관련 거래 내역이 한 화면에 열립니다.</span>
            <ul>
              <li><Search size={16} /> 이름·사업자번호·연락처 통합 검색</li>
              <li><Users size={16} /> 고객별 누적 매출과 미수금 확인</li>
              <li><Building2 size={16} /> 매입처별 지급·미지급 내역 관리</li>
            </ul>
          </div>
          <div className="landing-operation-demo" aria-label="고객과 거래 검색 화면 예시">
            <div className="landing-demo-search"><Search size={16} /><span>고객명, 사업자번호, 프로젝트 검색</span><kbd>Ctrl K</kbd></div>
            <div className="landing-demo-head"><span>고객</span><span>최근 거래</span><span>누적 매출</span><span>미수금</span></div>
            <div className="landing-demo-row active"><span><i>라</i><strong>라이트 코스메틱<small>214-88-12031</small></strong></span><span>상세페이지 제작</span><b>4,620,000원</b><em>0원</em></div>
            <div className="landing-demo-row"><span><i>모</i><strong>모노 스튜디오<small>대표 김모노</small></strong></span><span>브랜드 디자인</span><b>2,310,000원</b><em>440,000원</em></div>
            <div className="landing-demo-row"><span><i>오</i><strong>오브제 컴퍼니<small>106-14-82110</small></strong></span><span>제품 비주얼</span><b>1,980,000원</b><em>290,000원</em></div>
          </div>
        </section>

        <section className="landing-section" id="features">
          <div className="landing-section-heading">
            <p>실제 운영을 위한 기능</p>
            <h2>문서 작성에서 손익 확인까지 한곳에</h2>
          </div>
          <div className="landing-feature-grid">
            {featureCards.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title}>
                  <span><Icon size={20} /></span>
                  <strong>{feature.title}</strong>
                  <p>{feature.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="landing-pricing" id="pricing">
          <div className="landing-section-heading">
            <p>필요한 만큼만 선택</p>
            <h2>무료로 시작하고, 관리가 필요할 때 정액권으로</h2>
            <span>초과 발행은 자동 결제되지 않습니다. 필요한 크레딧을 직접 구매해 사용합니다.</span>
          </div>
          <div className="pricing-grid">
            <article className="pricing-card">
              <div className="pricing-card-head"><span>가볍게 시작</span><h3>무료 + 크레딧</h3></div>
              <strong className="pricing-price">0원<small>/월</small></strong>
              <p>고객관리와 견적서 작성은 무료입니다. 발행·발송할 때만 크레딧을 사용합니다.</p>
              <ul>
                <li><Check size={16} /> 신규 가입 3크레딧</li>
                <li><Check size={16} /> 세금계산서 2크레딧/건</li>
                <li><Check size={16} /> PDF·메일·미수안내 1크레딧/건</li>
              </ul>
              <button className="pricing-secondary" onClick={onStart}>무료로 시작</button>
            </article>
            <article className="pricing-card">
              <div className="pricing-card-head"><span>기본 관리</span><h3>{starterPlan.name}</h3></div>
              <strong className="pricing-price">{formatWon(starterPlan.monthlyPrice)}<small>/월</small></strong>
              <p>월 {starterPlan.includedTaxInvoices}건의 세금계산서와 반복 발행·발송 업무를 묶었습니다.</p>
              <ul>
                <li><Check size={16} /> 세금계산서 월 10건 포함</li>
                <li><Check size={16} /> PDF·거래명세서·메일 무제한</li>
                <li><Check size={16} /> 원장·미수·매입 관리</li>
              </ul>
              <button className="pricing-secondary" onClick={onStart}>입문 시작하기</button>
            </article>
            <article className="pricing-card featured">
              <div className="pricing-popular">추천</div>
              <div className="pricing-card-head">
                <span>운영까지 한눈에</span><h3>Pro</h3>
                <div className="pricing-toggle" aria-label="Pro 세금계산서 포함 건수">
                  <button className={proInvoiceLimit === 50 ? "active" : ""} onClick={() => setProInvoiceLimit(50)}>50건</button>
                  <button className={proInvoiceLimit === 100 ? "active" : ""} onClick={() => setProInvoiceLimit(100)}>100건</button>
                </div>
              </div>
              <strong className="pricing-price">{formatWon(proPlan.monthlyPrice)}<small>/월</small></strong>
              <p>Pro 기능은 동일하고 세금계산서 포함 건수만 선택합니다.</p>
              <ul>
                <li><Check size={16} /> 세금계산서 월 {proPlan.includedTaxInvoices}건 포함</li>
                <li><Check size={16} /> 입문 플랜의 모든 기능</li>
                <li><Check size={16} /> 운영 현황 대시보드</li>
              </ul>
              <button onClick={onStart}>Pro 시작하기</button>
            </article>
          </div>
          <div className="credit-pricing">
            <div><strong>크레딧 추가 구매</strong><span>정액권 포함 건수를 넘겨도 자동 과금되지 않습니다.</span></div>
            <div className="credit-package-list">
              {creditPackages.map((item) => (
                <span key={item.id}><b>{item.credits}cr</b>{formatWon(item.price)}<small>{Math.round(item.price / item.credits).toLocaleString("ko-KR")}원/cr</small></span>
              ))}
            </div>
          </div>
          <div className="pricing-comparison">
            <div className="pricing-comparison-head">
              <div><strong>기능별 사용 범위</strong><span>무료 사용과 크레딧 차감, 요금제 포함 범위를 모두 비교하세요.</span></div>
              <span>무료 + 크레딧</span><span>입문</span><span>Pro</span>
            </div>
            {featureRows.map((row) => (
              <div className="pricing-comparison-row" key={row.key}>
                <strong>{row.label}</strong>
                {(["free", "starter", "pro50"] as const).map((planId) => (
                  <span key={planId} className={planFeatureAccess[planId][row.key] === "blocked" ? "blocked" : ""}>
                    {accessText(row.key, planId)}
                  </span>
                ))}
              </div>
            ))}
            <p>포함 건수를 모두 사용하면 발행을 잠시 멈추고 크레딧 구매를 안내합니다. 사용자 동의 없는 자동 초과 결제는 하지 않습니다.</p>
          </div>
        </section>

        <section className="landing-setup" id="setup">
          <div className="landing-section-heading light">
            <p>처음 한 번만 설정</p>
            <h2>내 사업장 모습과 발행 환경을 그대로</h2>
            <span>반복해서 입력하지 않도록 사업장 설정에 안전하게 보관합니다.</span>
          </div>
          <div className="landing-setup-grid">
            <article><Stamp size={22} /><div><span>01</span><strong>로고·도장 등록</strong><p>사업장 이름과 로고는 앱에, 도장은 발행 문서에 자동 반영합니다.</p></div></article>
            <article><Mail size={22} /><div><span>02</span><strong>발신메일 연결</strong><p>개인·회사 메일을 한 번 연결해 이후 고객 발송에 계속 사용합니다.</p></div></article>
            <article><Receipt size={22} /><div><span>03</span><strong>팝빌 연결</strong><p>세금계산서를 발행할 사업자가 직접 연결하고 실제 발행 상태를 확인합니다.</p></div></article>
            <article><Landmark size={22} /><div><span>04</span><strong>입금계좌 등록</strong><p>거래명세서, 세금계산서와 미수금 안내에만 선택적으로 표시합니다.</p></div></article>
          </div>
        </section>

        <section className="landing-section landing-faq" id="faq">
          <div className="landing-section-heading">
            <p>자주 묻는 질문</p>
            <h2>연결과 발행 전에 확인하세요</h2>
          </div>
          <div className="landing-faq-list">
            {faqs.map((faq, index) => (
              <details key={faq.question} open={index === 0}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="landing-final-cta">
          <div><p>견적을 만드는 오늘부터</p><h2>사업장 업무를 블링빌로 이어보세요</h2><span>문서와 고객, 입출금 흐름을 하나의 계정에서 관리합니다.</span></div>
          <button onClick={onStart}>블링빌 시작하기 <ArrowRight size={18} /></button>
        </section>
      </main>

      <footer className="landing-footer"><span className="brand-mark">BB</span><strong>블링빌</strong><p>견적·발행·정산 통합 업무 도구</p></footer>
    </div>
  );
}
