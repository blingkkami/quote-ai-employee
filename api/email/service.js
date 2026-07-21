import crypto from "node:crypto";
import dns from "node:dns/promises";
import { isIP } from "node:net";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const EMAIL_TABLE = "email_connections";
const OAUTH_STATE_TABLE = "email_oauth_states";
const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.send"];
const MICROSOFT_SCOPES = ["openid", "profile", "email", "offline_access", "User.Read", "Mail.Send"];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();
const base64Url = (value) => Buffer.from(value).toString("base64url");

function encryptionKey() {
  const raw = String(process.env.EMAIL_TOKEN_ENCRYPTION_KEY || "").trim();
  if (!raw) throw new Error("메일 연결 암호화 키가 설정되지 않았습니다.");
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("EMAIL_TOKEN_ENCRYPTION_KEY는 32바이트 키여야 합니다.");
  return key;
}

export function encryptCredentials(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptCredentials(value) {
  const [version, ivValue, tagValue, encryptedValue] = String(value || "").split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) throw new Error("저장된 메일 연결정보 형식이 올바르지 않습니다.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const plain = Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]);
  return JSON.parse(plain.toString("utf8"));
}

export function requireEmailAdmin(auth) {
  if (!auth.admin) throw new Error("서버의 사용자별 메일 보안 저장소가 아직 설정되지 않았습니다.");
  return auth.admin;
}

export function createEmailAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("서버의 사용자별 메일 보안 저장소가 아직 설정되지 않았습니다.");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

export async function getEmailConnection(admin, userId) {
  const { data, error } = await admin.from(EMAIL_TABLE).select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`메일 연결정보를 확인하지 못했습니다. ${error.message}`);
  return data;
}

export async function saveEmailConnection(admin, userId, connection) {
  const { error } = await admin.from(EMAIL_TABLE).upsert({
    user_id: userId,
    provider: connection.provider,
    email: normalizeEmail(connection.email),
    display_name: String(connection.displayName || "").replace(/[\r\n]/g, " ").trim().slice(0, 120),
    credentials_encrypted: encryptCredentials(connection.credentials),
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id" });
  if (error) throw new Error(`메일 연결정보를 저장하지 못했습니다. ${error.message}`);
}

export async function removeEmailConnection(admin, userId) {
  const { error } = await admin.from(EMAIL_TABLE).delete().eq("user_id", userId);
  if (error) throw new Error(`메일 연결을 해제하지 못했습니다. ${error.message}`);
}

export async function revokeEmailConnection(admin, userId) {
  const connection = await getEmailConnection(admin, userId);
  if (connection?.provider === "google") {
    try {
      const credentials = decryptCredentials(connection.credentials_encrypted);
      const token = credentials.refreshToken || credentials.accessToken;
      if (token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });
      }
    } catch {
      // 서버 저장정보 삭제를 우선하며 외부 철회 실패는 다시 연결해도 영향을 주지 않습니다.
    }
  }
  await removeEmailConnection(admin, userId);
}

export async function createOAuthState(admin, userId, provider) {
  const state = crypto.randomBytes(32).toString("base64url");
  const stateHash = crypto.createHash("sha256").update(state).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await admin.from(OAUTH_STATE_TABLE).delete().eq("user_id", userId).eq("provider", provider);
  const { error } = await admin.from(OAUTH_STATE_TABLE).insert({ state_hash: stateHash, user_id: userId, provider, expires_at: expiresAt });
  if (error) throw new Error(`메일 연결 요청을 시작하지 못했습니다. ${error.message}`);
  return state;
}

export async function consumeOAuthState(admin, state, provider) {
  const stateHash = crypto.createHash("sha256").update(String(state || "")).digest("hex");
  const { data, error } = await admin.from(OAUTH_STATE_TABLE).select("*").eq("state_hash", stateHash).eq("provider", provider).maybeSingle();
  if (error || !data) throw new Error("메일 연결 요청이 만료되었거나 올바르지 않습니다.");
  await admin.from(OAUTH_STATE_TABLE).delete().eq("state_hash", stateHash);
  if (new Date(data.expires_at).getTime() < Date.now()) throw new Error("메일 연결 시간이 초과되었습니다. 설정에서 다시 시작해 주세요.");
  return data.user_id;
}

export function oauthAuthorizationUrl(provider, state) {
  if (provider === "google") {
    const clientId = process.env.GOOGLE_EMAIL_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_EMAIL_REDIRECT_URI;
    if (!clientId || !process.env.GOOGLE_EMAIL_CLIENT_SECRET || !redirectUri) throw new Error("Google 메일 연결 서버가 아직 설정되지 않았습니다.");
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }
  if (provider === "microsoft") {
    const clientId = process.env.MICROSOFT_EMAIL_CLIENT_ID;
    const redirectUri = process.env.MICROSOFT_EMAIL_REDIRECT_URI;
    if (!clientId || !process.env.MICROSOFT_EMAIL_CLIENT_SECRET || !redirectUri) throw new Error("Microsoft 메일 연결 서버가 아직 설정되지 않았습니다.");
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      response_mode: "query",
      scope: MICROSOFT_SCOPES.join(" "),
      state
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
  }
  throw new Error("지원하지 않는 메일 서비스입니다.");
}

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok) {
    const message = body.error_description || body.error?.message || body.message || `HTTP ${response.status}`;
    throw new Error(String(message));
  }
  return { response, body };
}

