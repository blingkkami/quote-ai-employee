import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, Eye, EyeOff, KeyRound, RotateCw, ShieldCheck } from "lucide-react";

const officialLinks = [
  { label: "팝빌 연동 신청", href: "https://developers.popbill.com/customer-center/partner-request" },
  { label: "테스트 인증서 신청", href: "https://developers.popbill.com/customer-center/requestcert" },
  { label: "운영 전환 신청", href: "https://developers.popbill.com/customer-center/serviceopen" },
  { label: "전자세금계산서 발행 안내", href: "https://developers.popbill.com/reference/taxinvoice/node/getting-started/tutorial" }
];

const makeAccessToken = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
};

const environmentTemplate = (accessToken: string) => `POPBILL_LINK_ID=팝빌에서_발급받은_LinkID
POPBILL_SECRET_KEY=팝빌에서_발급받은_SecretKey
POPBILL_CORP_NUM=사업자등록번호_숫자10자리
POPBILL_CORP_NAME=공급자_상호
POPBILL_CEO_NAME=대표자명
POPBILL_USER_ID=팝빌_회원아이디
POPBILL_IS_TEST=true
POPBILL_ACCESS_TOKEN=${accessToken}`;

const STEPS_KEY = "blingbill_popbill_steps";
const STEP_COUNT = 4;

const loadSteps = (): boolean[] => {
  try {
    const raw = window.localStorage.getItem(STEPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return Array.from({ length: STEP_COUNT }, (_, i) => parsed[i] === true);
      }
    }
  } catch {
    // 저장된 값을 읽지 못하면 처음부터 시작합니다.
  }
  return Array.from({ length: STEP_COUNT }, () => false);
};

