import { describe, expect, it } from "vitest";
import {
  findEvmAddress,
  InvalidEvmAddressError,
  parseEvmAddress,
  shortenEvmAddress,
} from "./evm-address";

// EIP-55's own examples.
const CHECKSUMMED = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const OTHER = "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359";

describe("parseEvmAddress", () => {
  it.each([
    [CHECKSUMMED, CHECKSUMMED],
    [CHECKSUMMED.toLowerCase(), CHECKSUMMED],
    [`0x${CHECKSUMMED.slice(2).toUpperCase()}`, CHECKSUMMED],
    [`  ${OTHER}\n`, OTHER],
  ])("accepts %j as %j", (input, expected) => {
    expect(parseEvmAddress(input)).toBe(expected);
  });

  it("refuses a mixed-case address whose checksum does not match", () => {
    // The checksum makes the fifth character a capital A.
    const typo = `${CHECKSUMMED.slice(0, 4)}a${CHECKSUMMED.slice(5)}`;
    expect(() => parseEvmAddress(typo)).toThrow(/checksum/);
  });

  it.each([
    "",
    "0x",
    CHECKSUMMED.slice(0, 41),
    `${CHECKSUMMED}0`,
    "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    "0xZZ" + "0".repeat(38),
  ])("refuses %j", (input) => {
    expect(() => parseEvmAddress(input)).toThrow(InvalidEvmAddressError);
  });
});

describe("findEvmAddress", () => {
  it.each([
    [CHECKSUMMED, CHECKSUMMED],
    [`My Base address is ${CHECKSUMMED.toLowerCase()}.`, CHECKSUMMED],
    [`ethereum:${CHECKSUMMED}@8453`, CHECKSUMMED],
    [`${CHECKSUMMED} ${CHECKSUMMED.toLowerCase()}`, CHECKSUMMED],
  ])("finds the address in %j", (text, expected) => {
    expect(findEvmAddress(text)).toBe(expected);
  });

  it.each(["", "305040", `${CHECKSUMMED} or ${OTHER}`, `x${CHECKSUMMED}`])(
    "finds no address in %j",
    (text) => {
      expect(findEvmAddress(text)).toBeNull();
    },
  );
});

describe("shortenEvmAddress", () => {
  it("keeps 0x, the first four digits and the last four", () => {
    expect(shortenEvmAddress(CHECKSUMMED)).toBe("0x5aAe...eAed");
  });
});
