import { useRef } from "react";
import { Building2, ImagePlus, Landmark, Stamp, Trash2 } from "lucide-react";
import type { WorkspaceProfile } from "../types";
import { Input } from "./Input";
import { SectionTitle } from "./SectionTitle";

const allowedImageTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function BusinessBrandSettings({
  profile,
  logo,
  onProfileChange,
  onLogoChange
}: {
  profile: WorkspaceProfile;
  logo?: string;
  onProfileChange: (profile: WorkspaceProfile) => void;
  onLogoChange: (logo?: string) => void;
}) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);

  const handleImage = (file: File | undefined, label: string, onLoad: (value: string) => void) => {
    if (!file) return;
    if (!allowedImageTypes.includes(file.type)) {
      window.alert("PNG, JPG, WEBP 등 이미지 파일만 등록할 수 있습니다.");
      return;
    }
    if (file.size > 1024 * 1024) {
      window.alert(`${label} 파일은 1MB 이하로 등록해 주세요.`);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => window.alert(`${label} 파일을 읽지 못했습니다. 다른 이미지로 다시 시도해 주세요.`);
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const image = new Image();
      image.onload = () => onLoad(reader.result as string);
      image.onerror = () => window.alert("올바른 이미지 파일인지 확인해 주세요.");
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const patchAccount = (patch: Partial<WorkspaceProfile["paymentAccount"]>) => onProfileChange({
    ...profile,
    paymentAccount: { ...profile.paymentAccount, ...patch }
  });

  return (
    <div className="panel settings-card brand-settings-card">
      <SectionTitle title="사업장 브랜딩" hint="사업장 정보는 앱, 견적 문서와 고객 안내에 함께 사용됩니다." />

      <div className="brand-settings-layout">
        <div className={`brand-logo-preview ${logo ? "has-logo" : ""}`} aria-label="사업장 로고 미리보기">
          {logo ? <img src={logo} alt="사업장 로고" /> : <span>BB</span>}
        </div>
        <div className="brand-settings-fields">
          <Input label="사업장 이름" value={profile.businessName} placeholder="예: 블링까미 스튜디오" maxLength={40} onChange={(businessName) => onProfileChange({ ...profile, businessName })} />
          <div className="actions brand-logo-actions">
            <input ref={logoInputRef} type="file" accept={allowedImageTypes.join(",")} hidden onChange={(event) => { handleImage(event.target.files?.[0], "로고", onLogoChange); event.target.value = ""; }} />
            <button type="button" className="ghost" onClick={() => logoInputRef.current?.click()}><ImagePlus size={16} /> {logo ? "로고 변경" : "로고 등록"}</button>
            {logo && <button type="button" className="ghost danger-alert" onClick={() => onLogoChange(undefined)}><Trash2 size={16} /> 로고 삭제</button>}
          </div>
        </div>
      </div>

      <div className="brand-name-preview">
        <Building2 size={16} />
        <strong>{profile.businessName.trim() || "블링빌"}</strong>
        {(profile.businessName.trim() || logo) && <small>by 블링빌</small>}
      </div>

      <div className="settings-subsection">
        <SectionTitle title="도장·직인" hint="등록한 도장은 견적서와 거래명세서의 공급자 확인란에 표시됩니다." />
        <div className="brand-settings-layout stamp-settings-layout">
          <div className={`stamp-preview ${profile.stampDataUrl ? "has-stamp" : ""}`} aria-label="도장 미리보기">
            {profile.stampDataUrl ? <img src={profile.stampDataUrl} alt="사업장 도장" /> : <Stamp size={30} />}
          </div>
          <div className="brand-settings-fields">
            <p className="field-help">배경이 투명한 PNG 파일을 사용하면 문서에서 가장 자연스럽게 표시됩니다.</p>
            <div className="actions brand-logo-actions">
              <input ref={stampInputRef} type="file" accept={allowedImageTypes.join(",")} hidden onChange={(event) => { handleImage(event.target.files?.[0], "도장", (stampDataUrl) => onProfileChange({ ...profile, stampDataUrl })); event.target.value = ""; }} />
              <button type="button" className="ghost" onClick={() => stampInputRef.current?.click()}><Stamp size={16} /> {profile.stampDataUrl ? "도장 변경" : "도장 등록"}</button>
              {profile.stampDataUrl && <button type="button" className="ghost danger-alert" onClick={() => onProfileChange({ ...profile, stampDataUrl: undefined })}><Trash2 size={16} /> 도장 삭제</button>}
            </div>
          </div>
        </div>
      </div>

      <div className="settings-subsection">
        <SectionTitle title="입금계좌" hint="미수금 안내에 표시하고 필요하면 거래명세서와 세금계산서에도 표시할 수 있습니다." />
        <div className="grid three payment-account-fields">
          <Input label="은행" value={profile.paymentAccount.bankName} placeholder="예: 국민은행" maxLength={30} onChange={(bankName) => patchAccount({ bankName })} />
          <Input label="계좌번호" value={profile.paymentAccount.accountNumber} placeholder="사용할 표기 그대로 입력" maxLength={40} onChange={(accountNumber) => patchAccount({ accountNumber })} />
          <Input label="예금주" value={profile.paymentAccount.accountHolder} placeholder="예: 홍길동" maxLength={40} onChange={(accountHolder) => patchAccount({ accountHolder })} />
        </div>
        <div className="document-visibility-toggles">
          <label><input type="checkbox" checked={profile.paymentAccount.showOnUnpaidNotices} onChange={(event) => patchAccount({ showOnUnpaidNotices: event.target.checked })} /><span><strong>미수금 안내에 표시</strong><small>고객 상세 화면과 미수금 안내 이메일에 표시합니다.</small></span></label>
          <label><input type="checkbox" checked={profile.paymentAccount.showOnDocuments} onChange={(event) => patchAccount({ showOnDocuments: event.target.checked })} /><span><strong>발행 문서에도 표시</strong><small>거래명세서와 세금계산서 비고란에 표시합니다.</small></span></label>
        </div>
        <div className="payment-account-preview"><Landmark size={16} /><span>입금계좌</span><strong>{[profile.paymentAccount.bankName, profile.paymentAccount.accountNumber, profile.paymentAccount.accountHolder && `예금주 ${profile.paymentAccount.accountHolder}`].filter(Boolean).join(" · ") || "계좌정보를 입력해 주세요."}</strong></div>
      </div>
    </div>
  );
}
