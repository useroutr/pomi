import { describe, expect, it } from "vitest";
import {
  InvalidStellarAccountError,
  parseStellarAccount,
  shortenStellarAccount,
} from "./stellar-account";

// Real accounts: SDF's mainnet distribution account and a testnet account.
const ACCOUNT = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const OTHER_ACCOUNT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

describe("parseStellarAccount", () => {
  it.each([ACCOUNT, OTHER_ACCOUNT])("accepts %s", (address) => {
    expect(parseStellarAccount(address)).toBe(address);
  });

  it("trims and uppercases a pasted address", () => {
    expect(parseStellarAccount(`  ${ACCOUNT.toLowerCase()}\n`)).toBe(ACCOUNT);
  });

  it("refuses an address with one character changed", () => {
    const typo = `${ACCOUNT.slice(0, 10)}${ACCOUNT[10] === "A" ? "B" : "A"}${ACCOUNT.slice(11)}`;

    expect(() => parseStellarAccount(typo)).toThrow(/checksum/);
  });

  it.each([
    ["an empty string", ""],
    ["a truncated address", ACCOUNT.slice(0, 55)],
    ["a contract address", `C${ACCOUNT.slice(1)}`],
    ["a muxed address", "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAGZE"],
    ["a secret key", "SBEKHUB5XLRG2O45FMBKMJT2ZTMRDBVBDKA6KHHHFUEWNEZ7ZZE4QW3O"],
  ])("refuses %s", (_case, input) => {
    expect(() => parseStellarAccount(input)).toThrow(InvalidStellarAccountError);
  });
});

describe("shortenStellarAccount", () => {
  it("keeps the first and last four characters", () => {
    expect(shortenStellarAccount(ACCOUNT)).toBe("GA5Z...KZVN");
  });
});
