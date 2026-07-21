import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ config: vi.fn(), registIssue: vi.fn(), getUserConnection: vi.fn() }));
vi.mock("popbill", () => ({ default: { config: mocks.config, TaxinvoiceService: () => ({ registIssue: mocks.registIssue }) } }));
vi.mock("../../../server/popbill/auth.js", () => ({
  authorizeRequest: async () => ({ user: { id: "user-1" }, admin: {} }),
  getUserConnection: mocks.getUserConnection
}));

const envKeys = ["POPBILL_LINK_ID", "POPBILL_SECRET_KEY", "POPBILL_IS_TEST"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const makeResponse = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const payload = { quoteId: "quo_retry_safe_1", projectName: "테스트 견적", writeDate: "2026-07-14", supplyCost: 100000, tax: 10000, total: 110000, items: [{ name: "디자인", supplyCost: 100000, tax: 10000 }], customer: { businessNumber: "123-45-67890", name: "테스트 고객" }, taxInvoiceMemo: "7월 말까지 입금 요청", paymentAccount: { bankName: "국민은행", accountNumber: "123-456", accountHolder: "공급자" } };

beforeEach(() => {
  vi.resetModules();
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getUserConnection.mockResolvedValue({ corp_num: "1112233333", corp_name: "공급자", ceo_name: "대표자", popbill_user_id: "seller1" });
  envKeys.forEach((key) => delete process.env[key]);
});
afterEach(() => envKeys.forEach((key) => originalEnv[key] === undefined ? delete process.env[key] : process.env[key] = originalEnv[key]));

describe("Popbill issue handler", () => {
  it("never reports issued when partner credentials are missing", async () => {
    const { default: handler } = await import("../../../api/popbill/issue.js");
    const response = makeResponse();
    await handler({ method: "POST", body: payload }, response);
    expect(response.statusCode).toBe(503);
    expect(response.body).toMatchObject({ ok: false, invoiceStatus: "pending" });
    expect(mocks.registIssue).not.toHaveBeenCalled();
  });

  it("issues with the signed-in user's supplier connection", async () => {
    Object.assign(process.env, { POPBILL_LINK_ID: "link", POPBILL_SECRET_KEY: "secret" });
    mocks.registIssue.mockImplementation((...args) => args[8]({ ntsconfirmNum: "nts-1" }));
    const { default: handler } = await import("../../../api/popbill/issue.js");
    const response = makeResponse();
    await handler({ method: "POST", body: payload }, response);
    const invoice = mocks.registIssue.mock.calls[0][1];
    expect(invoice.invoicerCorpNum).toBe("1112233333");
    expect(invoice.invoicerCorpName).toBe("공급자");
    expect(invoice.remark1).toBe("입금계좌: 국민은행 123-456 (예금주 공급자)");
    expect(invoice.remark2).toBe("7월 말까지 입금 요청");
    expect(response.body).toMatchObject({ ok: true, invoiceStatus: "issued" });
  });
});
