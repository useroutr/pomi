import { describe, expect, it } from "vitest";
import { usdcFirst } from "./usdc-first";

describe("usdcFirst", () => {
  it("puts every USDC first, each group in the order it was listed", () => {
    const assets = [
      { symbol: "XLM", network: "stellar" },
      { symbol: "USDC", network: "stellar" },
      { symbol: "EURC", network: "stellar" },
      { symbol: "USDC", network: "base" },
    ];

    expect(usdcFirst(assets)).toEqual([
      { symbol: "USDC", network: "stellar" },
      { symbol: "USDC", network: "base" },
      { symbol: "XLM", network: "stellar" },
      { symbol: "EURC", network: "stellar" },
    ]);
  });

  it("keeps the order when there is no USDC", () => {
    const assets = [{ symbol: "XLM" }, { symbol: "EURC" }];

    expect(usdcFirst(assets)).toEqual([{ symbol: "XLM" }, { symbol: "EURC" }]);
  });

  it("leaves the list it was given untouched", () => {
    const assets = [{ symbol: "XLM" }, { symbol: "USDC" }];

    usdcFirst(assets);

    expect(assets).toEqual([{ symbol: "XLM" }, { symbol: "USDC" }]);
  });
});
