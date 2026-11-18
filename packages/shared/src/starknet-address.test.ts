import { describe, expect, it } from "vitest";
import {
  findStarknetAddress,
  InvalidStarknetAddressError,
  parseStarknetAddress,
  shortenStarknetAddress,
} from "./starknet-address";

// ETH's token contract on Starknet.
const ETH = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

describe("parseStarknetAddress", () => {
  it("takes an address in any case and pads it to 64 digits", () => {
    expect(parseStarknetAddress(ETH.toUpperCase().replace("0X", "0x"))).toBe(ETH);
    expect(
      parseStarknetAddress("0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"),
    ).toBe(ETH);
  });

  it.each([
    ["zero", "0x0"],
    ["a value no contract address can take", `0x08${"0".repeat(62)}`],
    ["more than 64 digits", `0x${"1".repeat(65)}`],
    ["no 0x", ETH.slice(2)],
  ])("refuses %s", (_, input) => {
    expect(() => parseStarknetAddress(input)).toThrow(InvalidStarknetAddressError);
  });
});

describe("findStarknetAddress", () => {
  it("finds a full-length address in a sentence, and not a short hex string", () => {
    expect(findStarknetAddress(`My Starknet address is ${ETH}.`)).toBe(ETH);
    expect(findStarknetAddress("Order 0x1f, thanks")).toBeNull();
  });
});

describe("shortenStarknetAddress", () => {
  it("keeps 0x and four digits, then the last four", () => {
    expect(shortenStarknetAddress(ETH)).toBe("0x049d...4dc7");
  });
});
