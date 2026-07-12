const requiredVariables = ["POPBILL_LINK_ID", "POPBILL_SECRET_KEY", "POPBILL_CORP_NUM"];

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }

  const missing = requiredVariables.filter((name) => !process.env[name]);
  response.status(200).json({
    ok: missing.length === 0,
    configured: missing.length === 0,
    environment: process.env.POPBILL_IS_TEST === "false" ? "production" : "test",
    missing,
    message: missing.length
      ? `Vercel 환경변수 ${missing.join(", ")} 설정이 필요합니다.`
      : "팝빌 서버 인증정보가 등록되어 있습니다."
  });
}
