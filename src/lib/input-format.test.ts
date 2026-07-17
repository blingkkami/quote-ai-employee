import { describe, expect, it } from "vitest";
import { formatBusinessNumber, formatPhoneNumber } from "./input-format";

describe("formatBusinessNumber", () => {
  it("formats digits and pasted separators as a business number", () => {
    expect(formatBusinessNumber("1234567890")).toBe("123-45-67890");
    expect(formatBusinessNumber("123 45-67890")).toBe("123-45-67890");
  });

  it("keeps partial input usable", () => {
    expect(formatBusinessNumber("1234")).toBe("123-4");
    expect(formatBusinessNumber("12345")).toBe("123-45");
  });
});

describe("formatPhoneNumber", () => {
  it("formats common Korean phone number shapes", () => {
    expect(formatPhoneNumber("01012345678")).toBe("010-1234-5678");
    expect(formatPhoneNumber("0212345678")).toBe("02-1234-5678");
    expect(formatPhoneNumber("0311234567")).toBe("031-123-4567");
    expect(formatPhoneNumber("15881234")).toBe("1588-1234");
    expect(formatPhoneNumber("050512345678")).toBe("0505-1234-5678");
  });

  it("normalizes pasted separators and supports partial input", () => {
    expect(formatPhoneNumber("010 1234-5678")).toBe("010-1234-5678");
    expect(formatPhoneNumber("0101234")).toBe("010-1234");
  });

  it("preserves an international prefix without applying Korean grouping", () => {
    expect(formatPhoneNumber("+1 212 555 0199")).toBe("+12125550199");
  });
});
