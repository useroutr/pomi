import { networkName } from "@pomi/shared";
import Arbitrum from "@web3icons/core/svgs/networks/background/arbitrum-one.svg.js";
import Avalanche from "@web3icons/core/svgs/networks/background/avalanche.svg.js";
import Base from "@web3icons/core/svgs/networks/background/base.svg.js";
import BinanceSmartChain from "@web3icons/core/svgs/networks/background/binance-smart-chain.svg.js";
import Ethereum from "@web3icons/core/svgs/networks/background/ethereum.svg.js";
import Optimism from "@web3icons/core/svgs/networks/background/optimism.svg.js";
import Polygon from "@web3icons/core/svgs/networks/background/polygon.svg.js";
import Solana from "@web3icons/core/svgs/networks/background/solana.svg.js";
import Stellar from "@web3icons/core/svgs/networks/background/stellar.svg.js";

export { networkList } from "@pomi/shared";

export interface NetworkInfo {
  name: string;
  // A web3icons network mark (MIT), or null for a network Pomi has no logo
  // for yet: it then shows a monogram.
  logo: string | null;
}

// Network marks keyed by Useroutr's network id. Useroutr decides which
// networks exist; this only says how each one looks. A network missing here
// still shows, under its name and a monogram.
const LOGOS: Record<string, string> = {
  stellar: Stellar,
  ethereum: Ethereum,
  base: Base,
  arbitrum: Arbitrum,
  optimism: Optimism,
  polygon: Polygon,
  avalanche: Avalanche,
  bsc: BinanceSmartChain,
  solana: Solana,
};

export function networkInfo(network: string): NetworkInfo {
  return { name: networkName(network), logo: LOGOS[network] ?? null };
}
