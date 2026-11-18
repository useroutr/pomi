// Stellar amounts are whole numbers of stroops (one ten-millionth of a unit)
// held in a signed 64-bit integer, so an amount with more decimal places, or
// above the largest int64, cannot be paid exactly to a Stellar account.
const STELLAR_DECIMALS = 7;
const MAX_STROOPS = 9_223_372_036_854_775_807n;
const DECIMAL_AMOUNT = /^(\d+)(?:\.(\d+))?$/;

export class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAmountError";
  }
}

// Turns what a receiver typed into the decimal string the backend stores and
// Useroutr expects: no sign, exponent or grouping, and no leading or trailing
// zeros. Trailing zeros are dropped before the decimal places are counted, so
// "1.50000000" is the exact amount 1.5.
export function parseRequestAmount(input: string): string {
  const match = DECIMAL_AMOUNT.exec(input.trim());
  if (match === null) {
    throw new InvalidAmountError("Enter an amount such as 25 or 12.50");
  }
  const whole = (match[1] ?? "").replace(/^0+(?=\d)/, "");
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  if (fraction.length > STELLAR_DECIMALS) {
    throw new InvalidAmountError(`Use at most ${String(STELLAR_DECIMALS)} decimal places`);
  }
  const stroops = BigInt(`${whole}${fraction.padEnd(STELLAR_DECIMALS, "0")}`);
  if (stroops === 0n) {
    throw new InvalidAmountError("The amount must be more than zero");
  }
  if (stroops > MAX_STROOPS) {
    throw new InvalidAmountError("The amount is larger than Stellar can hold");
  }
  return fraction === "" ? whole : `${whole}.${fraction}`;
}

// A parsed amount against the asset it is asked in: USDC on an EVM network
// has 6 decimal places, fewer than Stellar's 7, and an amount with more
// cannot be paid exactly there.
export function assertAmountFits(amount: string, decimals: number): void {
  const fraction = amount.split(".")[1] ?? "";
  if (fraction.length > decimals) {
    throw new InvalidAmountError(
      decimals === 0
        ? "Use a whole amount for this asset"
        : `Use at most ${String(decimals)} decimal places for this asset`,
    );
  }
}
