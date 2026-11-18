import {
  ADDRESS_WRITING,
  addressKindOf,
  type AddressKind,
  findEvmAddress,
  findSolanaAddress,
  findStarknetAddress,
  findStellarAccount,
  findTronAddress,
  parseEvmAddress,
  parseSolanaAddress,
  parseStarknetAddress,
  parseStellarAccount,
  parseTronAddress,
  shortenEvmAddress,
  shortenSolanaAddress,
  shortenStarknetAddress,
  shortenStellarAccount,
  shortenTronAddress,
} from "@pomi/shared";

// How an account address is written on a network, so a paste, a scan or a
// typed address is checked on the phone before it is sent. The server checks
// it again and decides which networks take an address at all.
export interface AddressFormat {
  find: (text: string) => string | null;
  isValid: (text: string) => boolean;
  // What the field keeps while someone types or pastes.
  normalize: (text: string) => string;
  shorten: (address: string) => string;
  // Whether the address in this text carries a checksum, so a mistyped one
  // would have been refused.
  carriesChecksum: (text: string) => boolean;
  // Said beside an address that carries none, naming the network.
  noChecksum: (networkName: string) => string;
  placeholder: string;
  // Shown under the field while what is typed is not an address yet.
  hint: string;
  autoCapitalize: "characters" | "none";
}

const STELLAR: AddressFormat = {
  find: findStellarAccount,
  isValid: (text) => passes(parseStellarAccount, text),
  normalize: (text) => findStellarAccount(text) ?? text.trim().toUpperCase(),
  shorten: shortenStellarAccount,
  // Every Stellar address ends in a checksum.
  carriesChecksum: () => true,
  noChecksum: () => "",
  ...ADDRESS_WRITING.stellar,
  autoCapitalize: "characters",
};

const EVM: AddressFormat = {
  find: findEvmAddress,
  isValid: (text) => passes(parseEvmAddress, text),
  normalize: (text) => findEvmAddress(text) ?? text.trim(),
  shorten: shortenEvmAddress,
  // Only a mixed-case EVM address carries one (EIP-55).
  carriesChecksum: (text) => {
    const digits = /0x([0-9a-fA-F]{40})/.exec(text)?.[1] ?? "";
    return /[a-f]/.test(digits) && /[A-F]/.test(digits);
  },
  noChecksum: (name) =>
    `Written all in one case, so it has no checksum and Pomi can't catch a typo. Compare it with your wallet before you share a ${name} request.`,
  ...ADDRESS_WRITING.evm,
  autoCapitalize: "none",
};

const SOLANA: AddressFormat = {
  find: findSolanaAddress,
  isValid: (text) => passes(parseSolanaAddress, text),
  normalize: (text) => findSolanaAddress(text) ?? text.trim(),
  shorten: shortenSolanaAddress,
  // A Solana address is a bare key in base58, with nothing to check it by.
  carriesChecksum: () => false,
  noChecksum: () =>
    "Solana addresses carry no checksum, so Pomi can't catch a typo. Compare it with your wallet before you share a Solana request.",
  ...ADDRESS_WRITING.solana,
  autoCapitalize: "none",
};

const TRON: AddressFormat = {
  find: findTronAddress,
  isValid: (text) => passes(parseTronAddress, text),
  normalize: (text) => findTronAddress(text) ?? text.trim(),
  shorten: shortenTronAddress,
  // Every Tron address ends in a checksum.
  carriesChecksum: () => true,
  noChecksum: () => "",
  ...ADDRESS_WRITING.tron,
  autoCapitalize: "none",
};

const STARKNET: AddressFormat = {
  find: findStarknetAddress,
  isValid: (text) => passes(parseStarknetAddress, text),
  normalize: (text) => findStarknetAddress(text) ?? text.trim(),
  shorten: shortenStarknetAddress,
  // Pomi does not check Starknet's own checksum.
  carriesChecksum: () => false,
  noChecksum: () =>
    "Pomi can't check a Starknet address for typos. Compare it with your wallet before you share a Starknet request.",
  ...ADDRESS_WRITING.starknet,
  autoCapitalize: "none",
};

const FORMATS: Record<AddressKind, AddressFormat> = {
  stellar: STELLAR,
  evm: EVM,
  solana: SOLANA,
  tron: TRON,
  starknet: STARKNET,
};

// Stellar, Solana, Tron and Starknet write accounts their own way; every
// other network Pomi pays out on is an EVM chain (Base, Arbitrum, Monad and
// the rest).
export function addressFormat(network: string): AddressFormat {
  return FORMATS[addressKindOf(network)];
}

function passes(parse: (text: string) => string, text: string): boolean {
  try {
    parse(text);
    return true;
  } catch {
    return false;
  }
}
