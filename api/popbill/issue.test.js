import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ config: vi.fn(), registIssue: vi.fn() }));

vi.mock("popbill", () => ({
  default: {
    config: mocks.config,
    TaxinvoiceService: () => ({ registIssue: mocks.registIssue })
  }
}));

const envKeys = ["POPBILL_LINK_ID", "POPBILL_SECRET_KEY", "POPBILL_CORP_NUM", "POPBILL_CORP_NAME", "POPBILL_CEO_NAME", "POPBILL_USER_ID", "POPBILL_IS_TEST", "POPBILL_ACCESS_TOKEN"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

const payload = {
  quoteId: "quo_retry_safe_1",
  projectName: "테스트 견적",
  writeDate: "2026-07-14",
  supplyCost: 100000,
  tax: 10000,
  total: 110000,
  items: [{ name: "디자인", supplyCost: 100000, tax: 10000 }],
  customer: { businessNumber: "123-45-67890", name: "테스트 고객", ceoName: "김대표" }
};

beforeEach(() => {
  vi.resetModules();
  mocks.config.mockReset();
  mocks.registIssue.mockReset();
  envKeys.forEach((key) => delete process.env[key]);
});

afterEach(() => {
  envKeys.forEach((key) => {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  });
});

describe("Popbill issue handler", () => {
  it("never reports issued when server credentials are missing", async () => {
    process.env.POPBILL_ACCESS_TOKEN = "test-access-token";
    const { default: handler } = await import("./issue.js");
    const response = makeResponse();
    await handler({ method: "POST", body: payload, headers: { "x-blingbill-token": "test-access-token" } }, response);

    expect(response.statusCode).toBe(503);
    expect(response.body).toMatchObject({ ok: false, mode: "not_configured", invoiceStatus: "pending" });
    expect(mocks.registIssue).not.toHaveBeenCalled();
  });

  it("uses the same Popbill management key on retries", async () => {
    Object.assign(process.env, {
      POPBILL_LINK_ID: "link",
      POPBILL_SECRET_KEY: "secret",
      POPBILL_CORP_NUM: "111-22-33333",
      POPBILL_CORP_NAME: "공급자",
      POPBILL_CEO_NAME: "대표자",
      POPBILL_ACCESS_TOKEN: "test-access-token"
    });
    mocks.registIssue.mockImplementation((...args) => args[8]({ ntsconfirmNum: "nts-1" }));
    const { default: handler } = await import("./issue.js");
    const first = makeResponse();
    const second = makeResponse();

    const request = { method: "POST", body: payload, headers: { "x-blingbill-token": "test-access-token" } };
    await handler(request, first);
    await handler(request, second);

    const firstInvoice = mocks.registIssue.mock.calls[0][1];
    const secondInvoice = mocks.registIssue.mock.calls[1][1];
    expect(firstInvoice.invoicerMgtKey).toBe("quo_retry_safe_1");
    expect(secondInvoice.invoicerMgtKey).toBe(firstInvoice.invoicerMgtKey);
    expect(firstInvoice.purposeType).toBe("청구");
    expect(first.body).toMatchObject({ ok: true, invoiceStatus: "issued", popbillNtsConfirmNum: "nts-1" });
  });

  it("rejects direct issue requests without the customer access token", async () => {
    Object.assign(process.env, {
      POPBILL_LINK_ID: "link",
      POPBILL_SECRET_KEY: "secret",
      POPBILL_CORP_NUM: "1112233333",
      POPBILL_CORP_NAME: "공급자",
      POPBILL_CEO_NAME: "대표자",
      POPBILL_ACCESS_TOKEN: "test-access-token"
    });
    const { default: handler } = await import("./issue.js");
    const response = makeResponse();
    await handler({ method: "POST", body: payload, headers: {} }, response);

    expect(response.statusCode).toBe(401);
    expect(response.body).toMatchObject({ ok: false, invoiceStatus: "pending" });
    expect(mocks.registIssue).not.toHaveBeenCalled();
  });
});
