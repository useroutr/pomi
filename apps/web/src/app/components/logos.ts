import ArbitrumNetwork from "@web3icons/core/svgs/networks/background/arbitrum-one.svg.js";
import AvalancheNetwork from "@web3icons/core/svgs/networks/background/avalanche.svg.js";
import BaseNetwork from "@web3icons/core/svgs/networks/background/base.svg.js";
import BnbNetwork from "@web3icons/core/svgs/networks/background/binance-smart-chain.svg.js";
import EthereumNetwork from "@web3icons/core/svgs/networks/background/ethereum.svg.js";
import OptimismNetwork from "@web3icons/core/svgs/networks/background/optimism.svg.js";
import PolygonNetwork from "@web3icons/core/svgs/networks/background/polygon.svg.js";
import SolanaNetwork from "@web3icons/core/svgs/networks/background/solana.svg.js";
import StellarNetwork from "@web3icons/core/svgs/networks/background/stellar.svg.js";
import AQUA from "@web3icons/core/svgs/tokens/background/AQUA.svg.js";
import BLND from "@web3icons/core/svgs/tokens/background/BLND.svg.js";
import ETH from "@web3icons/core/svgs/tokens/background/ETH.svg.js";
import EURC from "@web3icons/core/svgs/tokens/background/EURC.svg.js";
import USDC from "@web3icons/core/svgs/tokens/background/USDC.svg.js";
import USDT from "@web3icons/core/svgs/tokens/background/USDT.svg.js";
import XLM from "@web3icons/core/svgs/tokens/background/XLM.svg.js";
import Coinbase from "@web3icons/core/svgs/wallets/background/coinbase.svg.js";
import Lobstr from "@web3icons/core/svgs/wallets/background/lobstr.svg.js";
import MetaMask from "@web3icons/core/svgs/wallets/background/metamask.svg.js";
import Varial from "@web3icons/core/svgs/wallets/background/varial.svg.js";

// Logos from web3icons (MIT), the "background" set: each mark on its own
// brand color. Shown as images, never inlined, since a mark's SVG ids are
// not unique across logos.
const NETWORKS: Record<string, string> = {
  stellar: StellarNetwork,
  ethereum: EthereumNetwork,
  base: BaseNetwork,
  arbitrum: ArbitrumNetwork,
  optimism: OptimismNetwork,
  polygon: PolygonNetwork,
  avalanche: AvalancheNetwork,
  bsc: BnbNetwork,
  solana: SolanaNetwork,
};

const TOKENS: Record<string, string> = { USDC, XLM, ETH, USDT, EURC, BLND, AQUA };

const WALLETS: Record<string, string> = {
  lobstr: Lobstr,
  varial: Varial,
  metamask: MetaMask,
  coinbase: Coinbase,
};

function dataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function networkLogo(network: string): string | null {
  const svg = NETWORKS[network];
  return svg === undefined ? null : dataUri(svg);
}

export function tokenLogo(symbol: string): string | null {
  const svg = TOKENS[symbol.toUpperCase()];
  return svg === undefined ? null : dataUri(svg);
}

export function walletLogo(wallet: string): string | null {
  const svg = WALLETS[wallet];
  return svg === undefined ? null : dataUri(svg);
}
