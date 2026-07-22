import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkIsMember: vi.fn(),
  joinMember: vi.fn(),
  getContactInfo: vi.fn(),
  getCorpInfo: vi.fn(),
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
    TaxinvoiceService: () => ({ checkIsMember: mocks.checkIsMember, joinMember: mocks.joinMember, getContactInfo: mocks.getContactInfo, getCorpInfo: mocks.getCorpInfo }),
    ClosedownService: () => ({ checkCorpNum: mocks.checkCorpNum }),
    BizInfoCheckService: () => ({ checkBizInfo: mocks.checkBizInfo })
  }
}));
vi.mock("../../../server/popbill/auth.js", () => ({
  authorizeRequest: async () => ({ user: { id: "user-1", email: "owner@example.com" }, admin: {} }),
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
    expect(response.body).toMatchObject({ ok: true, configured: false, needsSignup: true, environment: "test" });
  });

  it("offers secure reconnection when the business is already a Popbill member", async () => {
    mocks.checkIsMember.mockImplementation((_corpNum, success) => success({ code: 1 }));
    const { default: handler } = await import("../../../api/popbill/connect.js");
    const response = makeResponse();
    await handler({ method: "POST", body: { mode: "check", businessNumber: "111-22-33333" } }, response);
    expect(response.body).toMatchObject({ ok: true, configured: false, existingMember: true, needsExistingConnection: true, environment: "test" });
  });

  it("reconnects an existing member after matching the Popbill contact email", async () => {
    mocks.checkIsMember.mockImplementation((_corpNum, success) => success({ code: 1 }));
    mocks.getContactInfo.mockImplementation((_corpNum, _contactId, _userId, success) => success({ id: "owner01", email: "owner@example.com", personName: "김담당", tel: "01012345678", state: 1 }));
    mocks.getCorpInfo.mockImplementation((_corpNum, _userId, success) => success({ corpName: "블링까미", ceoname: "김대표", addr: "서울", bizType: "서비스", bizClass: "디자인" }));
    const { default: handler } = await import("../../../api/popbill/connect.js");
    const response = makeResponse();
    await handler({ method: "POST", body: { mode: "connect-existing", businessNumber: "111-22-33333", popbillUserId: "owner01" } }, response);
    expect(response.body).toMatchObject({ ok: true, configured: true, connection: { corp_num: "1112233333", popbill_user_id: "owner01", contact_email: "owner@example.com" } });
    expect(mocks.saveUserConnection).toHaveBeenCalledWith({}, "user-1", expect.objectContaining({ corp_num: "1112233333" }));
  });

  it("rejects an existing member when the contact email does not match the login", async () => {
    mocks.checkIsMember.mockImplementation((_corpNum, success) => success({ code: 1 }));
    mocks.getContactInfo.mockImplementation((_corpNum, _contactId, _userId, success) => success({ id: "owner01", email: "other@example.com", state: 1 }));
    const { default: handler } = await import("../../../api/popbill/connect.js");
    const response = makeResponse();
    await handler({ method: "POST", body: { mode: "connect-existing", businessNumber: "111-22-33333", popbillUserId: "owner01" } }, response);
    expect(response.statusCode).toBe(403);
    expect(mocks.saveUserConnection).not.toHaveBeenCalled();
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
