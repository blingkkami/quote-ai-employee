import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkIsMember: vi.fn(),
  joinMember: vi.fn(),
  checkCorpNum: vi.fn(),
  checkBizInfo: vi.fn(),
  getUserConnection: vi.fn(),
  getConnectionByCorpNum: vi.fn(),
  saveUserConnection: vi.fn(),
  removeUserConnection: vi.fn()
}));

vi.mock("popbill", () => ({
  default: {
    config: vi.fn(),
    TaxinvoiceService: () => ({ checkIsMember: mocks.checkIsMember, joinMember: mocks.joinMember }),
    ClosedownService: () => ({ checkCorpNum: mocks.checkCorpNum }),
    BizInfoCheckService: () => ({ checkBizInfo: mocks.checkBizInfo })
  }
}));
vi.mock("../../../server/popbill/auth.js", () => ({
  authorizeRequest: async () => ({ user: { id: "user-1" }, admin: {} }),
  getUserConnection: mocks.getUserConnection,
  getConnectionByCorpNum: mocks.getConnectionByCorpNum,
  saveUserConnection: mocks.saveUserConnection,
  removeUserConnection: mocks.removeUserConnection
}));

const makeResponse = () => ({ statusCode: 200, body: null, headers: {}, status(code) { this.statusCode = code; return this; }, setHeader(name, value) { this.headers[name] = value; }, json(body) { this.body = body; return this; } });

beforeEach(() => {
  vi.resetModules();
  Object.assign(process.env, { POPBILL_LINK_ID: "link", POPBILL_SECRET_KEY: "secret" });
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getUserConnection.mockResolvedValue(null);
  mocks.getConnectionByCorpNum.mockResolvedValue(null);
});

describe("Popbill tenant connection", () => {
  it("blocks a business number already connected to another user", async () => {
    mocks.getConnectionByCorpNum.mockResolvedValue({ user_id: "user-2", corp_num: "1112233333" });
    const { default: handler } = await import("../../../api/popbill/connect.js");
    const response = makeResponse();
    await handler({ method: "POST", body: { mode: "check", businessNumber: "111-22-33333" } }, response);
    expect(response.statusCode).toBe(409);
    expect(mocks.checkIsMember).not.toHaveBeenCalled();
  });

  it("offers one-step signup when the business is not a Popbill member", async () => {
    mocks.checkIsMember.mockImplementation((_corpNum, success) => success({ code: 0 }));
    const { default: handler } = await import("../../../api/popbill/connect.js");
    const response = makeResponse();
    await handler({ method: "POST", body: { mode: "check", businessNumber: "111-22-33333" } }, response);
    expect(response.body).toMatchObject({ ok: true, configured: false, needsSignup: true });
  });

  it("reports an active business as 정상 on status check", async () => {
    mocks.getUserConnection.mockResolvedValue({ corp_num: "1112233333" });
    mocks.checkCorpNum.mockImplementation((_corpNum, _checkCorpNum, _userId, success) => success({ state: "1" }));
    const { default: handler } = await import("../../../api/popbill/connect.js");
    const response = makeResponse();
    await handler({ method: "POST", body: { mode: "status", businessNumber: "111-22-33333" } }, response);
    expect(response.body).toMatchObject({ ok: true, checked: true, active: true });
    expect(mocks.checkIsMember).not.toHaveBeenCalled();
  });

  it("does not assert active for an unrecognized status response", async () => {
    mocks.getUserConnection.mockResolvedValue({ corp_num: "1112233333" });
    mocks.checkCorpNum.mockImplementation((_corpNum, _checkCorpNum, _userId, success) => success({ weird: "shape" }));
    const { default: handler } = await import("../../../api/popbill/connect.js");
    const response = makeResponse();
    await handler({ method: "POST", body: { mode: "status", businessNumber: "111-22-33333" } }, response);
    expect(response.body.active).toBeNull();
  });

  it("fills company info from lookup without asserting an unknown tax type", async () => {
    mocks.getUserConnection.mockResolvedValue({ corp_num: "1112233333" });
    mocks.checkBizInfo.mockImplementation((_corpNum, _checkCorpNum, _userId, success) => success({ corpName: "블링까미", ceoName: "김대표" }));
    const { default: handler } = await import("../../../api/popbill/connect.js");
    const response = makeResponse();
    await handler({ method: "POST", body: { mode: "lookup", businessNumber: "111-22-33333" } }, response);
    expect(response.body).toMatchObject({ ok: true, found: true, corpName: "블링까미", ceoName: "김대표", taxType: "unknown" });
  });
});
