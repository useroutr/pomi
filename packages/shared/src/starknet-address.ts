// A Starknet account address: a field element written as 0x and up to 64 hex
// digits, below 2^251 like every contract address there. Wallets pad it to
// 64 digits, and so does Pomi. Pomi does not check Starknet's own mixed-case
// checksum, so an address in any case is taken as it is and the app says a
// typo cannot be caught.
const ADDRESS_FORMAT = /^0x[0-9a-fA-F]{1,64}$/;
const ADDRESS_IN_TEXT = /(?:^|[^0-9a-zA-Z])(0x[0-9a-fA-F]{50,64})(?![0-9a-zA-Z])/g;
const ADDRESS_BOUND = 2n ** 251n;

export class InvalidStarknetAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStarknetAddressError";
  }
}

export function parseStarknetAddress(input: string): string {
  const address = input.trim();
  if (!ADDRESS_FORMAT.test(address)) {
    throw new InvalidStarknetAddressError(
      "Enter a Starknet address: 0x followed by up to 64 letters and digits.",
    );
  }
  const value = BigInt(address);
  if (value === 0n || value >= ADDRESS_BOUND) {
    throw new InvalidStarknetAddressError(
      "That isn't a Starknet account address. Copy it again from your wallet.",
    );
  }
  return `0x${value.toString(16).padStart(64, "0")}`;
}

// The one valid address in whatever was copied or scanned. Starknet addresses
// are copied at full length, so a short hex string is not taken for one.
export function findStarknetAddress(text: string): string | null {
  const addresses = new Set<string>();
  for (const match of text.matchAll(ADDRESS_IN_TEXT)) {
    const candidate = match[1];
    if (candidate === undefined) {
      continue;
    }
    try {
      addresses.add(parseStarknetAddress(candidate));
    } catch {
      // Out of range: not an account address.
    }
  }
  const [address] = addresses;
  return addresses.size === 1 && address !== undefined ? address : null;
}

// As Starknet wallets shorten it: 0x and the first four digits, then the last
// four.
export function shortenStarknetAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
