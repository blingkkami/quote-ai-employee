import { createClient } from "@supabase/supabase-js";

const headerValue = (request, name) => {
  const headers = request?.headers;
  if (!headers) return "";
  if (typeof headers.get === "function") return String(headers.get(name) || "");
  return String(headers[name.toLowerCase()] || headers[name] || "");
};

const reject = (response, status, message) => {
  response.status(status).json({ ok: false, configured: false, invoiceStatus: "pending", message });
  return null;
};

export async function authorizeRequest(request, response) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return reject(response, 503, "로그인 서버 설정이 완료되지 않았습니다.");
  }

  const authorization = headerValue(request, "authorization");
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return reject(response, 401, "로그인 후 다시 시도해 주세요.");

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return reject(response, 401, "로그인 정보가 만료되었습니다. 다시 로그인해 주세요.");

  const admin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  }) : null;
  return { user: data.user, client: authClient, admin };
}

export async function getUserConnection(admin, userId) {
  const { data, error } = await admin
    .from("popbill_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`팝빌 연결정보를 확인하지 못했습니다. ${error.message}`);
  return data;
}

export async function getConnectionByCorpNum(admin, corpNum) {
  const { data, error } = await admin
    .from("popbill_connections")
    .select("user_id, corp_num")
    .eq("corp_num", corpNum)
    .maybeSingle();
  if (error) throw new Error(`사업자 연결정보를 확인하지 못했습니다. ${error.message}`);
  return data;
}

export async function saveUserConnection(admin, userId, connection) {
  const { error } = await admin.from("popbill_connections").upsert({
    user_id: userId,
    ...connection,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id" });
  if (error) throw new Error(`팝빌 연결정보를 저장하지 못했습니다. ${error.message}`);
}

export async function removeUserConnection(admin, userId) {
  const { error } = await admin.from("popbill_connections").delete().eq("user_id", userId);
  if (error) throw new Error(`팝빌 연결을 해제하지 못했습니다. ${error.message}`);
}
