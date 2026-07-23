import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: {},
  authorizeRequest: vi.fn()
}));

vi.mock("../../../server/popbill/auth.js", () => ({
  authorizeRequest: mocks.authorizeRequest
}));

const envKeys = ["PORTONE_STORE_ID", "PORTONE_CHANNEL_KEY", "PORTONE_API_SECRET"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const makeResponse = () => ({
  statusCode: 200,
  body: null,
  setHeader() {},
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

beforeEach(() => {
  vi.resetModules();
  Object.assign(process.env, {
    PORTONE_STORE_ID: "store-test",
    PORTONE_CHANNEL_KEY: "channel-test",
    PORTONE_API_SECRET: "secret-test"
  });
  mocks.authorizeRequest.mockReset();
  mocks.authorizeRequest.mockImplementation(async () => ({
    user: { id: "12345678-1234-1234-1234-123456789012" },
    admin: mocks.admin
  }));
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  envKeys.forEach((key) => {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  });
});

describe("billing checkout handler", () => {
  it("creates an order with the server price and a non-email customer key", async () => {
    const insert = vi.fn().mockReturnValue({
      select: () => ({ single: async () => ({ data: { id: "order-1" }, error: null }) })
    });
    mocks.admin = { from: () => ({ insert }) };

    const { default: handler } = await import("../../../../api/billing/checkout.js");
    const response = makeResponse();
    await handler({ method: "POST", body: { mode: "create", productId: "credits20", amount: 1 } }, response);

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      product_id: "credits20",
      amount: 4_300
    }));
    expect(response.body).toMatchObject({
      ok: true,
      orderId: "order-1",
      customerId: "12345678123412341234",
      product: { id: "credits20", amount: 4_300 }
    });
  });

  it("rejects a paid response whose amount does not match the stored order", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "order-2",
        user_id: "12345678-1234-1234-1234-123456789012",
        product_type: "credits",
        amount: 9_900,
        status: "pending"
      },
      error: null
    });
    const eqUser = { maybeSingle };
    const eqId = { eq: () => eqUser };
    const rpc = vi.fn();
    mocks.admin = {
      from: () => ({ select: () => ({ eq: () => eqId }) }),
      rpc
    };
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "order-2", status: "PAID", amount: { total: 100 } })
    });

    const { default: handler } = await import("../../../../api/billing/checkout.js");
    const response = makeResponse();
    await handler({ method: "POST", body: { mode: "complete", orderId: "order-2" } }, response);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toContain("결제 금액");
    expect(rpc).not.toHaveBeenCalled();
  });
});
