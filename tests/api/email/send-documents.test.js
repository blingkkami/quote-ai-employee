import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ maybeSingle: vi.fn(), sendConnectedEmail: vi.fn() }));
vi.mock("../../../server/billing/service.js", () => ({
  authorizeBillingActions: async (_client, actions) => ({ ok: true, approved: actions }),
  reverseBillingActions: async () => {},
  requiredBillingReference: (value) => value
}));
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
  quotes: [{ id: "quote-1", customerId: "customer-1", form: { projectName: "테스트" }, createdAt: "2026-07-01", updatedAt: "2026-07-02" }],
  customers: [{ id: "customer-1", name: "고객사", email: "client@example.com" }],
  taxApiIntegration: { corpName: "공급자", contactEmail: "reply@example.com" }
};
const pdf = "JVBERi0xLjQK";
const body = {
  quoteId: "quote-1",
  recipient: "client@example.com",
  billingReferences: { quote_pdf: "pdf-1", transaction_statement: "statement-1", email: "email-1" },
  attachments: [{ filename: "견적서.pdf", content: pdf }, { filename: "거래명세서.pdf", content: pdf }]
};
const makeResponse = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, setHeader() {}, json(value) { this.body = value; return this; } });

beforeEach(() => {
  mocks.maybeSingle.mockReset();
  mocks.sendConnectedEmail.mockReset();
  mocks.maybeSingle.mockResolvedValue({ data: { data: appData }, error: null });
  mocks.sendConnectedEmail.mockResolvedValue({ emailId: "email-1", provider: "google", sender: "owner@example.com" });
});

describe("document email handler", () => {
  it("only sends to the email saved on the user's customer", async () => {
    const { default: handler } = await import("../../../api/email/send-documents.js");
    const response = makeResponse();
    await handler({ method: "POST", body: { ...body, recipient: "other@example.com" } }, response);
    expect(response.statusCode).toBe(403);
    expect(mocks.sendConnectedEmail).not.toHaveBeenCalled();
  });

  it("sends two PDFs through the user's connected mailbox", async () => {
    const { default: handler } = await import("../../../api/email/send-documents.js");
    const response = makeResponse();
    await handler({ method: "POST", body }, response);
    expect(response.body).toMatchObject({ ok: true, emailId: "email-1", sender: "owner@example.com", recipient: "client@example.com" });
    expect(mocks.sendConnectedEmail).toHaveBeenCalledWith({ role: "service" }, "user-1", expect.objectContaining({
      to: "client@example.com",
      attachments: expect.arrayContaining([
        expect.objectContaining({ filename: "견적서.pdf" }),
        expect.objectContaining({ filename: "거래명세서.pdf" })
      ])
    }));
  });
});
