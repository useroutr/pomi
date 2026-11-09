import { describe, expect, it } from "vitest";
import { InvalidHandleError, parseHandle } from "./handle";

describe("parseHandle", () => {
  it.each([
    ["collins", "collins"],
    ["ada-lovelace", "ada-lovelace"],
    ["a1b", "a1b"],
    [" Collins ", "collins"],
    ["a".repeat(30), "a".repeat(30)],
  ])("accepts %j as %j", (input, expected) => {
    expect(parseHandle(input)).toBe(expected);
  });

  it.each([
    "ab",
    "a".repeat(31),
    "1collins",
    "-collins",
    "collins-",
    "col--lins",
    "col_lins",
    "col.lins",
    "colliñs",
    "",
  ])("refuses %j, which is not a handle", (input) => {
    expect(() => parseHandle(input)).toThrow(InvalidHandleError);
  });

  it.each(["api", "dashboard", "pomi", "Useroutr"])("refuses %j, which is reserved", (input) => {
    expect(() => parseHandle(input)).toThrow("reserved");
  });

  it("refuses r, the prefix of every request link", () => {
    // Too short for the format already, so it can never shadow /r/<id>.
    expect(() => parseHandle("r")).toThrow(InvalidHandleError);
  });
});
