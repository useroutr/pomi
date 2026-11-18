import { type CatalogAsset } from "./useroutr-gateway";

// What Pomi shows for an asset id: its symbol and network, read from
// Useroutr's catalog.
export type AssetDetails = Map<string, { symbol: string; network: string }>;

export function assetDetailsOf(assets: CatalogAsset[]): AssetDetails {
  return new Map(
    assets.map((asset) => [asset.id, { symbol: asset.symbol, network: asset.network }]),
  );
}

// An asset Useroutr no longer lists is shown by its id. Every request made
// before other networks existed is on Stellar, so that is the fallback.
export function describeAsset(
  details: AssetDetails,
  assetId: string,
): { assetSymbol: string; assetNetwork: string } {
  const asset = details.get(assetId);
  return { assetSymbol: asset?.symbol ?? assetId, assetNetwork: asset?.network ?? "stellar" };
}
