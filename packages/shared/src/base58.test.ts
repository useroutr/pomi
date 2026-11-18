import { describe, expect, it } from "vitest";
import { decodeBase58 } from "./base58";

describe("decodeBase58", () => {
  it("decodes each leading 1 as a zero byte", () => {
    expect(decodeBase58("11111111111111111111111111111111")).toEqual(new Uint8Array(32));
  });

  it("decodes a value", () => {
    // 0x0102 is 258 = 4 * 58 + 26, written "5" and "T".
    expect(decodeBase58("5T")).toEqual(Uint8Array.from([1, 2]));
  });

  it("refuses characters outside the alphabet", () => {
    expect(decodeBase58("0OIl")).toBeNull();
  });
});
