import { createHmac } from "node:crypto";
import { type FundingIntentStatus } from "@useroutr/sdk";
import {
  type CreatedFundingIntent,
  type NewFundingIntent,
  type CatalogAsset,
  type PaymentNetwork,
  type UseroutrGateway,
} from "@/server/useroutr/useroutr-gateway";

export const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

function stellarAsset(id: string, symbol: string, issuer: string | null): CatalogAsset {
  return {
    id,
    symbol,
    network: "stellar",
    decimals: 7,
    payout: true,
    addressKind: "stellar",
    stellar: { code: symbol, issuer },
  };
}

function evmAsset(id: string, symbol: string, network: string, payout: boolean): CatalogAsset {
  return { id, symbol, network, decimals: 6, payout, addressKind: "evm", stellar: null };
}

// Stellar assets, USDC on Base that a rail pays out, and Base ETH that a payer
// may bring but a receiver cannot be paid in.
export const CATALOG_ASSETS: CatalogAsset[] = [
  stellarAsset("asset_usdc_stellar", "USDC", USDC_ISSUER),
  stellarAsset("asset_xlm_stellar", "XLM", null),
  stellarAsset("asset_eurc_stellar", "EURC", USDC_ISSUER),
  evmAsset("asset_usdc_base", "USDC", "base", true),
  evmAsset("asset_eth_base", "ETH", "base", false),
];

export const PAYMENT_NETWORKS: PaymentNetwork[] = [
  { network: "stellar", symbols: ["USDC", "XLM", "EURC"] },
  { network: "base", symbols: ["USDC", "ETH"] },
];

export const WEBHOOK_SECRET = "whsec_test_secret";

// Behaves as Useroutr does with idempotency keys: the same key returns the
// same intent, however many callers send it.
export class FakeUseroutr implements UseroutrGateway {
  readonly created = new Map<string, CreatedFundingIntent & { request: NewFundingIntent }>();
  readonly statuses = new Map<string, FundingIntentStatus>();
  createDelayMs = 0;
  expiresInMs = 30 * 60_000;
  now: () => Date = () => new Date();

  assets(): Promise<CatalogAsset[]> {
    return Promise.resolve(CATALOG_ASSETS);
  }

  paymentNetworks(): Promise<PaymentNetwork[]> {
    return Promise.resolve(PAYMENT_NETWORKS);
  }

  async createFundingIntent(intent: NewFundingIntent): Promise<CreatedFundingIntent> {
    const existing = this.created.get(intent.idempotencyKey);
    if (existing !== undefined) {
      return existing;
    }
    const number = this.created.size + 1;
    const created = {
      id: `fi_${String(number)}`,
      token: `token_${String(number)}`,
      expiresAt: new Date(this.now().getTime() + this.expiresInMs),
      request: intent,
    };
    this.created.set(intent.idempotencyKey, created);
    this.statuses.set(created.id, "AWAITING_PAYMENT");
    if (this.createDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.createDelayMs));
    }
    return created;
  }

  fundingIntentStatus(fundingIntentId: string): Promise<FundingIntentStatus> {
    const status = this.statuses.get(fundingIntentId);
    return status === undefined
      ? Promise.reject(new Error(`unknown intent ${fundingIntentId}`))
      : Promise.resolve(status);
  }

  constructWebhookEvent(): never {
    throw new Error("use the real gateway's constructWebhookEvent in webhook tests");
  }
}

// Signs a payload the way Useroutr does, for the headers of a test delivery.
export function signWebhook(
  payload: string,
  eventId: string,
  secret = WEBHOOK_SECRET,
  timestamp = Math.floor(Date.now() / 1000),
): string {
  const signature = createHmac("sha256", secret)
    .update(`${String(timestamp)}.${eventId}.`)
    .update(payload)
    .digest("hex");
  return `t=${String(timestamp)},v1=${signature}`;
}
