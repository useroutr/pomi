// A Stellar account address (strkey): 56 base32 characters encoding a version
// byte, a 32-byte ed25519 key and a CRC16-XModem checksum. Checking the
// checksum catches a mistyped or truncated paste before any money is sent to
// it. Muxed (M...) and contract (C...) addresses are refused: Useroutr pays a
// classic account.
const ACCOUNT_FORMAT = /^G[A-Z2-7]{55}$/;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ACCOUNT_VERSION_BYTE = 6 << 3;
const PAYLOAD_LENGTH = 33;

export class InvalidStellarAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStellarAccountError";
  }
}

export function parseStellarAccount(input: string): string {
  const address = input.trim().toUpperCase();
  if (!ACCOUNT_FORMAT.test(address)) {
    throw new InvalidStellarAccountError(
      "Enter a Stellar account address: 56 characters starting with G.",
    );
  }
  const bytes = decodeBase32(address);
  const payload = bytes.subarray(0, PAYLOAD_LENGTH);
  const checksum = (bytes[PAYLOAD_LENGTH] ?? 0) | ((bytes[PAYLOAD_LENGTH + 1] ?? 0) << 8);
  if (payload[0] !== ACCOUNT_VERSION_BYTE || crc16Xmodem(payload) !== checksum) {
    throw new InvalidStellarAccountError(
      "That address has a typo: its checksum does not match. Copy it again from your wallet.",
    );
  }
  return address;
}

export function shortenStellarAccount(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function decodeBase32(text: string): Uint8Array {
  const bytes = new Uint8Array(Math.floor((text.length * 5) / 8));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const character of text) {
    buffer = (buffer << 5) | BASE32_ALPHABET.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes[index] = (buffer >> bits) & 0xff;
      index += 1;
    }
  }
  return bytes;
}

function crc16Xmodem(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}
