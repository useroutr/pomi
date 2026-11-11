import { type StellarNetwork } from "../config";

export class PayoutAccountMissingError extends Error {
  constructor(network: StellarNetwork) {
    super(
      `This account does not exist on the Stellar ${network} yet. Send it at least 1 XLM to open it, then try again.`,
    );
    this.name = "PayoutAccountMissingError";
  }
}

// Useroutr pays without a memo, and a payment to an exchange's shared
// account without one cannot be credited to the receiver.
export class PayoutAccountNeedsMemoError extends Error {
  constructor() {
    super(
      "This address asks senders for a memo, which usually means it belongs to an exchange. Pomi pays without a memo, so use an address from your own wallet.",
    );
    this.name = "PayoutAccountNeedsMemoError";
  }
}

export class PayoutAssetNotTrustedError extends Error {
  constructor(symbol: string, issuer: string) {
    super(
      `Your payout account cannot hold ${symbol} yet. In your wallet, add ${symbol} from issuer ${issuer} as a trusted asset, then try again.`,
    );
    this.name = "PayoutAssetNotTrustedError";
  }
}

export class PayoutAddressRequiredError extends Error {
  constructor() {
    super("Add the Stellar address you want to be paid at first.");
    this.name = "PayoutAddressRequiredError";
  }
}
