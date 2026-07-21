import { CheckCircle2, ExternalLink, FileCheck2, Link2, Send } from "lucide-react";

const steps = [
  {
    icon: Link2,
    title: "사업자번호 확인",
    body: "연결 설정에서 사업자등록번호를 입력하고 연결 시작을 누릅니다."
  },
  {
    icon: FileCheck2,
    title: "최초 정보 입력",
    body: "팝빌을 처음 사용하는 경우에만 사업자와 담당자 정보를 입력합니다. 비밀번호는 가입 요청 후 저장되지 않습니다."
  },
  {
    icon: Send,
    title: "승인 후 자동발행",
    body: "견적의 발행 방식을 자동으로 선택하고 승인하면 해당 사업자 명의로 팝빌 발행을 요청합니다."
  }
];

export function PopbillGuide() {
  return (
    <div className="popbill-guide customer-guide">
      <div className="guide-callout">
        <CheckCircle2 size={22} />
        <div>
          <strong>한 번 연결하면 다시 입력하지 않습니다.</strong>
          <p>팝빌 개발자 키나 Vercel 설정은 블링빌 운영자가 관리하며 고객에게 표시되지 않습니다.</p>
        </div>
      </div>
      <div className="customer-guide-steps">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <section key={step.title}>
              <span><Icon size={18} /></span>
              <div><small>{index + 1}단계</small><strong>{step.title}</strong><p>{step.body}</p></div>
            </section>
          );
        })}
      </div>
      <div className="guide-outro">
        <h3>발행 전 확인할 내용</h3>
        <ol>
          <li>고객 관리에 상호, 사업자등록번호, 대표자명과 이메일을 입력합니다.</li>
          <li>견적서의 금액과 발행일을 확인한 뒤 승인합니다.</li>
          <li>발행센터에서 팝빌 발행 및 국세청 전송 상태를 확인합니다.</li>
        </ol>
        <div className="guide-links">
          <a href="https://www.popbill.com" target="_blank" rel="noreferrer">팝빌 열기 <ExternalLink size={14} /></a>
        </div>
      </div>
    </div>
  );
}
