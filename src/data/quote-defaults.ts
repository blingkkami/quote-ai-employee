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

export const exampleQuoteForm = {
  quoteDate: "2026-05-18",
  validDuration: "견적일로부터 14일 (2026년 6월 1일 총 유효)",
  issuerName: "블링까미 스튜디오",
  projectName: "루미너스 에센스 AI 상세페이지 기획 및 제작",
  deliveryFormat: "PSD 및 가이드 라인 파일 (인쇄/웹용)",
  deliverySchedule: "착수 후 7영업일 이내",
  finalCategory: "최종 풀구성",
  finalDescription: "기획 + AI 비주얼 디렉팅 + 상세페이지 디자인 전체 + 원본 PSD 제공",
  notes: "선택 진행 안내: 기본안만 진행하실 경우 150,000원이며, 옵션은 필요한 항목만 골라 선택이 가능합니다.\n수정 횟수: 무상 수정은 항목별 기본 2회까지 포함됩니다.\n최종 납품: 최종 확정된 파일은 웹 업로드용 고화질 이미지와 수정 가능한 원본 파일로 제공됩니다.",
  message: "안녕하세요, 대표님. 보내주신 제품 컨셉과 레퍼런스를 꼼꼼히 검토한 후 제안드리는 견적서입니다.\n조율이 필요하시거나 내부 예산안이 따로 있으시다면 편하게 말씀해 주세요.",
  signOffSender: "블링까미 스튜디오 드림",
  signOffDate: "2026년 5월 18일"
};

export const exampleQuoteItems = [
  { id: "example-base", category: "기본안", description: "제공된 기획안 기반 상세페이지 디자인 레이아웃 및 텍스트 배치", price: 150000 },
  { id: "example-option-1", category: "옵션 1", description: "AI 맞춤형 비주얼 이미지 생성 및 합성 디렉팅 (메인 히어로 컷 포함)", price: 100000 },
  { id: "example-option-2", category: "옵션 2", description: "마케팅 소구점 발굴 및 카피라이팅, 전반적인 기획 단계 추가", price: 100000 }
];

export const emptyQuote = (): QuoteRecord => ({
  id: uid("quo"),
  status: "draft",
  paymentStatus: "unpaid",
  form: {
    quoteDate: "",
    validDuration: "",
    issuerName: "",
    projectName: "",
    deliveryFormat: "",
    deliverySchedule: "",
    finalCategory: "",
    finalDescription: "",
    notes: "",
    message: "",
    signOffSender: "",
    signOffDate: ""
  },
  items: [{ id: uid("item"), category: "", description: "", price: 0 }],
  invoiceIssuanceMode: "auto",
  invoiceType: { issueInvoice: true, issueCashReceipt: false },
  invoiceStatus: "pending",
  createdAt: now(),
  updatedAt: now()
});
