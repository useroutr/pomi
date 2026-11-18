import {
  findEvmAddress,
  findStellarAccount,
  parseEvmAddress,
  parseStellarAccount,
  shortenEvmAddress,
  shortenStellarAccount,
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
  placeholder: "G…",
  hint: "A Stellar address is 56 characters and starts with G.",
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
  placeholder: "0x…",
  hint: "An address is 0x followed by 40 letters and digits.",
  autoCapitalize: "none",
};

// Stellar writes accounts its own way; every other network Useroutr pays out
// on today is an EVM chain (Base, Arbitrum, Ethereum and the rest).
export function addressFormat(network: string): AddressFormat {
  return network === "stellar" ? STELLAR : EVM;
}

function passes(parse: (text: string) => string, text: string): boolean {
  try {
    parse(text);
    return true;
  } catch {
    return false;
  }
}
