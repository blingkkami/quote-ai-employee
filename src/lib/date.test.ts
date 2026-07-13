import { describe, expect, it } from "vitest";
import { addDays, dateInputValue, daysSince, koreanDate, monthKey, parseDate } from "./date";

describe("date helpers", () => {
  it("keeps date-only values in the local calendar day", () => {
    const date = parseDate("2026-07-14");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(6);
    expect(date?.getDate()).toBe(14);
    expect(koreanDate("2026-07-14")).toBe("2026년 7월 14일");
    expect(monthKey("2026-07-14")).toBe("2026-07");
  });

  it("formats explicit local dates without converting through UTC", () => {
    expect(dateInputValue(new Date(2026, 6, 14, 0, 5))).toBe("2026-07-14");
    expect(addDays("2026-07-14", 14)).toBe("2026-07-28");
    expect(daysSince("2026-06-01", new Date(2026, 6, 14))).toBe(43);
  });
});
