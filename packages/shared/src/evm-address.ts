import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

// An EVM account address (Base, Arbitrum, Ethereum and the rest): 0x and 40
// hex digits. Mixed case carries an EIP-55 checksum, so a mistyped or
// truncated paste is caught before money is sent to it; an address written
// in one case has none and is taken as it is. Returned checksummed, the way
// wallets and explorers show it.
const ADDRESS_FORMAT = /^0x[0-9a-fA-F]{40}$/;
const ADDRESS_IN_TEXT = /(?:^|[^0-9a-zA-Z])(0x[0-9a-fA-F]{40})(?![0-9a-zA-Z])/g;

export class InvalidEvmAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidEvmAddressError";
  }
}

export function parseEvmAddress(input: string): string {
  const address = input.trim();
  if (!ADDRESS_FORMAT.test(address)) {
    throw new InvalidEvmAddressError(
      "Enter a wallet address: 0x followed by 40 letters and digits.",
    );
  }
  const digits = address.slice(2);
  const checksummed = checksumAddress(digits);
  const singleCase = digits === digits.toLowerCase() || digits === digits.toUpperCase();
  if (!singleCase && address !== checksummed) {
    throw new InvalidEvmAddressError(
      "That address has a typo: its checksum does not match. Copy it again from your wallet.",
    );
  }
  return checksummed;
}

// The one valid address in whatever was copied or scanned: the address alone,
// a sentence around it, or a payment link (ethereum:0x...@8453). Two different
// addresses are ambiguous, so neither is taken.
export function findEvmAddress(text: string): string | null {
  const addresses = new Set<string>();
  for (const match of text.matchAll(ADDRESS_IN_TEXT)) {
    const candidate = match[1];
    if (candidate === undefined) {
      continue;
    }
    try {
      addresses.add(parseEvmAddress(candidate));
    } catch {
      // A candidate that fails its checksum is a typo, not the address.
    }
  }
  const [address] = addresses;
  return addresses.size === 1 && address !== undefined ? address : null;
}

// As wallets shorten it: 0x and the first four digits, then the last four.
export function shortenEvmAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function checksumAddress(digits: string): string {
  const lower = digits.toLowerCase();
  const hash = bytesToHex(keccak_256(utf8ToBytes(lower)));
  let result = "0x";
  for (let index = 0; index < lower.length; index += 1) {
    const character = lower.charAt(index);
    result += Number.parseInt(hash.charAt(index), 16) >= 8 ? character.toUpperCase() : character;
  }
  return result;
}
