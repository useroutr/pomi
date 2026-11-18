import { describe, expect, it } from "vitest";
import { networkList, networkName, shortenAddress } from "./networks";

describe("networkName", () => {
  it("names the networks Pomi knows, and any other after its id", () => {
    expect(networkName("bsc")).toBe("BNB Chain");
    expect(networkName("stellar")).toBe("Stellar");
    expect(networkName("zksync")).toBe("Zksync");
  });
});

describe("networkList", () => {
  it.each([
    [[], ""],
    [["stellar"], "Stellar"],
    [["stellar", "base"], "Stellar and Base"],
    [["stellar", "base", "arbitrum"], "Stellar, Base and Arbitrum"],
  ])("lists %j as %j", (networks, expected) => {
    expect(networkList(networks)).toBe(expected);
  });
});

describe("shortenAddress", () => {
  it("shortens each network's address the way its wallets do", () => {
    expect(
      shortenAddress("stellar", "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"),
    ).toBe("GA5Z...KZVN");
    expect(shortenAddress("base", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed")).toBe(
      "0x5aAe...eAed",
    );
  });
});
