import {
  clearPopbillSessionCookie,
  hasValidDirectAccessToken,
  isAccessTokenConfigured,
  popbillSessionCookie,
  rejectPopbillAccess
} from "./auth.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "DELETE") {
    response.setHeader("Set-Cookie", clearPopbillSessionCookie());
    response.status(200).json({ ok: true, configured: false, message: "이 브라우저의 팝빌 연결을 해제했습니다." });
    return;
  }
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }
  if (!isAccessTokenConfigured()) {
    rejectPopbillAccess(response, 503);
    return;
  }

  let body = request.body || {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  if (!hasValidDirectAccessToken(body.accessToken)) {
    rejectPopbillAccess(response);
    return;
  }

  response.setHeader("Set-Cookie", popbillSessionCookie());
  response.status(200).json({
    ok: true,
    configured: true,
    message: "이 브라우저에 팝빌 연결을 안전하게 저장했습니다. 보안키를 다시 입력하지 않아도 됩니다."
  });
}
