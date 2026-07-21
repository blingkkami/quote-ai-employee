import { handleOAuthCallback } from "./oauth-callback.js";

export default async function handler(request, response) {
  return handleOAuthCallback("microsoft", request, response);
}

