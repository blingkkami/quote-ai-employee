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
};

export async function requestQuoteDraft(brief: string, customerName?: string): Promise<QuoteDraftResult> {
  try {
    const response = await fetch("/api/ai/draft-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief, customerName })
    });

    const result = (await response.json()) as QuoteDraftResult;

    if (!response.ok) {
      return {
        ok: false,
        message: result?.message || `AI 초안 요청 실패 (HTTP ${response.status})`
      };
    }

    return result;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
