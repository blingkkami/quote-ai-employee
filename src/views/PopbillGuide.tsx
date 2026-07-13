import { useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, RotateCw, ShieldCheck } from "lucide-react";

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

export function PopbillGuide({ onUseAccessToken }: { onUseAccessToken: (token: string) => void }) {
  const [accessToken, setAccessToken] = useState(makeAccessToken);
  const [copied, setCopied] = useState<"token" | "env" | "failed" | null>(null);

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

  return (
    <div className="popbill-guide">
      <div className="guide-callout">
        <ShieldCheck size={22} />
        <div>
          <strong>최초 1회 연결하면 계속 자동 발행됩니다.</strong>
          <p>같은 브라우저에서는 다시 입력할 필요가 없습니다. 보안키를 바꾸거나 쿠키를 삭제하거나 직접 연결을 해제한 경우에만 다시 연결합니다.</p>
        </div>
      </div>

      <section className="guide-section">
        <div className="guide-heading">
          <span>1</span>
          <div><strong>팝빌 연동을 신청합니다</strong><p>앱 운영자가 팝빌 파트너 연동을 신청해 LinkID와 SecretKey를 발급받습니다.</p></div>
        </div>
        <div className="guide-links">
          {officialLinks.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label}<ExternalLink size={14} /></a>
          ))}
        </div>
      </section>

      <section className="guide-section">
        <div className="guide-heading">
          <span>2</span>
          <div><strong>사업자와 공동인증서를 등록합니다</strong><p>발행할 사업자번호를 팝빌 연동회원으로 등록하고 전자세금계산서용 공동인증서를 등록합니다. 테스트와 운영 계정은 각각 확인해야 합니다.</p></div>
        </div>
      </section>

      <section className="guide-section">
        <div className="guide-heading">
          <span>3</span>
          <div><strong>Vercel에 서버 인증정보를 1회 저장합니다</strong><p>아래 값을 Vercel 프로젝트의 Environment Variables에 추가한 뒤 다시 배포합니다. 팝빌 비밀키는 앱 화면이나 GitHub에 올리지 않습니다.</p></div>
        </div>
        <div className="guide-token-row">
          <code>{accessToken}</code>
          <button className="icon" title={copied === "failed" ? "복사하지 못했습니다" : "발행 보안키 복사"} aria-label="발행 보안키 복사" onClick={() => copy(accessToken, "token")}>{copied === "token" ? <Check size={16} /> : <Copy size={16} />}</button>
          <button className="icon" title="새 발행 보안키 생성" aria-label="새 발행 보안키 생성" onClick={() => { setAccessToken(makeAccessToken()); setCopied(null); }}><RotateCw size={16} /></button>
        </div>
        <div className="guide-code">
          <div><strong>Vercel 환경변수 예시</strong><button className="ghost" onClick={() => copy(environmentTemplate(accessToken), "env")}>{copied === "env" ? <Check size={15} /> : <Copy size={15} />} {copied === "env" ? "복사됨" : copied === "failed" ? "복사 실패" : "전체 복사"}</button></div>
          <pre>{environmentTemplate(accessToken)}</pre>
        </div>
      </section>

      <section className="guide-section">
        <div className="guide-heading">
          <span>4</span>
          <div><strong>이 브라우저를 최초 1회 연결합니다</strong><p>배포가 끝나면 아래 버튼을 눌러 생성한 보안키를 연동 설정에 넣고 ‘연결하고 상태 확인’을 누릅니다.</p></div>
        </div>
        <button onClick={() => onUseAccessToken(accessToken)}><KeyRound size={16} /> 이 보안키로 연결하기</button>
      </section>

      <section className="guide-section">
        <div className="guide-heading">
          <span>5</span>
          <div><strong>테스트 후 운영 발행으로 전환합니다</strong><p><code>POPBILL_IS_TEST=true</code>에서 먼저 발행을 확인하고, 팝빌 운영 전환 승인 후 값을 <code>false</code>로 바꿔 재배포합니다.</p></div>
        </div>
      </section>

      <section className="guide-section guide-issue-flow">
        <h3>자동 발행 방법</h3>
        <ol>
          <li>고객 관리에서 상호, 사업자등록번호, 대표자 정보를 입력합니다.</li>
          <li>견적 작성에서 발행 방식을 ‘자동 발행’으로 두고 세금계산서 발행을 선택합니다.</li>
          <li>견적을 저장한 뒤 ‘승인·발행’을 누르면 팝빌로 즉시 발행을 요청합니다.</li>
          <li>발행센터에서 발행 완료·국세청 전송·실패 상태를 확인하고 실패 건은 다시 시도합니다.</li>
        </ol>
        <p className="guide-note">‘자동 발행’은 승인·발행 버튼을 누른 새 견적에 적용됩니다. 이미 발행 대기인 견적은 발행센터에서 재시도해야 합니다.</p>
      </section>
    </div>
  );
}
