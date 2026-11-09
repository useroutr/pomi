import { describe, expect, it } from "vitest";
import { InvalidAmountError, parseRequestAmount } from "./amount";

describe("parseRequestAmount", () => {
  it.each([
    ["25", "25"],
    ["12.50", "12.5"],
    ["0012", "12"],
    ["0.5", "0.5"],
    [" 7 ", "7"],
    ["1.50000000", "1.5"],
    ["0.0000001", "0.0000001"],
    ["922337203685.4775807", "922337203685.4775807"],
  ])("normalizes %j to %j", (input, expected) => {
    expect(parseRequestAmount(input)).toBe(expected);
  });

  it.each(["", "abc", "-5", "+5", "1e3", "1,000", ".5", "5.", "1.2.3"])(
    "refuses %j, which is not a plain decimal",
    (input) => {
      expect(() => parseRequestAmount(input)).toThrow(InvalidAmountError);
    },
  );

  it.each(["0", "000", "0.0", "0.0000000"])("refuses %j, which is zero", (input) => {
    expect(() => parseRequestAmount(input)).toThrow("more than zero");
  });

  it("refuses more than seven decimal places", () => {
    expect(() => parseRequestAmount("1.12345678")).toThrow("at most 7 decimal places");
  });

  it("refuses an amount above the largest int64 of stroops", () => {
    expect(() => parseRequestAmount("922337203685.4775808")).toThrow("larger than Stellar");
  });
});
