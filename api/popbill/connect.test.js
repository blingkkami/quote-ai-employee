import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasValidAccessToken, POPBILL_SESSION_COOKIE } from "./auth.js";
import handler from "./connect.js";

const originalToken = process.env.POPBILL_ACCESS_TOKEN;
const makeResponse = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  status(code) { this.statusCode = code; return this; },
  setHeader(name, value) { this.headers[name] = value; return this; },
  json(body) { this.body = body; return this; }
});

beforeEach(() => {
  process.env.POPBILL_ACCESS_TOKEN = "one-time-secret-token";
});

afterEach(() => {
  if (originalToken === undefined) delete process.env.POPBILL_ACCESS_TOKEN;
  else process.env.POPBILL_ACCESS_TOKEN = originalToken;
});

describe("Popbill persistent browser connection", () => {
  it("rejects an incorrect one-time access token", async () => {
    const response = makeResponse();
    await handler({ method: "POST", body: { accessToken: "wrong" } }, response);

    expect(response.statusCode).toBe(401);
    expect(response.headers["Set-Cookie"]).toBeUndefined();
  });

  it("sets a signed HttpOnly cookie without exposing the raw token", async () => {
    const response = makeResponse();
    await handler({ method: "POST", body: { accessToken: "one-time-secret-token" } }, response);

    const setCookie = response.headers["Set-Cookie"];
    expect(response.statusCode).toBe(200);
    expect(setCookie).toContain(`${POPBILL_SESSION_COOKIE}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Max-Age=34560000");
    expect(setCookie).not.toContain("one-time-secret-token");

    const cookie = setCookie.split(";")[0];
    expect(hasValidAccessToken({ headers: { cookie } })).toBe(true);
  });

  it("clears the persistent connection on request", async () => {
    const response = makeResponse();
    await handler({ method: "DELETE" }, response);

    expect(response.statusCode).toBe(200);
    expect(response.headers["Set-Cookie"]).toContain(`${POPBILL_SESSION_COOKIE}=`);
    expect(response.headers["Set-Cookie"]).toContain("Max-Age=0");
  });
});
