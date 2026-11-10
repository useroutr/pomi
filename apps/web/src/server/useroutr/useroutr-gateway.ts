import "server-only";
import {
  constructWebhookEvent,
  type FundingIntentStatus,
  Useroutr,
  UseroutrError,
  type WebhookEvent,
} from "@useroutr/sdk";

export interface StellarAsset {
  id: string;
  symbol: string;
  code: string;
  // Null for XLM, the native asset.
  issuer: string | null;
}

export interface NewFundingIntent {
  amount: string;
  assetId: string;
  payoutAddress: string;
  reference: string;
  idempotencyKey: string;
}

export interface CreatedFundingIntent {
  id: string;
  // Grants the payer's browser this one intent and nothing else.
  token: string;
  expiresAt: Date;
}

export interface UseroutrGateway {
  stellarAssets(): Promise<StellarAsset[]>;
  createFundingIntent(intent: NewFundingIntent): Promise<CreatedFundingIntent>;
  fundingIntentStatus(fundingIntentId: string): Promise<FundingIntentStatus>;
  constructWebhookEvent(
    payload: string,
    signatureHeader: string | undefined,
    eventId: string | undefined,
  ): WebhookEvent;
}

export class DestinationRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DestinationRefusedError";
  }
}

export class UseroutrResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UseroutrResponseError";
  }
}

export interface UseroutrGatewayOptions {
  apiKey: string;
  apiUrl: string;
  webhookSecret: string;
  // For tests: a client with a stubbed transport.
  client?: Useroutr;
  sleep?: (milliseconds: number) => Promise<void>;
}

const ASSET_CACHE_MS = 10 * 60_000;
const IN_PROGRESS_RETRIES = 5;
const IN_PROGRESS_DELAY_MS = 300;

export function createUseroutrGateway(options: UseroutrGatewayOptions): UseroutrGateway {
  const client =
    options.client ?? new Useroutr({ apiKey: options.apiKey, baseUrl: options.apiUrl });
  const sleep =
    options.sleep ??
    ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let cachedAssets: { assets: StellarAsset[]; fetchedAt: number } | undefined;

  async function stellarAssets(): Promise<StellarAsset[]> {
    if (cachedAssets !== undefined && Date.now() - cachedAssets.fetchedAt < ASSET_CACHE_MS) {
      return cachedAssets.assets;
    }
    const catalog = await client.assets.list();
    const assets = catalog.data.flatMap((asset) =>
      "stellar_asset" in asset
        ? [{ id: asset.id, symbol: asset.symbol, code: asset.code, issuer: asset.issuer }]
        : [],
    );
    cachedAssets = { assets, fetchedAt: Date.now() };
    return assets;
  }

  async function createFundingIntent(intent: NewFundingIntent): Promise<CreatedFundingIntent> {
    // Every field is derived from the request, never from the clock, so two
    // visitors sending the same key send the same body and Useroutr replays
    // one intent to both instead of refusing the second.
    const body = {
      amount: intent.amount,
      asset: intent.assetId,
      destination: { network: "stellar", asset: intent.assetId, address: intent.payoutAddress },
      reference: intent.reference,
    };
    for (let attempt = 1; ; attempt += 1) {
      try {
        const created = await client.fundingIntents.create(body, {
          idempotencyKey: intent.idempotencyKey,
        });
        return {
          id: created.id,
          token: fundingToken(created.hosted_funding_url),
          expiresAt: new Date(created.expires_at),
        };
      } catch (error) {
        // Another visitor's identical request is still running; its answer
        // will be replayed to this one once it finishes.
        if (
          error instanceof UseroutrError &&
          error.code === "IDEMPOTENCY_REQUEST_IN_PROGRESS" &&
          attempt < IN_PROGRESS_RETRIES
        ) {
          await sleep(IN_PROGRESS_DELAY_MS * attempt);
          continue;
        }
        if (error instanceof UseroutrError && error.code === "INVALID_DESTINATION") {
          throw new DestinationRefusedError(error.message);
        }
        throw error;
      }
    }
  }

  async function fundingIntentStatus(fundingIntentId: string): Promise<FundingIntentStatus> {
    const fundingIntent = await client.fundingIntents.retrieve(fundingIntentId);
    return fundingIntent.status;
  }

  return {
    stellarAssets,
    createFundingIntent,
    fundingIntentStatus,
    constructWebhookEvent: (payload, signatureHeader, eventId) =>
      constructWebhookEvent({
        payload,
        signatureHeader,
        eventId,
        secret: options.webhookSecret,
      }),
  };
}

// The token is the last segment of the hosted funding page's address.
function fundingToken(hostedFundingUrl: string | null): string {
  const token = hostedFundingUrl?.split("/").at(-1);
  if (token === undefined || token === "") {
    throw new UseroutrResponseError("Useroutr returned a funding intent without a funding page");
  }
  return token;
}
