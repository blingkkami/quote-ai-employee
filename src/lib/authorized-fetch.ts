import { requireSupabase } from "./supabase";

export async function authorizedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data, error } = await requireSupabase().auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("로그인 정보가 만료되었습니다. 다시 로그인해 주세요.");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}
