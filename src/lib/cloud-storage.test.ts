import { describe, expect, it } from "vitest";
import { defaultData } from "../data/seed";
import { hasAppContent } from "./cloud-storage";

describe("hasAppContent", () => {
  it("treats an untouched account as empty", () => {
    expect(hasAppContent(defaultData)).toBe(false);
  });

  it("detects tenant data that should be migrated", () => {
    expect(hasAppContent({ ...defaultData, taxApiIntegration: { ...defaultData.taxApiIntegration, businessNumber: "111-22-33333" } })).toBe(true);
  });
});
