export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }

  response.status(200).json({
    ok: true,
    receivedAt: new Date().toISOString(),
    event: request.body || {}
  });
}
