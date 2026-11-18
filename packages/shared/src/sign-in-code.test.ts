import { describe, expect, it } from "vitest";
import { findSignInCode } from "./sign-in-code";

describe("findSignInCode", () => {
  it.each([
    ["305040", "305040"],
    ["  305040\n", "305040"],
    ["305 040", "305040"],
    ["305-040", "305040"],
    ["305040 is your Pomi sign-in code", "305040"],
    ["Your Pomi sign-in code is 305040. It works for 10 minutes.", "305040"],
    ["Code: 305040 (again: 305040)", "305040"],
    ["012345", "012345"],
  ])("finds the code in %j", (text, expected) => {
    expect(findSignInCode(text)).toBe(expected);
  });

  it.each([
    "",
    "hello",
    "30504",
    "3050401",
    "GABC305040",
    "305040 or 123456",
    "Call +1 415 555 0100",
  ])("finds no code in %j", (text) => {
    expect(findSignInCode(text)).toBeNull();
  });
});
