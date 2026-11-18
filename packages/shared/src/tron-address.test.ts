import { describe, expect, it } from "vitest";
import {
  findTronAddress,
  InvalidTronAddressError,
  parseTronAddress,
  shortenTronAddress,
} from "./tron-address";

// USDT's contract on Tron: a real address with a valid checksum.
const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

describe("parseTronAddress", () => {
  it("takes an address whose checksum matches", () => {
    expect(parseTronAddress(` ${USDT} `)).toBe(USDT);
  });

  it("refuses a typo, which breaks the checksum", () => {
    const typo = `${USDT.slice(0, 10)}${USDT.charAt(10) === "x" ? "y" : "x"}${USDT.slice(11)}`;
    expect(() => parseTronAddress(typo)).toThrow(/checksum/);
  });

  it.each([
    ["one that does not start with T", `A${USDT.slice(1)}`],
    ["one that is too short", USDT.slice(0, -1)],
    ["an EVM address", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"],
  ])("refuses %s", (_, input) => {
    expect(() => parseTronAddress(input)).toThrow(InvalidTronAddressError);
  });
});

describe("findTronAddress", () => {
  it("finds the address in a sentence and skips one with a broken checksum", () => {
    expect(findTronAddress(`Send to ${USDT} please`)).toBe(USDT);
    expect(findTronAddress(`Send to ${USDT.slice(0, -1)}u please`)).toBeNull();
  });
});

describe("shortenTronAddress", () => {
  it("keeps six characters at the start and four at the end", () => {
    expect(shortenTronAddress(USDT)).toBe("TR7NHq...Lj6t");
  });
});
