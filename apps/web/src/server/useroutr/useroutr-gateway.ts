import "server-only";
import { type AddressKind, ownAddressKind } from "@pomi/shared";
import {
  constructWebhookEvent,
  type FundingIntentStatus,
  Useroutr,
  UseroutrError,
  type WebhookEvent,
} from "@useroutr/sdk";

// One entry of Useroutr's asset list, as Pomi uses it.
export interface CatalogAsset {
  id: string;
  symbol: string;
  // Useroutr's network id, such as "stellar", "base" or "arbitrum".
  network: string;
  decimals: number;
  // Whether a request can pay a receiver in this asset. Every Stellar asset
  // can; an asset on another network when Useroutr says one of its rails
  // delivers it there.
  payout: boolean;
  // How an address on this asset's network is written, to check the
  // receiver's; null for a kind Pomi cannot check yet.
  addressKind: AddressKind | null;
  // A Stellar asset's identity, for trustline checks; null elsewhere.
  stellar: { code: string; issuer: string | null } | null;
}

const EVM_CONTRACT = /^0x[0-9a-fA-F]{40}$/;

// A network a payer can pay from, with the assets Useroutr accepts on it.
// Payers can bring any of these, whatever the receiver is paid in.
export interface PaymentNetwork {
  // Useroutr's network id, such as "stellar", "base" or "arbitrum".
  network: string;
  symbols: string[];
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
  assets(): Promise<CatalogAsset[]>;
  paymentNetworks(): Promise<PaymentNetwork[]>;
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
// Useroutr opens a deposit account and registers the intent on Stellar
// before it answers: over 30 seconds on testnet, past the SDK's default
// timeout. A visitor arriving meanwhile waits as long for the same answer.
const CREATE_TIMEOUT_MS = 90_000;
const IN_PROGRESS_WAIT_MS = 90_000;
const IN_PROGRESS_MAX_DELAY_MS = 15_000;

export function createUseroutrGateway(options: UseroutrGatewayOptions): UseroutrGateway {
  const client =
    options.client ?? new Useroutr({ apiKey: options.apiKey, baseUrl: options.apiUrl });
  const sleep =
    options.sleep ??
    ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  type ListedAsset = Awaited<ReturnType<typeof client.assets.list>>["data"][number];
  let cachedCatalog: { assets: CatalogAsset[]; fetchedAt: number } | undefined;

  async function assets(): Promise<CatalogAsset[]> {
    if (cachedCatalog !== undefined && Date.now() - cachedCatalog.fetchedAt < ASSET_CACHE_MS) {
      return cachedCatalog.assets;
    }
    const listed = await client.assets.list();
    const catalog = listed.data.map(toCatalogAsset);
    cachedCatalog = { assets: catalog, fetchedAt: Date.now() };
    return catalog;
  }

  function toCatalogAsset(asset: ListedAsset): CatalogAsset {
    const base = {
      id: asset.id,
      symbol: asset.symbol,
      network: asset.network,
      decimals: asset.decimals,
    };
    if ("stellar_asset" in asset) {
      return {
        ...base,
        payout: true,
        addressKind: "stellar",
        stellar: { code: asset.code, issuer: asset.issuer },
      };
    }
    return {
      ...base,
      // Read as Useroutr lists it, so a network it starts paying out to needs
      // no change here.
      payout: "destination" in asset && asset.destination === true,
      // A network Pomi knows to write addresses its own way, or else an EVM
      // chain when its tokens are EVM contracts. Any other network takes no
      // address until Pomi learns how it writes one.
      addressKind:
        ownAddressKind(asset.network) ?? (EVM_CONTRACT.test(asset.contract) ? "evm" : null),
      stellar: null,
    };
  }

  async function paymentNetworks(): Promise<PaymentNetwork[]> {
    const byNetwork = new Map<string, Set<string>>();
    for (const asset of await assets()) {
      const symbols = byNetwork.get(asset.network) ?? new Set<string>();
      symbols.add(asset.symbol);
      byNetwork.set(asset.network, symbols);
    }
    return Array.from(byNetwork, ([network, symbols]) => ({ network, symbols: [...symbols] }));
  }

  async function createFundingIntent(intent: NewFundingIntent): Promise<CreatedFundingIntent> {
    const asset = (await assets()).find((candidate) => candidate.id === intent.assetId);
    if (asset === undefined) {
      throw new UseroutrResponseError(`Useroutr no longer lists ${intent.assetId}`);
    }
    // Every field is derived from the request, never from the clock, so two
    // visitors sending the same key send the same body and Useroutr replays
    // one intent to both instead of refusing the second.
    const body = {
      amount: intent.amount,
      asset: intent.assetId,
      destination: { network: asset.network, asset: intent.assetId, address: intent.payoutAddress },
      reference: intent.reference,
    };
    let waitedMs = 0;
    for (let attempt = 1; ; attempt += 1) {
      try {
        const created = await client.fundingIntents.create(body, {
          idempotencyKey: intent.idempotencyKey,
          timeoutMs: CREATE_TIMEOUT_MS,
        });
        return {
          id: created.id,
          token: fundingToken(created.hosted_funding_url),
          expiresAt: new Date(created.expires_at),
        };
      } catch (error) {
        // Another visitor's identical request is still running; its answer
        // will be replayed to this one once it finishes.
        const delayMs = Math.min(1000 * 2 ** (attempt - 1), IN_PROGRESS_MAX_DELAY_MS);
        if (
          error instanceof UseroutrError &&
          error.code === "IDEMPOTENCY_REQUEST_IN_PROGRESS" &&
          waitedMs + delayMs <= IN_PROGRESS_WAIT_MS
        ) {
          await sleep(delayMs);
          waitedMs += delayMs;
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
    assets,
    paymentNetworks,
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
