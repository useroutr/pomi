import { parseEvmAddress, shortenEvmAddress } from "./evm-address";
import { parseSolanaAddress, shortenSolanaAddress } from "./solana-address";
import { parseStarknetAddress, shortenStarknetAddress } from "./starknet-address";
import { parseStellarAccount, shortenStellarAccount } from "./stellar-account";
import { parseTronAddress, shortenTronAddress } from "./tron-address";

// How a network writes its account addresses.
export type AddressKind = "stellar" | "evm" | "solana" | "tron" | "starknet";

// Networks that write addresses their own way, keyed by Useroutr's network
// id. Useroutr's asset list does not say how a network writes addresses, so
// Pomi names these; any other network whose tokens are EVM contracts is an
// EVM chain (Base, Arbitrum, Monad, BNB Chain and the rest).
const OWN_FORMATS: Readonly<Record<string, AddressKind>> = {
  stellar: "stellar",
  solana: "solana",
  tron: "tron",
  starknet: "starknet",
};

// What an address field says while an address is typed: a placeholder, and a
// hint for when what is typed is not an address yet.
export const ADDRESS_WRITING: Readonly<Record<AddressKind, { placeholder: string; hint: string }>> =
  {
    stellar: { placeholder: "G…", hint: "A Stellar address is 56 characters and starts with G." },
    evm: { placeholder: "0x…", hint: "An address is 0x followed by 40 letters and digits." },
    solana: {
      placeholder: "Your Solana address",
      hint: "A Solana address is 32 to 44 letters and digits.",
    },
    tron: { placeholder: "T…", hint: "A Tron address is 34 characters and starts with T." },
    starknet: {
      placeholder: "0x…",
      hint: "A Starknet address is 0x followed by up to 64 letters and digits.",
    },
  };

// The address kind of a network that writes addresses its own way, or null
// for one that does not, which is an EVM chain if Pomi pays out on it at all.
export function ownAddressKind(network: string): AddressKind | null {
  return OWN_FORMATS[network] ?? null;
}

// How addresses are written on a network Pomi pays out on.
export function addressKindOf(network: string): AddressKind {
  return ownAddressKind(network) ?? "evm";
}

// Checks an address the way its network writes it and returns it as that
// network's wallets show it. Each kind throws its own error.
export function parseAddress(kind: AddressKind, input: string): string {
  switch (kind) {
    case "stellar":
      return parseStellarAccount(input);
    case "evm":
      return parseEvmAddress(input);
    case "solana":
      return parseSolanaAddress(input);
    case "tron":
      return parseTronAddress(input);
    case "starknet":
      return parseStarknetAddress(input);
  }
}

// An account address on a network, shortened the way that network's wallets
// show it.
export function shortenAddress(network: string, address: string): string {
  switch (addressKindOf(network)) {
    case "stellar":
      return shortenStellarAccount(address);
    case "evm":
      return shortenEvmAddress(address);
    case "solana":
      return shortenSolanaAddress(address);
    case "tron":
      return shortenTronAddress(address);
    case "starknet":
      return shortenStarknetAddress(address);
  }
}
