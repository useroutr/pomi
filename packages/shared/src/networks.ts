import { shortenEvmAddress } from "./evm-address";
import { shortenStellarAccount } from "./stellar-account";

// How Pomi names the networks Useroutr lists, keyed by Useroutr's network id.
// Useroutr decides which networks exist; a network missing here is named
// after its id.
const NETWORK_NAMES: Record<string, string> = {
  stellar: "Stellar",
  ethereum: "Ethereum",
  base: "Base",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  polygon: "Polygon",
  avalanche: "Avalanche",
  bsc: "BNB Chain",
  solana: "Solana",
};

export function networkName(network: string): string {
  return NETWORK_NAMES[network] ?? network.charAt(0).toUpperCase() + network.slice(1);
}

// An account address on a network, shortened the way that network's wallets
// show it. Every network Pomi pays out on other than Stellar is an EVM chain.
export function shortenAddress(network: string, address: string): string {
  return network === "stellar" ? shortenStellarAccount(address) : shortenEvmAddress(address);
}

// "Stellar", "Stellar and Base", "Stellar, Base and Arbitrum".
export function networkList(networks: string[]): string {
  const names = networks.map(networkName);
  if (names.length <= 1) {
    return names.join("");
  }
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1] ?? ""}`;
}
