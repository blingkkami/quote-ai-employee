import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ config: vi.fn(), checkIsMember: vi.fn() }));

vi.mock("popbill", () => ({
  default: {
    config: mocks.config,
    TaxinvoiceService: () => ({ checkIsMember: mocks.checkIsMember })
  }
}));

const envKeys = ["POPBILL_LINK_ID", "POPBILL_SECRET_KEY", "POPBILL_CORP_NUM", "POPBILL_CORP_NAME", "POPBILL_CEO_NAME", "POPBILL_IS_TEST", "POPBILL_ACCESS_TOKEN"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

beforeEach(() => {
  vi.resetModules();
  mocks.config.mockReset();
  mocks.checkIsMember.mockReset();
  envKeys.forEach((key) => delete process.env[key]);
});

afterEach(() => {
  envKeys.forEach((key) => {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  });
});

describe("Popbill status handler", () => {
  it("reports missing environment variables without calling Popbill", async () => {
    const { default: handler } = await import("./status.js");
    const response = makeResponse();
    await handler({ method: "GET" }, response);

    expect(response.body.configured).toBe(false);
    expect(response.body.missing).toContain("POPBILL_SECRET_KEY");
    expect(mocks.checkIsMember).not.toHaveBeenCalled();
  });

  it("marks the connection ready only after Popbill confirms membership", async () => {
    Object.assign(process.env, {
      POPBILL_LINK_ID: "link",
      POPBILL_SECRET_KEY: "secret",
      POPBILL_CORP_NUM: "111-22-33333",
      POPBILL_CORP_NAME: "공급자",
      POPBILL_CEO_NAME: "대표자",
      POPBILL_ACCESS_TOKEN: "test-access-token"
    });
    mocks.checkIsMember.mockImplementation((_corpNum, success) => success({ code: 1, message: "확인" }));
    const { default: handler } = await import("./status.js");
    const response = makeResponse();
    await handler({ method: "GET", headers: { "x-blingbill-token": "test-access-token" } }, response);

    expect(mocks.checkIsMember).toHaveBeenCalledWith("1112233333", expect.any(Function), expect.any(Function));
    expect(response.body).toMatchObject({ ok: true, configured: true, environment: "test" });
  });
});
