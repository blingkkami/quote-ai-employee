import Anthropic from "@anthropic-ai/sdk";

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    projectName: { type: "string", description: "프로젝트명" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", description: "구분 예: 기획/디자인" },
          description: { type: "string", description: "작업 내용" },
          price: { type: "integer", description: "공급가(원), VAT 제외" }
        },
        required: ["category", "description", "price"],
        additionalProperties: false
      }
    },
    deliveryFormat: { type: "string" },
    deliverySchedule: { type: "string" },
    finalCategory: { type: "string" },
    finalDescription: { type: "string" },
    notes: { type: "string" },
    message: { type: "string" }
  },
  required: [
    "projectName",
    "items",
    "deliveryFormat",
    "deliverySchedule",
    "finalCategory",
    "finalDescription",
    "notes",
    "message"
  ],
  additionalProperties: false
};

const GEMINI_DRAFT_SCHEMA = {
  type: "OBJECT",
  properties: {
    projectName: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          category: { type: "STRING" },
          description: { type: "STRING" },
          price: { type: "INTEGER" }
        },
        required: ["category", "description", "price"]
      }
    },
    deliveryFormat: { type: "STRING" },
    deliverySchedule: { type: "STRING" },
    finalCategory: { type: "STRING" },
    finalDescription: { type: "STRING" },
    notes: { type: "STRING" },
    message: { type: "STRING" }
  },
  required: [
    "projectName",
    "items",
    "deliveryFormat",
    "deliverySchedule",
    "finalCategory",
    "finalDescription",
    "notes",
    "message"
  ]
};

const GEMINI_MODEL = "gemini-flash-latest";

const SYSTEM_PROMPT = `당신은 1인 디자인·AI 비주얼 스튜디오 "블링까미 스튜디오"의 견적서 작성 직원입니다. 사용자의 의뢰 설명을 바탕으로 견적서 초안을 JSON으로 작성합니다.

규칙:
- 작업 항목은 2~5개로 나눕니다.
- 금액은 공급가(VAT 별도) 기준의 현실적인 원화 금액(만원 단위)으로 제안합니다.
- 상세페이지/썸네일/AI 제품컷/브랜딩 등 스튜디오 작업 범위에 맞게 작성합니다.
- notes에는 수정 범위·추가 비용 관련 유의사항을 씁니다.
- message에는 고객에게 보내는 짧은 인사 메시지를 씁니다.`;

async function generateWithGemini(userText, response) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const geminiResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_DRAFT_SCHEMA
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      let extracted;
      try {
        const errorJson = JSON.parse(errorText);
        extracted = errorJson?.error?.message;
      } catch {
        extracted = undefined;
      }
      response.status(200).json({
        ok: false,
        message: `Gemini 오류: ${extracted || `HTTP ${geminiResponse.status}`}`
      });
      return;
    }

    const data = await geminiResponse.json();
    const draftText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!draftText) {
      response.status(200).json({ ok: false, message: "초안을 생성하지 못했습니다." });
      return;
    }

    let draft;
    try {
      draft = JSON.parse(draftText);
    } catch {
      response.status(200).json({ ok: false, message: "초안 형식을 해석하지 못했습니다." });
      return;
    }

    response.status(200).json({ ok: true, draft, engine: "gemini" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    response.status(200).json({ ok: false, message });
  }
}

async function generateWithAnthropic(userText, response) {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

  try {
    const response2 = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: DRAFT_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }]
    });

    if (response2.stop_reason === "refusal") {
      response.status(200).json({ ok: false, message: "요청을 처리할 수 없습니다." });
      return;
    }

    const textBlock = (response2.content || []).find((block) => block.type === "text");
    if (!textBlock) {
      response.status(200).json({ ok: false, message: "초안을 생성하지 못했습니다." });
      return;
    }

    let draft;
    try {
      draft = JSON.parse(textBlock.text);
    } catch {
      response.status(200).json({ ok: false, message: "초안 형식을 해석하지 못했습니다." });
      return;
    }

    response.status(200).json({ ok: true, draft });
  } catch (error) {
    let message;
    if (error instanceof Anthropic.APIError) {
      message = error.message;
    } else {
      message = error instanceof Error ? error.message : String(error);
    }
    response.status(200).json({ ok: false, message });
  }
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }

  try {
    let body = request.body || {};
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { brief, customerName } = body;

    if (typeof brief !== "string" || brief.trim() === "") {
      response.status(400).json({ ok: false, message: "요청 내용을 입력해 주세요." });
      return;
    }

    let userText = brief.trim();
    if (typeof customerName === "string" && customerName.trim() !== "") {
      userText += `\n고객사: ${customerName.trim()}`;
    }

    if (process.env.GEMINI_API_KEY) {
      await generateWithGemini(userText, response);
      return;
    }

    if (process.env.ANTHROPIC_API_KEY) {
      await generateWithAnthropic(userText, response);
      return;
    }

    response.status(200).json({
      ok: false,
      message:
        "AI 키가 설정되지 않았습니다. 무료 Gemini 키를 https://aistudio.google.com/apikey 에서 발급해 .env의 GEMINI_API_KEY에 넣어 주세요."
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
