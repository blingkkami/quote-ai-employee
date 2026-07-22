import { describe, expect, it } from "vitest";
import { validateSupportDraft, type SupportDraft } from "./support";

const draft = (patch: Partial<SupportDraft> = {}): SupportDraft => ({
  category: "bug",
  subject: "저장 오류",
  message: "저장 버튼을 누르면 오류 메시지가 표시됩니다.",
  ...patch
});

describe("validateSupportDraft", () => {
  it("accepts a complete inquiry", () => {
    expect(validateSupportDraft(draft())).toBe("");
  });

  it("requires a useful subject", () => {
    expect(validateSupportDraft(draft({ subject: " " }))).toContain("2자");
  });

  it("requires enough detail to investigate", () => {
    expect(validateSupportDraft(draft({ message: "안돼요" }))).toContain("10자");
  });

  it("rejects messages beyond the database limit", () => {
    expect(validateSupportDraft(draft({ message: "가".repeat(2001) }))).toContain("2,000자");
  });
});
