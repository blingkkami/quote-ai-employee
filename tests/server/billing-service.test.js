import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { authorizeBillingActions, requiredBillingReference, reverseBillingActions } from "../../server/billing/service.js";

// 과금 엔진 자체를 검증하는 테스트이므로 안전 모드를 해제(BILLING_ENABLED=true)하고 실행한다.
const previousBillingEnabled = process.env.BILLING_ENABLED;
beforeAll(() => { process.env.BILLING_ENABLED = "true"; });
afterAll(() => {
  if (previousBillingEnabled === undefined) delete process.env.BILLING_ENABLED;
  else process.env.BILLING_ENABLED = previousBillingEnabled;
});

describe("billing service", () => {
  it("authorizes a bundle with the verified user id and preserves each idempotency reference", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ allowed: true, source: "credit" }], error: null });
    const actions = [
      { feature: "quote_pdf", referenceId: "action-1:pdf" },
      { feature: "email", referenceId: "action-1:email" }
    ];
    const result = await authorizeBillingActions({ rpc }, "user-1", actions);
    expect(result).toEqual({ ok: true, approved: actions });
    expect(rpc).toHaveBeenNthCalledWith(2, "consume_billing_action", {
      p_user_id: "user-1",
      p_feature: "email",
      p_reference_id: "action-1:email"
    });
  });

  it("reverses earlier approvals when a later action is denied", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ allowed: true }], error: null })
      .mockResolvedValueOnce({ data: [{ allowed: false, message: "크레딧 부족" }], error: null })
      .mockResolvedValue({ data: [{ reversed: true }], error: null });
    const result = await authorizeBillingActions({ rpc }, "user-1", [
      { feature: "quote_pdf", referenceId: "pdf-1" },
      { feature: "email", referenceId: "email-1" }
    ]);
    expect(result).toEqual({ ok: false, message: "크레딧 부족" });
    expect(rpc).toHaveBeenCalledWith("reverse_billing_action", {
      p_user_id: "user-1",
      p_feature: "quote_pdf",
      p_reference_id: "pdf-1"
    });
  });

  it("throws when billing is enabled but no admin client is provided", async () => {
    await expect(authorizeBillingActions(null, "user-1", [{ feature: "email", referenceId: "e-1" }]))
      .rejects.toThrow("결제 서버의 관리자 설정이 필요합니다.");
  });

  it("rejects missing or oversized references", () => {
    expect(() => requiredBillingReference("", "메일")).toThrow("메일 사용 승인 번호가 필요합니다.");
    expect(() => requiredBillingReference("x".repeat(181), "메일")).toThrow();
  });

  it("can reverse all actions after an external failure", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ reversed: true }], error: null });
    await reverseBillingActions({ rpc }, "user-1", [{ feature: "unpaid_notice", referenceId: "notice-1" }]);
    expect(rpc).toHaveBeenCalledWith("reverse_billing_action", {
      p_user_id: "user-1",
      p_feature: "unpaid_notice",
      p_reference_id: "notice-1"
    });
  });
});
