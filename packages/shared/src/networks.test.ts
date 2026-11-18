import { describe, expect, it } from "vitest";
import { networkList, networkName, wordList } from "./networks";

describe("networkName", () => {
  it("names the networks Pomi knows, and any other after its id", () => {
    expect(networkName("bsc")).toBe("BNB Chain");
    expect(networkName("hyperevm")).toBe("HyperEVM");
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

describe("wordList", () => {
  it("writes a list the way a sentence would", () => {
    expect(wordList(["XLM"], "or")).toBe("XLM");
    expect(wordList(["XLM", "USDC"], "or")).toBe("XLM or USDC");
    expect(wordList(["XLM", "USDC", "EURC"], "and")).toBe("XLM, USDC and EURC");
  });
});
