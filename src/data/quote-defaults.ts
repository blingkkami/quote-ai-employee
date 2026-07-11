import type { QuoteRecord } from "../types";
import { uid } from "../lib/id";
import { now, today } from "../lib/date";

export const initialQuoteForm = {
  quoteDate: today(),
  validDuration: "견적일로부터 14일",
  issuerName: "블링까미 스튜디오",
  projectName: "",
  deliveryFormat: "PDF, JPG, 원본 파일",
  deliverySchedule: "결제 확인 후 7영업일",
  finalCategory: "최종 산출물",
  finalDescription: "브랜드/상세페이지/AI 비주얼 작업 최종본",
  notes: "수정 범위와 추가 비용은 작업 확정 후 별도 협의합니다.",
  message: "확인 후 궁금한 점이 있으면 언제든 연락 주세요.",
  signOffSender: "블링까미 스튜디오",
  signOffDate: today()
};

export const emptyQuote = (): QuoteRecord => ({
  id: uid("quo"),
  status: "draft",
  paymentStatus: "unpaid",
  form: { ...initialQuoteForm },
  items: [{ id: uid("item"), category: "", description: "", price: 0 }],
  invoiceIssuanceMode: "auto",
  invoiceType: { issueInvoice: true, issueCashReceipt: false },
  invoiceStatus: "pending",
  createdAt: now(),
  updatedAt: now()
});
