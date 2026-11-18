import { describe, expect, it } from "vitest";
import { formatAmount, sumAmounts } from "./amount-display";

describe("formatAmount", () => {
  it("drops trailing zeros and the point they leave", () => {
    expect(formatAmount("250.0000000")).toBe("250");
    expect(formatAmount("12.5000000")).toBe("12.5");
  });

  it("groups thousands", () => {
    expect(formatAmount("1234567.25")).toBe("1,234,567.25");
  });
});

describe("sumAmounts", () => {
  it("adds decimal strings exactly", () => {
    expect(sumAmounts(["0.1", "0.2"])).toBe("0.3");
    expect(sumAmounts(["25.0000000", "12.5", "0.0000001"])).toBe("37.5000001");
  });

  it("is zero for no amounts", () => {
    expect(sumAmounts([])).toBe("0");
  });
});
