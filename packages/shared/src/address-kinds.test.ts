import { describe, expect, it } from "vitest";
import { addressKindOf, ownAddressKind, parseAddress, shortenAddress } from "./address-kinds";
import { InvalidSolanaAddressError } from "./solana-address";

describe("address kinds", () => {
  it("names the networks that write addresses their own way, and no other", () => {
    expect(ownAddressKind("stellar")).toBe("stellar");
    expect(ownAddressKind("solana")).toBe("solana");
    expect(ownAddressKind("tron")).toBe("tron");
    expect(ownAddressKind("starknet")).toBe("starknet");
    expect(ownAddressKind("monad")).toBeNull();
  });

  it("takes any other network Pomi pays out on for an EVM chain", () => {
    expect(addressKindOf("base")).toBe("evm");
    expect(addressKindOf("hyperevm")).toBe("evm");
  });

  it("checks an address the way its kind writes it", () => {
    expect(parseAddress("solana", " EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v ")).toBe(
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    );
    expect(() => parseAddress("solana", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed")).toThrow(
      InvalidSolanaAddressError,
    );
  });

  it("shortens each network's address the way its wallets do", () => {
    expect(
      shortenAddress("stellar", "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"),
    ).toBe("GA5Z...KZVN");
    expect(shortenAddress("base", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed")).toBe(
      "0x5aAe...eAed",
    );
    expect(shortenAddress("solana", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toBe(
      "EPjF...Dt1v",
    );
    expect(shortenAddress("tron", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe("TR7NHq...Lj6t");
  });
});
