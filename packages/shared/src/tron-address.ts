import { sha256 } from "@noble/hashes/sha2.js";
import { decodeBase58 } from "./base58";

// A Tron account address: T and 33 base58 characters, writing a 0x41 prefix,
// a 20-byte account and a 4-byte checksum (the first bytes of SHA-256 taken
// twice). Checking the checksum catches a mistyped or truncated paste before
// any money is sent to it.
const ADDRESS_FORMAT = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const ADDRESS_IN_TEXT =
  /(?:^|[^1-9A-HJ-NP-Za-km-z])(T[1-9A-HJ-NP-Za-km-z]{33})(?![1-9A-HJ-NP-Za-km-z])/g;
const PREFIX = 0x41;
const PAYLOAD_LENGTH = 21;
const CHECKSUM_LENGTH = 4;

export class InvalidTronAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTronAddressError";
  }
}

export function parseTronAddress(input: string): string {
  const address = input.trim();
  if (!ADDRESS_FORMAT.test(address)) {
    throw new InvalidTronAddressError("Enter a Tron address: 34 characters starting with T.");
  }
  if (!checksumMatches(address)) {
    throw new InvalidTronAddressError(
      "That address has a typo: its checksum does not match. Copy it again from your wallet.",
    );
  }
  return address;
}

// The one valid address in whatever was copied or scanned. Two different
// valid addresses are ambiguous, so neither is taken.
export function findTronAddress(text: string): string | null {
  const addresses = new Set<string>();
  for (const match of text.matchAll(ADDRESS_IN_TEXT)) {
    const candidate = match[1];
    if (candidate !== undefined && checksumMatches(candidate)) {
      addresses.add(candidate);
    }
  }
  const [address] = addresses;
  return addresses.size === 1 && address !== undefined ? address : null;
}

// As Tron wallets shorten it: the first six characters and the last four.
export function shortenTronAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function checksumMatches(address: string): boolean {
  const bytes = decodeBase58(address);
  if (bytes?.length !== PAYLOAD_LENGTH + CHECKSUM_LENGTH || bytes[0] !== PREFIX) {
    return false;
  }
  const payload = bytes.subarray(0, PAYLOAD_LENGTH);
  const expected = sha256(sha256(payload)).subarray(0, CHECKSUM_LENGTH);
  return expected.every((byte, index) => byte === bytes[PAYLOAD_LENGTH + index]);
}