function StepCard({
  index,
  title,
  why,
  checked,
  highlighted,
  onToggle,
  children
}: {
  index: number;
  title: string;
  why: string;
  checked: boolean;
  highlighted: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const className = ["guide-step", highlighted ? "is-current" : "", checked ? "is-done" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <section className={className}>
      <div className="guide-step-head">
        <span className="guide-step-num">{checked ? <Check size={16} /> : index}</span>
        <div className="guide-step-title">
          <strong>{`${index}단계 — ${title}`}</strong>
          <p>{why}</p>
        </div>
      </div>
      <div className="guide-step-body">{children}</div>
      <label className="guide-step-check">
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <span>완료</span>
      </label>
    </section>
  );
}

export function PopbillGuide({ onUseAccessToken }: { onUseAccessToken: (token: string) => void }) {
  const [accessToken, setAccessToken] = useState(makeAccessToken);
  const [copied, setCopied] = useState<"token" | "env" | "failed" | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [steps, setSteps] = useState<boolean[]>(loadSteps);

  useEffect(() => {
    try {
      window.localStorage.setItem(STEPS_KEY, JSON.stringify(steps));
    } catch {
      // 저장 실패는 무시합니다 (체크 상태는 화면에서 그대로 유지됩니다).
    }
  }, [steps]);

  const toggleStep = (index: number) => {
    setSteps((prev) => prev.map((done, i) => (i === index ? !done : done)));
  };

  const doneCount = steps.filter(Boolean).length;
  const currentStep = steps.findIndex((done) => !done); // 첫 미완료 단계, 모두 완료면 -1

  const copy = async (value: string, target: "token" | "env") => {
    try {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const succeeded = document.execCommand("copy");
        textarea.remove();
        if (!succeeded) throw new Error("copy failed");
      }
      setCopied(target);
    } catch {
      setCopied("failed");
    }
    window.setTimeout(() => setCopied(null), 1800);
  };

  const maskedToken = showToken ? accessToken : "●".repeat(24);

  return (
    <div className="popbill-guide">
      <div className="guide-progress">
        <span className="guide-progress-pill">{`${STEP_COUNT}단계 중 ${doneCount}단계 완료`}</span>
        <div className="guide-progress-bar" aria-hidden="true">
          <i style={{ width: `${(doneCount / STEP_COUNT) * 100}%` }} />
        </div>
      </div>

      <div className="guide-callout">
        <ShieldCheck size={22} />
        <div>
          <strong>한 번만 연결하면 그다음부터는 승인 버튼 하나로 세금계산서가 자동 발행됩니다.</strong>
          <p>아래 순서대로 천천히 따라와 주세요. 막히면 그 화면을 캡처해서 도움을 요청하세요.</p>
        </div>
      </div>

      <StepCard
        index={1}
        title="팝빌에 가입해요"
        why="팝빌은 세금계산서를 나라(국세청)에 대신 보내주는 우체국 같은 서비스예요."
        checked={steps[0]}
        highlighted={currentStep === 0}
        onToggle={() => toggleStep(0)}
      >
        <p className="guide-step-line">
          <strong>준비물:</strong> 사업자등록번호
        </p>
        <p className="guide-step-line">아래 버튼을 눌러 팝빌 연동 신청 페이지에서 가입과 신청을 해주세요. 하루 정도 걸릴 수 있어요.</p>
        <div className="guide-links">
          {[officialLinks[0], officialLinks[1]].map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
              {link.label}
              <ExternalLink size={14} />
            </a>
          ))}
        </div>
      </StepCard>

      <StepCard
        index={2}
        title="열쇠 2개를 받아요"
        why="신청이 승인되면 팝빌이 열쇠 2개를 줍니다. 이름은 LinkID와 SecretKey예요. 이 열쇠들이 있어야 우리 앱이 팝빌에 들어갈 수 있어요."
        checked={steps[1]}
        highlighted={currentStep === 1}
        onToggle={() => toggleStep(1)}
      >
        <p className="guide-step-line">팝빌에서 받은 LinkID와 SecretKey를 메모장에 잠깐 복사해 두세요. 남에게 보여주면 안 돼요!</p>
      </StepCard>

      <StepCard
        index={3}
        title="열쇠를 서버 금고에 넣어요"
        why="Vercel은 우리 앱이 사는 집이에요. 그 집 금고에 열쇠를 넣어두면 앱이 알아서 꺼내 씁니다."
        checked={steps[2]}
        highlighted={currentStep === 2}
        onToggle={() => toggleStep(2)}
      >
        <button className="guide-primary" onClick={() => copy(environmentTemplate(accessToken), "env")}>
          {copied === "env" ? <Check size={16} /> : <Copy size={16} />}
          {copied === "env" ? "복사됐어요" : copied === "failed" ? "복사 실패" : "설정값 전체 복사"}
        </button>

        <div className="guide-token-row">
          <code>{maskedToken}</code>
          <button
            className="icon"
            title={showToken ? "발행 보안키 숨기기" : "발행 보안키 보기"}
            aria-label={showToken ? "발행 보안키 숨기기" : "발행 보안키 보기"}
            onClick={() => setShowToken((v) => !v)}
          >
            {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button
            className="icon"
            title={copied === "failed" ? "복사하지 못했습니다" : "발행 보안키 복사"}
            aria-label="발행 보안키 복사"
            onClick={() => copy(accessToken, "token")}
          >
            {copied === "token" ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button
            className="icon"
            title="새 발행 보안키 생성"
            aria-label="새 발행 보안키 생성"
            onClick={() => {
              setAccessToken(makeAccessToken());
              setCopied(null);
            }}
          >
            <RotateCw size={16} />
          </button>
        </div>
        <p className="guide-step-hint">위 [설정값 전체 복사] 안에 발행 보안키가 이미 들어 있어요. 열쇠 모양 버튼은 확인·복사·재생성용이에요.</p>

        <ol className="guide-substeps">
          <li>
            <strong>[설정값 전체 복사]</strong> 버튼을 눌러요.
          </li>
          <li>
            <span>vercel.com에 로그인해요.</span>
            <div className="guide-links">
              <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">
                Vercel 열기
                <ExternalLink size={14} />
              </a>
            </div>
          </li>
          <li>
            <strong>quote-ai-employee</strong> 프로젝트를 눌러요.
          </li>
          <li>
            위쪽 <strong>Settings</strong> → 왼쪽 <strong>Environment Variables</strong>를 눌러요.
          </li>
          <li>입력칸에 복사한 내용을 붙여넣으면 항목들이 한 번에 채워져요. 그리고 각 줄의 '팝빌에서_발급받은…' 부분을 진짜 값으로 바꿔요.</li>
          <li>
            <strong>[Save]</strong>를 누르고, <strong>Deployments</strong> 탭에서 맨 위 항목의 ⋯ 메뉴 → <strong>[Redeploy]</strong>를 눌러요.
          </li>
        </ol>

        <details className="guide-code-details">
          <summary>복사되는 내용 미리 보기</summary>
          <div className="guide-code">
            <div>
              <strong>Vercel 환경변수 예시</strong>
              <button className="ghost" onClick={() => copy(environmentTemplate(accessToken), "env")}>
                {copied === "env" ? <Check size={15} /> : <Copy size={15} />}{" "}
                {copied === "env" ? "복사됨" : copied === "failed" ? "복사 실패" : "전체 복사"}
              </button>
            </div>
            <pre>{environmentTemplate(accessToken)}</pre>
          </div>
        </details>
      </StepCard>

      <StepCard
        index={4}
        title="앱과 악수시켜요"
        why="마지막으로 이 브라우저와 서버가 서로 확인하는 단계예요."
        checked={steps[3]}
        highlighted={currentStep === 3}
        onToggle={() => toggleStep(3)}
      >
        <p className="guide-step-line">아래 버튼을 누르면 보안키가 자동으로 입력돼요. 이어서 [연결하고 상태 확인]을 누르면 끝!</p>
        <button className="guide-primary" onClick={() => onUseAccessToken(accessToken)}>
          <KeyRound size={16} /> 이 보안키로 연결하기
        </button>
      </StepCard>

      <section className="guide-outro">
        <h3>연결 후 이렇게 발행돼요</h3>
        <ol>
          <li>고객 관리에서 상호, 사업자등록번호, 대표자 정보를 입력합니다.</li>
          <li>견적 작성에서 발행 방식을 ‘자동 발행’으로 두고 세금계산서 발행을 선택합니다.</li>
          <li>견적을 저장한 뒤 ‘승인·발행’을 누르면 팝빌로 즉시 발행을 요청합니다.</li>
          <li>발행센터에서 발행 완료·국세청 전송·실패 상태를 확인하고 실패 건은 다시 시도합니다.</li>
        </ol>
        <p className="guide-note">
          처음에는 연습 모드(<code>POPBILL_IS_TEST=true</code>)로 발행해 보세요. 진짜 발행으로 바꿀 준비가 되면 그 값만 <code>false</code>로 바꾸고 다시 배포하면 됩니다.
        </p>
        <h3>1년에 한 번만 챙겨주세요</h3>
        <ol>
          <li>세금계산서용 공동인증서는 보통 1년마다 유효기간이 끝나요. 만료 전에 은행이나 인증기관에서 갱신해 주세요.</li>
          <li>갱신한 새 인증서를 팝빌에 다시 등록해 주세요. 이걸 안 하면 발행이 실패해요.</li>
        </ol>
        <div className="guide-links">
          <a href="https://www.popbill.com" target="_blank" rel="noreferrer">
            팝빌에서 인증서 다시 등록하기
            <ExternalLink size={14} />
          </a>
        </div>
        <p className="guide-note">발행이 갑자기 실패하기 시작하면 가장 먼저 인증서 만료를 의심해 보세요.</p>
      </section>
    </div>
  );
}
