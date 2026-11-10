import { describe, expect, it } from "vitest";
import {
  generateSignInCode,
  hashSignInCode,
  normalizeSignInCode,
  signInCodeMatches,
} from "./sign-in-code";

const secret = "s".repeat(32);

describe("generateSignInCode", () => {
  it("makes six digits, keeping leading zeros", () => {
    for (let index = 0; index < 200; index += 1) {
      expect(generateSignInCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe("normalizeSignInCode", () => {
  it.each([
    ["123456", "123456"],
    [" 123 456 ", "123456"],
    ["012345", "012345"],
  ])("accepts %j", (input, expected) => {
    expect(normalizeSignInCode(input)).toBe(expected);
  });

  it.each(["", "12345", "1234567", "12345a", "١٢٣٤٥٦"])("refuses %j", (input) => {
    expect(normalizeSignInCode(input)).toBeUndefined();
  });
});

describe("signInCodeMatches", () => {
  const codeHash = hashSignInCode(secret, "receiver@example.com", "123456");

  it("matches the code it was made from", () => {
    expect(signInCodeMatches(secret, "receiver@example.com", "123456", codeHash)).toBe(true);
  });

  it("refuses another code", () => {
    expect(signInCodeMatches(secret, "receiver@example.com", "123457", codeHash)).toBe(false);
  });

  it("refuses the same code for another address", () => {
    expect(signInCodeMatches(secret, "other@example.com", "123456", codeHash)).toBe(false);
  });

  it("refuses the same code under another secret", () => {
    expect(signInCodeMatches("t".repeat(32), "receiver@example.com", "123456", codeHash)).toBe(
      false,
    );
  });

  it("refuses a stored hash of the wrong length", () => {
    expect(signInCodeMatches(secret, "receiver@example.com", "123456", "abcd")).toBe(false);
  });
});
