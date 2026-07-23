import crypto from "crypto";

function key() {
  const raw = String(process.env.BILLING_TOKEN_ENCRYPTION_KEY || "").trim();
  if (!raw) throw new Error("BILLING_TOKEN_ENCRYPTION_KEY가 필요합니다.");
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== 32) throw new Error("BILLING_TOKEN_ENCRYPTION_KEY는 base64 32바이트 키여야 합니다.");
  return decoded;
}

export function encryptBillingKey(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptBillingKey(value) {
  const [version, iv, tag, encrypted] = String(value || "").split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("저장된 결제수단 형식이 올바르지 않습니다.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
