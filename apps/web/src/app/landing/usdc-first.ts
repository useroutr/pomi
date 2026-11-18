// The page's examples are in USDC, so the ask card opens on it and lists it
// first; the rest keep the order Useroutr lists them in.
export function usdcFirst<Asset extends { symbol: string }>(assets: readonly Asset[]): Asset[] {
  return [
    ...assets.filter((asset) => asset.symbol === "USDC"),
    ...assets.filter((asset) => asset.symbol !== "USDC"),
  ];
}
