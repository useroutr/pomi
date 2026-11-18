import { decodeBase58 } from "./base58";

// A Solana account address: a 32-byte public key written in base58, 32 to
// 44 characters. It carries no checksum, so a mistyped address that still
// decodes to 32 bytes cannot be told apart from a real one; the app says so
// beside it.
const ADDRESS_FORMAT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ADDRESS_IN_TEXT =
  /(?:^|[^1-9A-HJ-NP-Za-km-z])([1-9A-HJ-NP-Za-km-z]{32,44})(?![1-9A-HJ-NP-Za-km-z])/g;
const KEY_LENGTH = 32;

export class InvalidSolanaAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSolanaAddressError";
  }
}

export function parseSolanaAddress(input: string): string {
  const address = input.trim();
  if (!ADDRESS_FORMAT.test(address) || decodeBase58(address)?.length !== KEY_LENGTH) {
    throw new InvalidSolanaAddressError(
      "Enter a Solana address: 32 to 44 letters and digits, as your wallet shows it.",
    );
  }
  return address;
}

// The one valid address in whatever was copied or scanned: the address alone,
// a sentence around it, or a payment link (solana:<address>?amount=1). Two
// different addresses are ambiguous, so neither is taken.
export function findSolanaAddress(text: string): string | null {
  const addresses = new Set<string>();
  for (const match of text.matchAll(ADDRESS_IN_TEXT)) {
    const candidate = match[1];
    if (candidate !== undefined && decodeBase58(candidate)?.length === KEY_LENGTH) {
      addresses.add(candidate);
    }
  }
  const [address] = addresses;
  return addresses.size === 1 && address !== undefined ? address : null;
}

// As Solana wallets shorten it: the first four characters and the last four.
export function shortenSolanaAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