export async function exchangeOAuthCode(provider, code) {
  if (provider === "google") {
    const { body: token } = await jsonRequest("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_EMAIL_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_EMAIL_CLIENT_SECRET || "",
        redirect_uri: process.env.GOOGLE_EMAIL_REDIRECT_URI || "",
        grant_type: "authorization_code"
      })
    });
    const { body: profile } = await jsonRequest("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    return {
      provider,
      email: normalizeEmail(profile.email),
      displayName: profile.name || "",
      credentials: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
        scope: token.scope || GOOGLE_SCOPES.join(" ")
      }
    };
  }

  if (provider === "microsoft") {
    const { body: token } = await jsonRequest("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.MICROSOFT_EMAIL_CLIENT_ID || "",
        client_secret: process.env.MICROSOFT_EMAIL_CLIENT_SECRET || "",
        redirect_uri: process.env.MICROSOFT_EMAIL_REDIRECT_URI || "",
        grant_type: "authorization_code",
        scope: MICROSOFT_SCOPES.join(" ")
      })
    });
    const { body: profile } = await jsonRequest("https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName", {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    return {
      provider,
      email: normalizeEmail(profile.mail || profile.userPrincipalName),
      displayName: profile.displayName || "",
      credentials: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
        scope: token.scope || MICROSOFT_SCOPES.join(" ")
      }
    };
  }
  throw new Error("지원하지 않는 메일 서비스입니다.");
}

async function refreshOAuthConnection(admin, connection, credentials) {
  if (Number(credentials.expiresAt || 0) > Date.now() + 60_000) return credentials;
  if (!credentials.refreshToken) throw new Error("메일 연결이 만료되었습니다. 설정에서 다시 연결해 주세요.");
  const provider = connection.provider;
  const tokenUrl = provider === "google"
    ? "https://oauth2.googleapis.com/token"
    : "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  const clientId = provider === "google" ? process.env.GOOGLE_EMAIL_CLIENT_ID : process.env.MICROSOFT_EMAIL_CLIENT_ID;
  const clientSecret = provider === "google" ? process.env.GOOGLE_EMAIL_CLIENT_SECRET : process.env.MICROSOFT_EMAIL_CLIENT_SECRET;
  const params = new URLSearchParams({
    client_id: clientId || "",
    client_secret: clientSecret || "",
    refresh_token: credentials.refreshToken,
    grant_type: "refresh_token"
  });
  if (provider === "microsoft") params.set("scope", credentials.scope || MICROSOFT_SCOPES.join(" "));
  const { body: token } = await jsonRequest(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });
  const next = {
    ...credentials,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || credentials.refreshToken,
    expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
    scope: token.scope || credentials.scope
  };
  const { error } = await admin.from(EMAIL_TABLE).update({ credentials_encrypted: encryptCredentials(next), updated_at: new Date().toISOString() }).eq("user_id", connection.user_id);
  if (error) throw new Error(`갱신된 메일 연결정보를 저장하지 못했습니다. ${error.message}`);
  return next;
}

function isPrivateAddress(address) {
  if (address.includes(":")) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:") && normalized.slice(7).includes(".")) return isPrivateAddress(normalized.slice(7));
    return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
  }
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] >= 224
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19));
}

export async function resolvePublicSmtpHost(host) {
  const normalized = String(host || "").trim().toLowerCase().replace(/\.$/, "");
  if (!normalized || normalized === "localhost" || normalized.endsWith(".local") || isIP(normalized)) {
    throw new Error("외부 접속 가능한 SMTP 서버 주소를 입력해 주세요.");
  }
  const addresses = await dns.lookup(normalized, { all: true, verbatim: true });
  const publicAddress = addresses.find(({ address }) => !isPrivateAddress(address));
  if (!publicAddress || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("보안을 위해 사설 네트워크 SMTP 서버에는 연결할 수 없습니다.");
  }
  return { hostname: normalized, address: publicAddress.address };
}

function smtpTransport(credentials) {
  return resolvePublicSmtpHost(credentials.host).then(({ hostname, address }) => nodemailer.createTransport({
    host: address,
    port: Number(credentials.port),
    secure: Boolean(credentials.secure),
    requireTLS: !credentials.secure,
    auth: { user: credentials.username, pass: credentials.password },
    tls: { servername: hostname, minVersion: "TLSv1.2", rejectUnauthorized: true },
    disableFileAccess: true,
    disableUrlAccess: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000
  }));
}

