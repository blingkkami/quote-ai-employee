import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import type { Customer, CustomerSnapshot, QuoteRecord, WorkspaceProfile } from "../types";
import { uid } from "../lib/id";
import { invoiceLabels } from "../constants";
import { SectionTitle } from "../components/SectionTitle";
import { Input } from "../components/Input";
import { AddressInput } from "../components/AddressInput";
import { TextArea } from "../components/TextArea";
import { QuotePreview } from "./QuotePreview";
import { formatBusinessNumber, formatPhoneNumber } from "../lib/input-format";

export function QuoteBuilder({
  quote,
  customers,
  onSave,
  onApprove,
  onCustomerUpdate,
  logo,
  onLogoChange,
  workspaceProfile,
  itemSuggestions,
  isApproving
}: {
  quote: QuoteRecord;
  customers: Customer[];
  onSave: (quote: QuoteRecord) => void;
  onApprove: (quote: QuoteRecord) => void;
  onCustomerUpdate: (customer: Customer) => void;
  logo?: string;
  onLogoChange: (logoDataUrl?: string) => void;
  workspaceProfile: WorkspaceProfile;
  itemSuggestions: { category: string; description: string }[];
  isApproving: boolean;
}) {
  const [draft, setDraft] = useState(quote);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const latestDraftRef = useRef(quote);
  const lastSavedRef = useRef(JSON.stringify(quote));
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  useEffect(() => {
    setDraft(quote);
    latestDraftRef.current = quote;
    lastSavedRef.current = JSON.stringify(quote);
  }, [quote.id]);
  useEffect(() => {
    latestDraftRef.current = draft;
    const serialized = JSON.stringify(draft);
    if (serialized === lastSavedRef.current) return;
    const timer = setTimeout(() => {
      onSaveRef.current(draft);
      lastSavedRef.current = serialized;
    }, 600);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(
    () => () => {
      const serialized = JSON.stringify(latestDraftRef.current);
      if (serialized !== lastSavedRef.current) onSaveRef.current(latestDraftRef.current);
    },
    []
  );

  const customer = customers.find((item) => item.id === draft.customerId);

  const setForm = (field: keyof QuoteRecord["form"], value: string) => setDraft({ ...draft, form: { ...draft.form, [field]: value } });
  const updateItem = (id: string, patch: Partial<QuoteRecord["items"][number]>) =>
    setDraft({ ...draft, items: draft.items.map((row) => (row.id === id ? { ...row, ...patch } : row)) });

  const handleLogoFile = (file?: File) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      window.alert("PNG, JPG, WEBP 등 이미지 파일만 로고로 등록할 수 있습니다.");
      return;
    }
    if (file.size > 1024 * 1024) {
      window.alert("로고 파일은 1MB 이하로 등록해 주세요.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => window.alert("로고 파일을 읽지 못했습니다. 다른 이미지로 다시 시도해 주세요.");
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const image = new Image();
      image.onload = () => onLogoChange(reader.result as string);
      image.onerror = () => window.alert("올바른 이미지 파일인지 확인해 주세요.");
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const applyCustomerPreference = (customerId: string) => {
    const selected = customers.find((item) => item.id === customerId);
    const customerSnapshot: CustomerSnapshot | undefined = selected
      ? {
          name: selected.name,
          businessNumber: selected.businessNumber,
          representativeName: selected.representativeName,
          address: selected.address,
          contactPerson: selected.contactPerson,
          contact: selected.contact,
          email: selected.email,
          taxExempt: selected.taxExempt
        }
      : undefined;
    setDraft({
      ...draft,
      customerId: customerId || undefined,
      customerSnapshot,
      invoiceIssuanceMode: selected?.invoicePreference === "tax_invoice_manual" ? "manual" : "auto",
      invoiceType: {
        issueInvoice: selected?.invoicePreference !== "cash_receipt",
        issueCashReceipt: selected?.invoicePreference === "cash_receipt"
      }
    });
  };

  const updateCustomerSnapshot = (patch: Partial<CustomerSnapshot>) => {
    if (!draft.customerSnapshot) return;
    setDraft({ ...draft, customerSnapshot: { ...draft.customerSnapshot, ...patch } });
  };

  const saveNow = () => {
    latestDraftRef.current = draft;
    lastSavedRef.current = JSON.stringify(draft);
    onSave(draft);
  };

  const approveNow = () => {
    // Approval persists this exact draft. Marking it saved prevents unmount cleanup
    // from overwriting the approved record with the pre-approval draft.
    latestDraftRef.current = draft;
    lastSavedRef.current = JSON.stringify(draft);
    onApprove(draft);
  };

  const categorySuggestions = [...new Set(itemSuggestions.map((item) => item.category))];
  const descriptionSuggestions = [...new Set(itemSuggestions.map((item) => item.description))];

  return (
    <section className="split">
      <div className="panel editor">
        <div className="toolbar">
          <span>로고</span>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(event) => {
              handleLogoFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {logo && <img src={logo} alt="로고 미리보기" style={{ height: 28, maxWidth: 120, objectFit: "contain" }} />}
          <button className="ghost" onClick={() => logoInputRef.current?.click()}>
            로고 업로드
          </button>
          {logo && (
            <button className="ghost" onClick={() => onLogoChange(undefined)}>
              삭제
            </button>
          )}
        </div>
        <SectionTitle title="입력" hint="입력 내용은 자동 저장됩니다. 고객 기본값은 추천값이며 이번 건에서 수정할 수 있습니다." />
        <label>
          고객
          <select value={draft.customerId ?? ""} onChange={(event) => applyCustomerPreference(event.target.value)}>
            <option value="">고객 선택</option>
            {customers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {invoiceLabels[item.invoicePreference]}
              </option>
            ))}
          </select>
        </label>
        {customer && (
          <div className="notice">
            <strong>{customer.name}</strong>
            <span>{customer.businessNumber || "사업자번호 없음"} · {customer.contactPerson} · {customer.contact}</span>
            <button
              className="link"
              onClick={() =>
                onCustomerUpdate({
                  ...customer,
                  invoicePreference: draft.invoiceIssuanceMode === "manual" ? "tax_invoice_manual" : "tax_invoice_auto",
                  updatedAt: new Date().toISOString()
                })
              }
            >
              현재 발행방식을 고객 기본값으로 저장
            </button>
          </div>
        )}
        {draft.customerSnapshot && (
          <details className="customer-snapshot">
            <summary>이번 견적의 고객 정보</summary>
            <p className="muted">여기서 수정한 내용은 고객 원본이 아닌 이번 견적과 발행 정보에만 적용됩니다.</p>
            <div className="grid two">
              <Input label="상호" value={draft.customerSnapshot.name} onChange={(value) => updateCustomerSnapshot({ name: value })} />
              <Input label="사업자번호" value={draft.customerSnapshot.businessNumber ?? ""} inputMode="numeric" maxLength={12} format={formatBusinessNumber} onChange={(value) => updateCustomerSnapshot({ businessNumber: value })} />
              <Input label="대표자" value={draft.customerSnapshot.representativeName ?? ""} onChange={(value) => updateCustomerSnapshot({ representativeName: value })} />
              <Input label="담당자" value={draft.customerSnapshot.contactPerson} onChange={(value) => updateCustomerSnapshot({ contactPerson: value })} />
              <Input label="연락처" type="tel" value={draft.customerSnapshot.contact} inputMode="tel" maxLength={16} autoComplete="tel" format={formatPhoneNumber} onChange={(value) => updateCustomerSnapshot({ contact: value })} />
              <Input label="이메일" type="email" value={draft.customerSnapshot.email ?? ""} autoComplete="email" onChange={(value) => updateCustomerSnapshot({ email: value })} />
            </div>
            <AddressInput value={draft.customerSnapshot.address ?? ""} onChange={(value) => updateCustomerSnapshot({ address: value })} />
          </details>
        )}
        <div className="grid two">
          <Input label="견적일" type="date" value={draft.form.quoteDate} placeholder="2026-05-18" onChange={(value) => setForm("quoteDate", value)} />
          <Input label="유효기간" value={draft.form.validDuration} placeholder="견적일로부터 14일" onChange={(value) => setForm("validDuration", value)} />
          <Input label="공급자" value={draft.form.issuerName} placeholder="블링까미 스튜디오" onChange={(value) => setForm("issuerName", value)} />
          <Input label="프로젝트명" value={draft.form.projectName} placeholder="예: 신제품 상세페이지 제작" onChange={(value) => setForm("projectName", value)} />
          <Input label="납품 형식" value={draft.form.deliveryFormat} placeholder="PDF, JPG, 원본 파일" onChange={(value) => setForm("deliveryFormat", value)} />
          <Input label="납품 일정" value={draft.form.deliverySchedule} placeholder="착수 후 7영업일 이내" onChange={(value) => setForm("deliverySchedule", value)} />
        </div>

        <SectionTitle title="작업 항목" hint="최소 1개 항목은 유지됩니다." />
        <div className="items">
          <datalist id="quote-category-suggestions">{categorySuggestions.map((category) => <option key={`category-${category}`} value={category} />)}</datalist>
          <datalist id="quote-description-suggestions">{descriptionSuggestions.map((description) => <option key={`description-${description}`} value={description} />)}</datalist>
          <div className="item-head" aria-hidden="true">
            <span>구분</span>
            <span>내용</span>
            <span>금액(원)</span>
            <span />
          </div>
          {draft.items.map((item, index) => (
            <div className="item-row" key={item.id}>
              <input aria-label={`항목 ${index + 1} 구분`} list="quote-category-suggestions" placeholder="구분" value={item.category} onChange={(event) => updateItem(item.id, { category: event.target.value })} />
              <input aria-label={`항목 ${index + 1} 내용`} list="quote-description-suggestions" placeholder="내용" value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} />
              <input aria-label={`항목 ${index + 1} 금액`} placeholder="금액(원)" inputMode="numeric" type="number" min="0" value={item.price || ""} onChange={(event) => updateItem(item.id, { price: Number(event.target.value) })} />
              <button
                className="icon"
                title="항목 삭제"
                aria-label={`항목 ${index + 1} 삭제`}
                disabled={draft.items.length === 1}
                onClick={() => setDraft({ ...draft, items: draft.items.filter((_, rowIndex) => rowIndex !== index) })}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <button className="ghost" onClick={() => setDraft({ ...draft, items: [...draft.items, { id: uid("item"), category: "", description: "", price: 0 }] })}>
          <Plus size={17} /> 항목 추가
        </button>

        <div className="grid two">
          <Input label="최종 구성 구분" value={draft.form.finalCategory} placeholder="최종 풀구성" onChange={(value) => setForm("finalCategory", value)} />
          <Input label="최종 구성 내용" value={draft.form.finalDescription} placeholder="기획 + 디자인 + 원본 파일" onChange={(value) => setForm("finalDescription", value)} />
        </div>
        <TextArea label="유의사항" value={draft.form.notes} placeholder="수정 횟수, 추가 비용, 납품 조건" onChange={(value) => setForm("notes", value)} />
        <TextArea label="전달 메시지" value={draft.form.message} placeholder="고객에게 전달할 말씀" onChange={(value) => setForm("message", value)} />
        <div className="grid two">
          <Input label="마무리 문구" value={draft.form.signOffSender} placeholder="블링까미 스튜디오 드림" onChange={(value) => setForm("signOffSender", value)} />
          <Input label="마무리 날짜" type="date" value={draft.form.signOffDate} onChange={(value) => setForm("signOffDate", value)} />
        </div>

        <SectionTitle title="발행·정산 옵션" hint="자동 발행은 Popbill 연동 지점까지 상태를 추적합니다." />
        <div className="segmented">
          <button className={draft.invoiceIssuanceMode === "auto" ? "selected" : ""} onClick={() => setDraft({ ...draft, invoiceIssuanceMode: "auto" })}>
            자동 발행
          </button>
          <button className={draft.invoiceIssuanceMode === "manual" ? "selected" : ""} onClick={() => setDraft({ ...draft, invoiceIssuanceMode: "manual" })}>
            수동 발행
          </button>
        </div>
        <label className="check">
          <input type="checkbox" checked={draft.invoiceType.issueInvoice} onChange={(event) => setDraft({ ...draft, invoiceType: { ...draft.invoiceType, issueInvoice: event.target.checked } })} />
          세금계산서 발행
        </label>
        <label className="check">
          <input type="checkbox" checked={draft.invoiceType.issueCashReceipt} onChange={(event) => setDraft({ ...draft, invoiceType: { ...draft.invoiceType, issueCashReceipt: event.target.checked } })} />
          현금영수증 발행
        </label>
        <div className="document-memo-grid">
          <TextArea label="거래명세서 비고" value={draft.transactionStatementMemo ?? ""} maxLength={150} placeholder="거래명세서에 표시할 비고를 입력해 주세요." onChange={(transactionStatementMemo) => setDraft({ ...draft, transactionStatementMemo })} />
          <TextArea label="세금계산서 비고" value={draft.taxInvoiceMemo ?? ""} maxLength={150} placeholder="세금계산서 비고란에 표시할 내용을 입력해 주세요." onChange={(taxInvoiceMemo) => setDraft({ ...draft, taxInvoiceMemo })} />
        </div>

        <div className="sticky-actions">
          <button className="ghost" onClick={saveNow}>
            <Save size={17} /> 저장
          </button>
          <button disabled={isApproving} onClick={approveNow}>
            <CheckCircle2 size={17} /> {isApproving ? "처리 중" : "승인·발행"}
          </button>
        </div>
      </div>
      <QuotePreview quote={draft} customer={customer} logo={logo} workspaceProfile={workspaceProfile} />
    </section>
  );
}
