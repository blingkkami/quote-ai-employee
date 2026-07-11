export type QuoteDraftItem = {
  category: string;
  description: string;
  price: number;
};

export type QuoteDraft = {
  projectName: string;
  items: QuoteDraftItem[];
  deliveryFormat: string;
  deliverySchedule: string;
  finalCategory: string;
  finalDescription: string;
  notes: string;
  message: string;
};

export type QuoteDraftResult = {
  ok: boolean;
  draft?: QuoteDraft;
  message?: string;
  fallback?: boolean;
};

function localDraft(brief: string, customerName?: string): QuoteDraft {
  const title = brief.trim().slice(0, 32) || `${customerName || "고객"} 의뢰 작업`;
  const hasImage = /이미지|비주얼|컷|촬영/.test(brief);
  const hasPage = /상세페이지|페이지|웹|배너/.test(brief);
  const items = [
    { category: hasPage ? "기획/디자인" : "기본 작업", description: brief.trim() || "의뢰 내용 정리 및 기본 작업", price: hasPage ? 900000 : 500000 },
    ...(hasImage ? [{ category: "AI 비주얼", description: "제품 이미지 제작 및 보정", price: 400000 }] : []),
    ...(hasPage ? [{ category: "최종 산출물", description: "웹용 이미지 및 원본 파일 정리", price: 250000 }] : [])
  ];
  return {
    projectName: title,
    items,
    deliveryFormat: "PDF, JPG, 원본 파일",
    deliverySchedule: "착수 후 7영업일 이내",
    finalCategory: "최종 산출물",
    finalDescription: "기획·디자인 결과물과 수정 가능한 원본 파일",
    notes: "수정 범위와 추가 비용은 작업 확정 후 별도 협의합니다.",
    message: "의뢰 내용을 기준으로 작성한 초안입니다. 금액과 작업 범위를 확인해 주세요."
  };
}

export async function requestQuoteDraft(brief: string, customerName?: string): Promise<QuoteDraftResult> {
  try {
    const response = await fetch("/api/ai/draft-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief, customerName })
    });

    const result = (await response.json()) as QuoteDraftResult;

    if (!response.ok || !result?.ok) {
      return {
        ok: true,
        fallback: true,
        draft: localDraft(brief, customerName),
        message: result?.message || `기본 초안을 작성했습니다. (HTTP ${response.status})`
      };
    }

    return result;
  } catch (error) {
    return {
      ok: true,
      fallback: true,
      draft: localDraft(brief, customerName),
      message: "AI 서버에 연결되지 않아 기본 초안을 작성했습니다."
    };
  }
}
