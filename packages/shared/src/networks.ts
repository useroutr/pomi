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
  starknet: "Starknet",
  monad: "Monad",
  hyperevm: "HyperEVM",
  tron: "Tron",
  lisk: "Lisk",
};

export function networkName(network: string): string {
  return NETWORK_NAMES[network] ?? network.charAt(0).toUpperCase() + network.slice(1);
}

// "Stellar", "Stellar and Base", "Stellar, Base and Arbitrum".
export function networkList(networks: string[]): string {
  return wordList(networks.map(networkName), "and");
}

// "XLM", "XLM or USDC", "XLM, USDC or EURC".
export function wordList(words: string[], conjunction: "and" | "or"): string {
  if (words.length <= 1) {
    return words.join("");
  }
  return `${words.slice(0, -1).join(", ")} ${conjunction} ${words[words.length - 1] ?? ""}`;
}