export async function verifySmtpConnection(input) {
  const provider = input.provider === "naver" ? "naver" : "smtp";
  const fromEmail = normalizeEmail(input.fromEmail || input.username);
  if (!emailPattern.test(fromEmail)) throw new Error("발신 이메일 주소를 확인해 주세요.");
  const host = provider === "naver" ? "smtp.naver.com" : String(input.host || "").trim();
  const port = provider === "naver" ? 587 : Number(input.port);
  const secure = provider === "naver" ? false : Boolean(input.secure);
  if (![465, 587].includes(port)) throw new Error("SMTP 포트는 465 또는 587만 사용할 수 있습니다.");
  const credentials = {
    host,
    port,
    secure: port === 465 ? true : secure,
    username: String(input.username || fromEmail).trim(),
    password: String(input.password || ""),
    fromEmail,
    fromName: String(input.fromName || "").replace(/[\r\n]/g, " ").trim().slice(0, 120)
  };
  if (!credentials.username || !credentials.password) throw new Error("메일 아이디와 비밀번호를 입력해 주세요.");
  const transporter = await smtpTransport(credentials);
  try {
    await transporter.verify();
  } finally {
    transporter.close();
  }
  return { provider, email: fromEmail, displayName: credentials.fromName, credentials };
}

const encodedHeader = (value) => /^[\x20-\x7e]*$/.test(String(value))
  ? String(value)
  : `=?UTF-8?B?${Buffer.from(String(value), "utf8").toString("base64")}?=`;
const wrappedBase64 = (value) => String(value).replace(/\s/g, "").match(/.{1,76}/g)?.join("\r\n") || "";

export function createGoogleMime({ from, fromName, to, subject, html, attachments }) {
  const boundary = `blingbill_${crypto.randomBytes(18).toString("hex")}`;
  const lines = [
    `From: ${fromName ? `${encodedHeader(fromName)} ` : ""}<${from}>`,
    `To: <${to}>`,
    `Subject: ${encodedHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrappedBase64(Buffer.from(html, "utf8").toString("base64"))
  ];
  for (const attachment of attachments) {
    const filename = String(attachment.filename).replace(/[\r\n"]/g, "-");
    lines.push(
      `--${boundary}`,
      `Content-Type: application/pdf; name="${encodedHeader(filename)}"`,
      `Content-Disposition: attachment; filename="${encodedHeader(filename)}"`,
      "Content-Transfer-Encoding: base64",
      "",
      wrappedBase64(attachment.content)
    );
  }
  lines.push(`--${boundary}--`, "");
  return lines.join("\r\n");
}

async function sendGoogle(connection, credentials, message) {
  const raw = base64Url(createGoogleMime({ from: connection.email, fromName: connection.display_name, ...message }));
  const { body } = await jsonRequest("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${credentials.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw })
  });
  return body.id || crypto.randomUUID();
}

async function sendMicrosoft(credentials, message) {
  const { response } = await jsonRequest("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${credentials.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: message.subject,
        body: { contentType: "HTML", content: message.html },
        toRecipients: [{ emailAddress: { address: message.to } }],
        attachments: message.attachments.map((attachment) => ({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: attachment.filename,
          contentType: "application/pdf",
          contentBytes: attachment.content
        }))
      },
      saveToSentItems: true
    })
  });
  return response.headers.get("request-id") || crypto.randomUUID();
}

async function sendSmtp(connection, credentials, message) {
  const transporter = await smtpTransport(credentials);
  const result = await transporter.sendMail({
    from: { name: connection.display_name || credentials.fromName || "", address: connection.email },
    to: message.to,
    subject: message.subject,
    html: message.html,
    attachments: message.attachments.map((attachment) => ({ filename: attachment.filename, content: Buffer.from(attachment.content, "base64"), contentType: "application/pdf" }))
  });
  transporter.close();
  return result.messageId || crypto.randomUUID();
}

export async function sendConnectedEmail(admin, userId, message) {
  const connection = await getEmailConnection(admin, userId);
  if (!connection) throw new Error("설정에서 내 발신메일을 먼저 연결해 주세요.");
  let credentials = decryptCredentials(connection.credentials_encrypted);
  if (connection.provider === "google" || connection.provider === "microsoft") {
    credentials = await refreshOAuthConnection(admin, connection, credentials);
  }
  let emailId;
  if (connection.provider === "google") emailId = await sendGoogle(connection, credentials, message);
  else if (connection.provider === "microsoft") emailId = await sendMicrosoft(credentials, message);
  else if (connection.provider === "naver" || connection.provider === "smtp") emailId = await sendSmtp(connection, credentials, message);
  else throw new Error("지원하지 않는 발신메일 연결입니다.");
  return { emailId, provider: connection.provider, sender: connection.email };
}

export function publicConnection(connection) {
  return connection ? {
    connected: true,
    provider: connection.provider,
    email: connection.email,
    displayName: connection.display_name || "",
    connectedAt: connection.connected_at
  } : { connected: false };
}

export function appRedirectUrl(status, provider, detail = "") {
  const appUrl = String(process.env.APP_URL || "https://quote.blingkkami.com").replace(/\/$/, "");
  const params = new URLSearchParams({ email_connection: status, provider });
  if (detail) params.set("detail", detail.slice(0, 160));
  return `${appUrl}/?${params.toString()}#settings`;
}
