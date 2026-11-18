import { describe, expect, it } from "vitest";
import {
  findSolanaAddress,
  InvalidSolanaAddressError,
  parseSolanaAddress,
  shortenSolanaAddress,
} from "./solana-address";

// USDC's mint and the token program: real 32-byte keys.
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

describe("parseSolanaAddress", () => {
  it.each([USDC_MINT, TOKEN_PROGRAM, "11111111111111111111111111111111"])("takes %s", (address) => {
    expect(parseSolanaAddress(`  ${address}\n`)).toBe(address);
  });

  it.each([
    ["a character base58 leaves out", `${USDC_MINT.slice(0, -1)}0`],
    ["too short to be a key", USDC_MINT.slice(0, 30)],
    ["a key of the wrong length", "1111111111111111111111111111111111111111111"],
    ["an EVM address", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"],
  ])("refuses %s", (_, input) => {
    expect(() => parseSolanaAddress(input)).toThrow(InvalidSolanaAddressError);
  });
});

describe("findSolanaAddress", () => {
  it("finds the address in a payment link or a sentence", () => {
    expect(findSolanaAddress(`solana:${USDC_MINT}?amount=1`)).toBe(USDC_MINT);
    expect(findSolanaAddress(`Pay me at ${USDC_MINT}, thanks`)).toBe(USDC_MINT);
  });

  it("takes none of two different addresses", () => {
    expect(findSolanaAddress(`${USDC_MINT} or ${TOKEN_PROGRAM}`)).toBeNull();
  });
});

describe("shortenSolanaAddress", () => {
  it("keeps four characters at each end", () => {
    expect(shortenSolanaAddress(USDC_MINT)).toBe("EPjF...Dt1v");
  });
});
