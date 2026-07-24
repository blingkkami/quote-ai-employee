import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ config: vi.fn(), registIssue: vi.fn(), cashRegistIssue: vi.fn(), getUserConnection: vi.fn() }));
vi.mock("../../../server/billing/service.js", () => ({
  authorizeBillingActions: async (_admin, _userId, actions) => ({ ok: true, approved: actions }),
  reverseBillingActions: async () => {},
  requiredBillingReference: (value) => value
}));
vi.mock("popbill", () => ({
  default: {
    config: mocks.config,
    TaxinvoiceService: () => ({ registIssue: mocks.registIssue }),
    CashbillService: () => ({ registIssue: mocks.cashRegistIssue })
  }
}));
vi.mock("../../../server/popbill/auth.js", () => ({
  authorizeRequest: async () => ({ user: { id: "user-1" }, admin: {} }),
  getUserConnection: mocks.getUserConnection
}));

const envKeys = ["POPBILL_CONFIG", "POPBILL_LINK_ID", "POPBILL_SECRET_KEY", "POPBILL_IS_TEST"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const makeResponse = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const payload = { billingReference: "tax-invoice-1", quoteId: "quo_retry_safe_1", projectName: "테스트 견적", writeDate: "2026-07-14", supplyCost: 100000, tax: 10000, total: 110000, items: [{ name: "디자인", supplyCost: 100000, tax: 10000 }], customer: { businessNumber: "123-45-67890", name: "테스트 고객" }, taxInvoiceMemo: "7월 말까지 입금 요청", paymentAccount: { bankName: "국민은행", accountNumber: "123-456", accountHolder: "공급자" } };
const cashPayload = { documentType: "cash", quoteId: "quo_cash_1", projectName: "테스트 견적", writeDate: "2026-07-14", total: 110000, customer: { name: "홍길동", phone: "010-1234-5678", email: "a@b.com" } };

beforeEach(() => {
  vi.resetModules();
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getUserConnection.mockResolvedValue({ corp_num: "1112233333", corp_name: "공급자", ceo_name: "대표자", popbill_user_id: "seller1", contact_phone: "02-000-0000" });
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

  it("accepts the bundled POPBILL_CONFIG environment variable", async () => {
    process.env.POPBILL_CONFIG = JSON.stringify({
      linkId: "link",
      secretKey: "secret",
      corpNum: "1112233333",
      isTest: true
    });
    mocks.registIssue.mockImplementation((...args) => args[8]({ ntsconfirmNum: "nts-bundled" }));
    const { default: handler } = await import("../../../api/popbill/issue.js");
    const response = makeResponse();
    await handler({ method: "POST", body: payload }, response);
    expect(mocks.config).toHaveBeenCalledWith(expect.objectContaining({ LinkID: "link", SecretKey: "secret", IsTest: true }));
    expect(response.body).toMatchObject({ ok: true, invoiceStatus: "issued" });
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

describe("Popbill cash receipt via issue handler (documentType: cash)", () => {
  it("never reports issued when partner credentials are missing", async () => {
    const { default: handler } = await import("../../../api/popbill/issue.js");
    const response = makeResponse();
    await handler({ method: "POST", body: cashPayload }, response);
    expect(response.statusCode).toBe(503);
    expect(response.body).toMatchObject({ ok: false, cashReceiptStatus: "pending" });
    expect(mocks.cashRegistIssue).not.toHaveBeenCalled();
  });

  it("issues a 소득공제 cash receipt for a personal customer", async () => {
    Object.assign(process.env, { POPBILL_LINK_ID: "link", POPBILL_SECRET_KEY: "secret" });
    mocks.cashRegistIssue.mockImplementation((...args) => args[5]({ confirmNum: "cash-1" }));
    const { default: handler } = await import("../../../api/popbill/issue.js");
    const response = makeResponse();
    await handler({ method: "POST", body: cashPayload }, response);
    const cashbill = mocks.cashRegistIssue.mock.calls[0][1];
    expect(cashbill.tradeUsage).toBe("소득공제용");
    expect(cashbill.tradeType).toBe("승인거래");
    expect(cashbill.taxationType).toBe("과세");
    expect(cashbill.identityNum).toBe("01012345678");
    expect(cashbill.franchiseCorpNum).toBe("1112233333");
    expect(cashbill.totalAmount).toBe("110000");
    expect(response.body).toMatchObject({ ok: true, cashReceiptStatus: "issued" });
  });

  it("issues a tax-exempt cash receipt as 비과세 with zero VAT", async () => {
    Object.assign(process.env, { POPBILL_LINK_ID: "link", POPBILL_SECRET_KEY: "secret" });
    mocks.cashRegistIssue.mockImplementation((...args) => args[5]({ confirmNum: "cash-2" }));
    const { default: handler } = await import("../../../api/popbill/issue.js");
    const response = makeResponse();
    await handler({
      method: "POST",
      body: { ...cashPayload, customer: { ...cashPayload.customer, taxExempt: true } }
    }, response);
    const cashbill = mocks.cashRegistIssue.mock.calls[0][1];
    expect(cashbill.taxationType).toBe("비과세");
    expect(cashbill.supplyCost).toBe("110000");
    expect(cashbill.tax).toBe("0");
    expect(cashbill.totalAmount).toBe("110000");
    expect(response.body).toMatchObject({ ok: true, cashReceiptStatus: "issued" });
  });

  it("rejects 지출증빙 without a business number", async () => {
    Object.assign(process.env, { POPBILL_LINK_ID: "link", POPBILL_SECRET_KEY: "secret" });
    const { default: handler } = await import("../../../api/popbill/issue.js");
    const response = makeResponse();
    await handler({ method: "POST", body: { ...cashPayload, tradeUsage: "지출증빙", customer: { name: "홍길동" } } }, response);
    expect(response.statusCode).toBe(400);
    expect(mocks.cashRegistIssue).not.toHaveBeenCalled();
  });
});
