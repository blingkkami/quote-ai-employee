import { useState } from "react";
import type { TaxApiIntegration, TaxApiProvider } from "../types";
import { SectionTitle } from "../components/SectionTitle";
import { Input } from "../components/Input";
import { Status } from "../components/Status";

const providerLabels: Record<TaxApiProvider, string> = {
  popbill: "Popbill",
  barobill: "Barobill",
  hometax: "Hometax"
};

export function SettingsView({ integration, onChange }: { integration: TaxApiIntegration; onChange: (integration: TaxApiIntegration) => void }) {
  const [draft, setDraft] = useState(integration);
  const [apiKeyPreview, setApiKeyPreview] = useState("");
  const [secretPreview, setSecretPreview] = useState("");

  const patchDraft = (patch: Partial<TaxApiIntegration>) => setDraft((prev) => ({ ...prev, ...patch }));
  const saveConnection = (connected: boolean) => {
    onChange({
      ...draft,
      isConnected: connected,
      lastTestedAt: connected ? new Date().toISOString() : draft.lastTestedAt
    });
  };

  return (
    <section className="settings-page">
      <div className="panel settings-card">
        <div className="settings-card-head">
          <SectionTitle
            title="세금계산서 API 연동"
            hint="한 번 연동하면 이후 발행은 이 계정의 API 정보로 진행됩니다. API Key와 Secret은 현재 화면에서 저장하지 않습니다."
          />
          <Status tone={draft.isConnected ? "issued" : "pending"}>{draft.isConnected ? "연동됨" : "미연동"}</Status>
        </div>

        <div className="grid two">
          <label>
            연동 업체
            <select value={draft.provider} onChange={(event) => patchDraft({ provider: event.target.value as TaxApiProvider, isConnected: false })}>
              {Object.entries(providerLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Input label="사업자등록번호" value={draft.businessNumber} placeholder="000-00-00000" onChange={(value) => patchDraft({ businessNumber: value, isConnected: false })} />
          <Input label="담당자 이메일" value={draft.contactEmail} placeholder="tax@example.com" onChange={(value) => patchDraft({ contactEmail: value, isConnected: false })} />
          <Input label="메모" value={draft.memo ?? ""} placeholder="발행 담당자, 내부 확인사항" onChange={(value) => patchDraft({ memo: value })} />
        </div>

        <div className="secure-box">
          <SectionTitle title="API 인증 정보" hint="실제 서비스에서는 서버 DB에 암호화 저장합니다. 이 로컬 앱은 키 값을 저장하지 않고 연동 상태만 저장합니다." />
          <div className="grid two">
            <Input label="API Key" value={apiKeyPreview} placeholder="저장하지 않음" onChange={setApiKeyPreview} />
            <Input label="API Secret" value={secretPreview} type="password" placeholder="저장하지 않음" onChange={setSecretPreview} />
          </div>
        </div>

        <div className="settings-summary">
          <span>사용 업체: {providerLabels[draft.provider]}</span>
          <span>마지막 테스트: {draft.lastTestedAt ? new Date(draft.lastTestedAt).toLocaleString("ko-KR") : "없음"}</span>
          <span>마지막 발행: {draft.lastIssuedAt ? new Date(draft.lastIssuedAt).toLocaleString("ko-KR") : "없음"}</span>
        </div>

        <div className="actions">
          <button
            onClick={() => {
              setApiKeyPreview("");
              setSecretPreview("");
              saveConnection(true);
            }}
            disabled={!draft.businessNumber || !draft.contactEmail}
          >
            연동 테스트 성공 처리
          </button>
          <button className="ghost" onClick={() => saveConnection(false)}>
            연동 해제
          </button>
        </div>
      </div>
    </section>
  );
}
