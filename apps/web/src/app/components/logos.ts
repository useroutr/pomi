import ArbitrumNetwork from "@web3icons/core/svgs/networks/background/arbitrum-one.svg.js";
import AvalancheNetwork from "@web3icons/core/svgs/networks/background/avalanche.svg.js";
import BaseNetwork from "@web3icons/core/svgs/networks/background/base.svg.js";
import BnbNetwork from "@web3icons/core/svgs/networks/background/binance-smart-chain.svg.js";
import EthereumNetwork from "@web3icons/core/svgs/networks/background/ethereum.svg.js";
import HyperEvmNetwork from "@web3icons/core/svgs/networks/background/hyper-evm.svg.js";
import LiskNetwork from "@web3icons/core/svgs/networks/background/lisk.svg.js";
import MonadNetwork from "@web3icons/core/svgs/networks/background/monad.svg.js";
import OptimismNetwork from "@web3icons/core/svgs/networks/background/optimism.svg.js";
import PolygonNetwork from "@web3icons/core/svgs/networks/background/polygon.svg.js";
import SolanaNetwork from "@web3icons/core/svgs/networks/background/solana.svg.js";
import StarknetNetwork from "@web3icons/core/svgs/networks/background/starknet.svg.js";
import StellarNetwork from "@web3icons/core/svgs/networks/background/stellar.svg.js";
import TronNetwork from "@web3icons/core/svgs/networks/background/tron.svg.js";
import AQUA from "@web3icons/core/svgs/tokens/background/AQUA.svg.js";
import ARB from "@web3icons/core/svgs/tokens/background/ARB.svg.js";
import AVAX from "@web3icons/core/svgs/tokens/background/AVAX.svg.js";
import BLND from "@web3icons/core/svgs/tokens/background/BLND.svg.js";
import BNB from "@web3icons/core/svgs/tokens/background/BNB.svg.js";
import CBBTC from "@web3icons/core/svgs/tokens/background/CBBTC.svg.js";
import DAI from "@web3icons/core/svgs/tokens/background/DAI.svg.js";
import ETH from "@web3icons/core/svgs/tokens/background/ETH.svg.js";
import EURC from "@web3icons/core/svgs/tokens/background/EURC.svg.js";
import LINK from "@web3icons/core/svgs/tokens/background/LINK.svg.js";
import POL from "@web3icons/core/svgs/tokens/background/POL.svg.js";
import PYUSD from "@web3icons/core/svgs/tokens/background/PYUSD.svg.js";
import SOL from "@web3icons/core/svgs/tokens/background/SOL.svg.js";
import STRK from "@web3icons/core/svgs/tokens/background/STRK.svg.js";
import TRX from "@web3icons/core/svgs/tokens/background/TRX.svg.js";
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
  starknet: StarknetNetwork,
  monad: MonadNetwork,
  hyperevm: HyperEvmNetwork,
  tron: TronNetwork,
  lisk: LiskNetwork,
};

// The same marks as the app's (apps/mobile/src/components/asset-logo.tsx).
// Monad's coin wears the network's own mark.
const TOKENS: Record<string, string> = {
  USDC,
  USDT,
  DAI,
  EURC,
  PYUSD,
  XLM,
  ETH,
  SOL,
  BNB,
  AVAX,
  POL,
  STRK,
  TRX,
  ARB,
  LINK,
  CBBTC,
  MON: MonadNetwork,
  AQUA,
  BLND,
};

// Wrapped and bridged forms carry the mark of the asset they stand for, as
// wallets show them.
const SAME_MARK_AS: Record<string, string> = { WETH: "ETH", WMON: "MON", USDT0: "USDT" };

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
  const upper = symbol.toUpperCase();
  const svg = TOKENS[SAME_MARK_AS[upper] ?? upper];
  return svg === undefined ? null : dataUri(svg);
}

export function walletLogo(wallet: string): string | null {
  const svg = WALLETS[wallet];
  return svg === undefined ? null : dataUri(svg);
}
