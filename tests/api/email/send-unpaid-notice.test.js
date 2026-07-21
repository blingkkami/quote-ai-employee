import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ maybeSingle: vi.fn(), sendConnectedEmail: vi.fn() }));
vi.mock("../../../server/popbill/auth.js", () => ({
  authorizeRequest: async () => ({
    user: { id: "user-1" },
    admin: { role: "service" },
    client: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }) }
  })
}));
vi.mock("../../../server/email/service.js", () => ({
  requireEmailAdmin: (auth) => auth.admin,
  sendConnectedEmail: mocks.sendConnectedEmail
}));

const appData = {
  customers: [{ id: "customer-1", name: "고객사", email: "client@example.com" }],
  quotes: [
    { id: "quote-1", customerId: "customer-1", approvedAt: "2026-07-10T01:00:00.000Z", form: { projectName: "브랜드 디자인" } },
    { id: "quote-2", customerId: "customer-1", approvedAt: "2026-07-15T01:00:00.000Z", form: { projectName: "웹 디자인" } }
  ],
  sales: [
    { id: "sale-1", quoteId: "quote-1", customerId: "customer-1", amount: 110000, paidAmount: 10000 },
    { id: "sale-2", quoteId: "quote-2", customerId: "customer-1", amount: 220000, paidAmount: 0 }
  ],
  workspaceProfile: {
    businessName: "공급자",
    paymentAccount: { bankName: "국민은행", accountNumber: "123-456", accountHolder: "홍길동", showOnUnpaidNotices: true }
  },
  taxApiIntegration: { corpName: "예전 공급자명" }
};
const makeResponse = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, setHeader() {}, json(value) { this.body = value; return this; } });

beforeEach(() => {
  mocks.maybeSingle.mockReset();
  mocks.sendConnectedEmail.mockReset();
  mocks.maybeSingle.mockResolvedValue({ data: { data: appData }, error: null });
  mocks.sendConnectedEmail.mockResolvedValue({ emailId: "email-1", provider: "google", sender: "owner@example.com" });
});

describe("unpaid notice email handler", () => {
  it("recalculates the balance from saved sales and includes the saved account", async () => {
    const { default: handler } = await import("../../../api/email/send-unpaid-notice.js");
    const response = makeResponse();
    await handler({ method: "POST", body: { customerId: "customer-1", totalAmount: 1 } }, response);
    expect(response.body).toMatchObject({ ok: true, totalAmount: 320000, recipient: "client@example.com" });
    expect(mocks.sendConnectedEmail).toHaveBeenCalledWith({ role: "service" }, "user-1", expect.objectContaining({
      to: "client@example.com",
      subject: "[공급자] 미수금 320,000원 안내",
      html: expect.stringContaining("국민은행 123-456")
    }));
  });

  it("does not send when the account is hidden from unpaid notices", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { data: {
      ...appData,
      workspaceProfile: { ...appData.workspaceProfile, paymentAccount: { ...appData.workspaceProfile.paymentAccount, showOnUnpaidNotices: false } }
    } }, error: null });
    const { default: handler } = await import("../../../api/email/send-unpaid-notice.js");
    const response = makeResponse();
    await handler({ method: "POST", body: { customerId: "customer-1" } }, response);
    expect(response.statusCode).toBe(409);
    expect(mocks.sendConnectedEmail).not.toHaveBeenCalled();
  });
});
