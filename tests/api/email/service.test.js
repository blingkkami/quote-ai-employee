import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGoogleMime, decryptCredentials, encryptCredentials } from "../../../server/email/service.js";

const previousKey = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.EMAIL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
  else process.env.EMAIL_TOKEN_ENCRYPTION_KEY = previousKey;
});

describe("email connection security", () => {
  it("encrypts credentials with authenticated encryption", () => {
    const original = { accessToken: "secret-access", refreshToken: "secret-refresh", expiresAt: 1234 };
    const encrypted = encryptCredentials(original);
    expect(encrypted).not.toContain("secret-access");
    expect(decryptCredentials(encrypted)).toEqual(original);
  });

  it("rejects a modified encrypted credential", () => {
    const encrypted = encryptCredentials({ password: "secret" });
    const modified = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;
    expect(() => decryptCredentials(modified)).toThrow();
  });
});

describe("Gmail MIME document", () => {
  it("contains the recipient and both PDF attachments", () => {
    const mime = createGoogleMime({
      from: "owner@example.com",
      fromName: "블링까미",
      to: "client@example.com",
      subject: "견적서 및 거래명세서",
      html: "<p>안녕하세요.</p>",
      attachments: [
        { filename: "견적서.pdf", content: "JVBERi0xLjQK" },
        { filename: "거래명세서.pdf", content: "JVBERi0xLjQK" }
      ]
    });
    expect(mime).toContain("To: <client@example.com>");
    expect(mime.match(/Content-Type: application\/pdf/g)).toHaveLength(2);
    expect(mime).toContain("JVBERi0xLjQK");
  });
});
