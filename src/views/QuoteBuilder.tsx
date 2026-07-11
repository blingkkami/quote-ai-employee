import { useEffect, useState } from "react";
import { CheckCircle2, Plus, Save, Trash2, Wand2 } from "lucide-react";
import type { Customer, QuoteRecord } from "../types";
import { uid } from "../lib/id";
import { requestQuoteDraft } from "../lib/ai-draft";
import { invoiceLabels } from "../constants";
import { SectionTitle } from "../components/SectionTitle";
import { Input } from "../components/Input";
import { TextArea } from "../components/TextArea";
import { QuotePreview } from "./QuotePreview";

const AI_DRAFT_ENABLED = true; // false로 바꾸면 AI 견적 초안 기능이 숨겨집니다

export function QuoteBuilder({
  quote,
  customers,
  onSave,
  onApprove,
  onCustomerUpdate
}: {
  quote: QuoteRecord;
  customers: Customer[];
  onSave: (quote: QuoteRecord) => void;
  onApprove: (quote: QuoteRecord) => void;
  onCustomerUpdate: (customer: Customer) => void;
}) {
  const [draft, setDraft] = useState(quote);
  const [aiBrief, setAiBrief] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  useEffect(() => setDraft(quote), [quote.id]);

  const customer = customers.find((item) => item.id === draft.customerId);

  const generateDraft = async () => {
    setAiLoading(true);
    const result = await requestQuoteDraft(aiBrief.trim(), customer?.name);
    if (result.ok && result.draft) {
      const d = result.draft;
      setAiError(result.fallback ? result.message || "AI 연동 전 기본 초안을 적용했습니다." : "");
      setDraft({
        ...draft,
        form: {
          ...draft.form,
          projectName: d.projectName,
          deliveryFormat: d.deliveryFormat,
          deliverySchedule: d.deliverySchedule,
          finalCategory: d.finalCategory,
          finalDescription: d.finalDescription,
          notes: d.notes,
          message: d.message
        },
        items: d.items.length
          ? d.items.map((i) => ({ id: uid("item"), category: i.category, description: i.description, price: i.price }))
          : draft.items
      });
    } else {
      setAiError(result.message || "AI 초안 생성에 실패했습니다.");
    }
    setAiLoading(false);
  };
  const setForm = (field: keyof QuoteRecord["form"], value: string) => setDraft({ ...draft, form: { ...draft.form, [field]: value } });
  const updateItem = (id: string, patch: Partial<QuoteRecord["items"][number]>) =>
    setDraft({ ...draft, items: draft.items.map((row) => (row.id === id ? { ...row, ...patch } : row)) });

  const applyCustomerPreference = (customerId: string) => {
    const selected = customers.find((item) => item.id === customerId);
    setDraft({
      ...draft,
      customerId,
      invoiceIssuanceMode: selected?.invoicePreference === "tax_invoice_manual" ? "manual" : "auto",
      invoiceType: {
        issueInvoice: selected?.invoicePreference !== "cash_receipt",
        issueCashReceipt: selected?.invoicePreference === "cash_receipt"
      }
    });
  };

  return (
    <section className="split">
      <div className="panel editor">
        {AI_DRAFT_ENABLED && (
          <>
            <SectionTitle title="AI 견적 초안" hint="의뢰 내용을 한두 문장으로 적으면 항목과 금액 초안을 채워줍니다." />
            <TextArea label="의뢰 내용" value={aiBrief} onChange={setAiBrief} />
            <button className="ghost" disabled={aiLoading || aiBrief.trim() === ""} onClick={generateDraft}>
              <Wand2 size={17} /> {aiLoading ? "생성 중…" : "AI 초안 생성"}
            </button>
            {aiError && <p className="ai-error">{aiError}</p>}
          </>
        )}

        <SectionTitle title="입력" hint="고객 기본값은 추천값이며 이번 건에서 수정할 수 있습니다." />
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
          {draft.items.map((item, index) => (
            <div className="item-row" key={item.id}>
              <input placeholder="구분" value={item.category} onChange={(event) => updateItem(item.id, { category: event.target.value })} />
              <input placeholder="내용" value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} />
              <input type="number" min="0" value={item.price || ""} onChange={(event) => updateItem(item.id, { price: Number(event.target.value) })} />
              <button
                className="icon"
                title="항목 삭제"
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

        <div className="sticky-actions">
          <button className="ghost" onClick={() => onSave(draft)}>
            <Save size={17} /> 저장
          </button>
          <button onClick={() => onApprove(draft)}>
            <CheckCircle2 size={17} /> 승인·발행
          </button>
        </div>
      </div>
      <QuotePreview quote={draft} customer={customer} />
    </section>
  );
}
