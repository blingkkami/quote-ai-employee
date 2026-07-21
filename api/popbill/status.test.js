import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ config: vi.fn(), checkIsMember: vi.fn(), getUserConnection: vi.fn() }));

vi.mock("popbill", () => ({
  default: { config: mocks.config, TaxinvoiceService: () => ({ checkIsMember: mocks.checkIsMember }) }
}));
vi.mock("./auth.js", () => ({
  authorizeRequest: async () => ({ user: { id: "user-1" }, admin: {} }),
  getUserConnection: mocks.getUserConnection
}));

const envKeys = ["POPBILL_LINK_ID", "POPBILL_SECRET_KEY", "POPBILL_IS_TEST"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const makeResponse = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, setHeader() {}, json(body) { this.body = body; return this; } });

beforeEach(() => {
  vi.resetModules();
  mocks.config.mockReset();
  mocks.checkIsMember.mockReset();
  mocks.getUserConnection.mockReset();
  mocks.getUserConnection.mockResolvedValue({ corp_num: "1112233333" });
  envKeys.forEach((key) => delete process.env[key]);
});

afterEach(() => envKeys.forEach((key) => originalEnv[key] === undefined ? delete process.env[key] : process.env[key] = originalEnv[key]));

describe("Popbill status handler", () => {
  it("reports missing partner credentials without calling Popbill", async () => {
    const { default: handler } = await import("./status.js");
    const response = makeResponse();
    await handler({ method: "GET" }, response);
    expect(response.statusCode).toBe(503);
    expect(response.body.configured).toBe(false);
    expect(mocks.checkIsMember).not.toHaveBeenCalled();
  });

  it("checks the signed-in user's own business number", async () => {
    Object.assign(process.env, { POPBILL_LINK_ID: "link", POPBILL_SECRET_KEY: "secret" });
    mocks.checkIsMember.mockImplementation((_corpNum, success) => success({ code: 1 }));
    const { default: handler } = await import("./status.js");
    const response = makeResponse();
    await handler({ method: "GET" }, response);
    expect(mocks.checkIsMember).toHaveBeenCalledWith("1112233333", expect.any(Function), expect.any(Function));
    expect(response.body).toMatchObject({ ok: true, configured: true });
  });
});
