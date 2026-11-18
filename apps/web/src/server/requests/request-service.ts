import "server-only";
import { assertAmountFits, parseRequestAmount } from "@pomi/shared";
import { type Database } from "../database";
import { newId } from "../ids";
import { PayoutAddressRequiredError } from "../payout-addresses/payout-address-errors";
import { activePayoutAddress } from "../payout-addresses/payout-address-repository";
import { type PayoutAddressService } from "../payout-addresses/payout-address-service";
import { ProfileNotFoundError } from "../profiles/profile-errors";
import {
  type CatalogAsset,
  type PaymentNetwork,
  type UseroutrGateway,
} from "../useroutr/useroutr-gateway";
import {
  InvalidEndDateError,
  InvalidMinimumError,
  InvalidNoteError,
  RequestAlreadyPaidError,
  RequestNotFoundError,
  UnsupportedAssetError,
} from "./request-errors";
import {
  closeOpenRequest,
  closePayBoxOf,
  insertFixedRequest,
  listedRequestsOf,
  openPayBoxForPayer,
  payBoxOf,
  requestForPayer,
  requestOwnedBy,
  requestsOf,
  savePayBox,
  setRequestListed,
  userByHandle,
} from "./request-repository";

// Phase 1 asks for these two (docs/spec.md, section 12.2), on every network
// Useroutr pays receivers on. The ids and networks come from Useroutr's own
// asset list, never from this file.
const REQUESTABLE_SYMBOLS: ReadonlySet<string> = new Set(["USDC", "XLM"]);
const NOTE_MAX_LENGTH = 280;

export type RequestStatus = "OPEN" | "PAID" | "CLOSED";
export type RequestKind = "SINGLE" | "REUSABLE";

export interface NewRequest {
  amount: string;
  assetId: string;
  note?: string | undefined;
  // Paid any number of times, instead of once like an invoice.
  reusable?: boolean | undefined;
  listed?: boolean | undefined;
  // An ISO 8601 date and time after which the request takes no payment.
  endsAt?: string | undefined;
}

export interface NewPayBox {
  assetId: string;
  // A fixed amount, or none for the payer's choice.
  amount?: string | undefined;
  // Only with the payer's choice.
  minimumAmount?: string | undefined;
}

export interface ReceiverRequest {
  id: string;
  kind: RequestKind;
  amount: string | null;
  assetSymbol: string;
  // Useroutr's network id for the asset: where the receiver is paid.
  assetNetwork: string;
  note: string | null;
  listed: boolean;
  status: RequestStatus;
  endsAt: Date | null;
  createdAt: Date;
  payments: {
    amount: string;
    creditedAt: Date;
    paymentTransactionHash: string | null;
    settlementTransactionHash: string | null;
  }[];
}

export interface PayerRequest {
  id: string;
  kind: RequestKind;
  // Null when the payer chooses the amount.
  amount: string | null;
  minimumAmount: string | null;
  assetSymbol: string;
  // Useroutr's network id for the asset: where the receiver is paid.
  assetNetwork: string;
  note: string | null;
  status: RequestStatus;
  // Past its end date: it takes no more payments.
  ended: boolean;
  receiverName: string | null;
  receiverHandle: string | null;
  payoutAddress: string;
  payoutAddressVerified: boolean;
}

export interface ReceiverPayBox {
  open: boolean;
  assetId: string;
  assetSymbol: string;
  // Useroutr's network id for the asset: where the receiver is paid.
  assetNetwork: string;
  amount: string | null;
  minimumAmount: string | null;
  payoutAddress: string;
}

export interface HandlePage {
  handle: string;
  displayName: string | null;
  payBox: PayerRequest | null;
  listedRequests: PayerRequest[];
}

export interface RequestServiceDependencies {
  database: Database;
  useroutr: Pick<UseroutrGateway, "assets" | "paymentNetworks">;
  payoutAddresses: Pick<PayoutAddressService, "assertCanReceive">;
  now?: () => Date;
}

export type RequestService = ReturnType<typeof createRequestService>;

export function createRequestService({
  database,
  useroutr,
  payoutAddresses,
  now = () => new Date(),
}: RequestServiceDependencies) {
  // Assets a receiver can be paid in: Useroutr pays them out, and Pomi can
  // check an address on their network.
  async function requestableAssets(): Promise<CatalogAsset[]> {
    const assets = await useroutr.assets();
    return assets.filter(
      (asset) =>
        asset.payout && asset.addressKind !== null && REQUESTABLE_SYMBOLS.has(asset.symbol),
    );
  }

  async function requestableAsset(assetId: string): Promise<CatalogAsset> {
    const asset = (await requestableAssets()).find((candidate) => candidate.id === assetId);
    if (asset === undefined) {
      throw new UnsupportedAssetError();
    }
    return asset;
  }

  // The receiver's current address on the asset's network, checked for the
  // asset at the moment it is attached to a request.
  async function payableAddress(userId: string, asset: CatalogAsset) {
    const payoutAddress = await activePayoutAddress(database, userId, asset.network);
    if (payoutAddress === null) {
      throw new PayoutAddressRequiredError(asset.network);
    }
    await payoutAddresses.assertCanReceive(payoutAddress.address, asset);
    return payoutAddress;
  }

  async function createRequest(userId: string, input: NewRequest): Promise<{ id: string }> {
    const amount = parseRequestAmount(input.amount);
    const note = parseNote(input.note);
    const endsAt = parseEndsAt(input.endsAt, now());
    const asset = await requestableAsset(input.assetId);
    assertAmountFits(amount, asset.decimals);
    const payoutAddress = await payableAddress(userId, asset);
    return insertFixedRequest(database, {
      id: newId("req"),
      userId,
      kind: input.reusable === true ? "REUSABLE" : "SINGLE",
      amount,
      assetId: asset.id,
      note,
      listed: input.listed === true,
      endsAt,
      payoutAddressId: payoutAddress.id,
      createdAt: now(),
    });
  }

  async function listRequests(userId: string): Promise<ReceiverRequest[]> {
    const [requests, details] = await Promise.all([requestsOf(database, userId), assetDetails()]);
    return requests.map((request) => ({
      id: request.id,
      kind: request.kind,
      amount: request.amount?.toString() ?? null,
      ...describeAsset(details, request.assetId),
      note: request.note,
      listed: request.listed,
      status: request.status,
      endsAt: request.endsAt,
      createdAt: request.createdAt,
      payments: request.payments.map((payment) => ({
        amount: payment.amount.toString(),
        creditedAt: payment.creditedAt,
        paymentTransactionHash: payment.paymentTransactionHash,
        settlementTransactionHash: payment.settlementTransactionHash,
      })),
    }));
  }

  async function payerRequest(requestId: string): Promise<PayerRequest | null> {
    const request = await requestForPayer(database, requestId);
    return request === null ? null : toPayerRequest(request, await assetDetails());
  }

  async function handlePage(handleInput: string): Promise<HandlePage> {
    const user = await userByHandle(database, handleInput.toLowerCase());
    if (user?.handle == null) {
      throw new ProfileNotFoundError();
    }
    const [payBox, listed, details] = await Promise.all([
      openPayBoxForPayer(database, user.id),
      listedRequestsOf(database, user.id, now()),
      assetDetails(),
    ]);
    return {
      handle: user.handle,
      displayName: user.displayName,
      payBox: payBox === null ? null : toPayerRequest(payBox, details),
      listedRequests: listed.map((request) => toPayerRequest(request, details)),
    };
  }

  async function updateRequest(
    userId: string,
    requestId: string,
    changes: { listed: boolean },
  ): Promise<void> {
    if (!(await setRequestListed(database, userId, requestId, changes.listed))) {
      throw new RequestNotFoundError();
    }
  }

  async function closeRequest(userId: string, requestId: string): Promise<void> {
    if (await closeOpenRequest(database, userId, requestId, now())) {
      return;
    }
    const request = await requestOwnedBy(database, userId, requestId);
    if (request === null) {
      throw new RequestNotFoundError();
    }
    if (request.status === "PAID") {
      throw new RequestAlreadyPaidError();
    }
    // Closing a closed request again changes nothing.
  }

  async function payBox(userId: string): Promise<ReceiverPayBox | null> {
    const [box, details] = await Promise.all([payBoxOf(database, userId), assetDetails()]);
    if (box === null) {
      return null;
    }
    return {
      open: box.status === "OPEN",
      assetId: box.assetId,
      ...describeAsset(details, box.assetId),
      amount: box.amount?.toString() ?? null,
      minimumAmount: box.minimumAmount?.toString() ?? null,
      payoutAddress: box.payoutAddress.address,
    };
  }

  // Saving the pay box also moves it to the receiver's current address.
  async function setPayBox(userId: string, input: NewPayBox): Promise<ReceiverPayBox> {
    const fixedAmount = isBlank(input.amount) ? null : parseRequestAmount(input.amount ?? "");
    const minimumAmount = parseMinimum(input.minimumAmount, fixedAmount);
    const asset = await requestableAsset(input.assetId);
    for (const amount of [fixedAmount, minimumAmount]) {
      if (amount !== null) {
        assertAmountFits(amount, asset.decimals);
      }
    }
    const payoutAddress = await payableAddress(userId, asset);
    await database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`paybox:${userId}`}, 0))`;
      await savePayBox(
        transaction,
        userId,
        {
          assetId: asset.id,
          amountKind: fixedAmount === null ? "OPEN" : "FIXED",
          amount: fixedAmount,
          minimumAmount,
          payoutAddressId: payoutAddress.id,
        },
        { id: newId("req"), createdAt: now() },
      );
    });
    const saved = await payBox(userId);
    if (saved === null) {
      throw new Error("the pay box was not saved");
    }
    return saved;
  }

  async function closePayBox(userId: string): Promise<void> {
    await closePayBoxOf(database, userId, now());
  }

  // The symbol and network are shown wherever an amount is; Useroutr's list
  // is the source of truth for both, and is cached by the gateway.
  async function assetDetails(): Promise<AssetDetails> {
    const assets = await useroutr.assets();
    return new Map(
      assets.map((asset) => [asset.id, { symbol: asset.symbol, network: asset.network }]),
    );
  }

  function toPayerRequest(
    request: NonNullable<Awaited<ReturnType<typeof requestForPayer>>>,
    details: AssetDetails,
  ): PayerRequest {
    return {
      id: request.id,
      kind: request.kind,
      amount: request.amount?.toString() ?? null,
      minimumAmount: request.minimumAmount?.toString() ?? null,
      ...describeAsset(details, request.assetId),
      note: request.note,
      status: request.status,
      ended: request.endsAt !== null && request.endsAt <= now(),
      // Never the email: a payer sees only what the receiver chose to show.
      receiverName: request.user.displayName ?? request.user.handle,
      receiverHandle: request.user.handle,
      payoutAddress: request.payoutAddress.address,
      payoutAddressVerified: request.payoutAddress.verifiedAt !== null,
    };
  }

  // Where a payer can pay from: Useroutr's catalog decides, so a network it
  // adds shows up here without a change to Pomi.
  function paymentNetworks(): Promise<PaymentNetwork[]> {
    return useroutr.paymentNetworks();
  }

  return {
    requestableAssets,
    paymentNetworks,
    createRequest,
    listRequests,
    payerRequest,
    handlePage,
    updateRequest,
    closeRequest,
    payBox,
    setPayBox,
    closePayBox,
  };
}

type AssetDetails = Map<string, { symbol: string; network: string }>;

// An asset Useroutr no longer lists is shown by its id. Every request made
// before other networks existed is on Stellar, so that is the fallback.
function describeAsset(
  details: AssetDetails,
  assetId: string,
): { assetSymbol: string; assetNetwork: string } {
  const asset = details.get(assetId);
  return { assetSymbol: asset?.symbol ?? assetId, assetNetwork: asset?.network ?? "stellar" };
}

function parseNote(input: string | undefined): string | null {
  const note = input?.trim() ?? "";
  if (note.length > NOTE_MAX_LENGTH) {
    throw new InvalidNoteError();
  }
  return note === "" ? null : note;
}

function parseEndsAt(input: string | undefined, now: Date): Date | null {
  if (isBlank(input)) {
    return null;
  }
  const endsAt = new Date(input ?? "");
  if (Number.isNaN(endsAt.getTime()) || endsAt <= now) {
    throw new InvalidEndDateError();
  }
  return endsAt;
}

// A minimum only makes sense when the payer chooses the amount.
function parseMinimum(input: string | undefined, fixedAmount: string | null): string | null {
  if (isBlank(input)) {
    return null;
  }
  if (fixedAmount !== null) {
    throw new InvalidMinimumError("A fixed amount has no minimum.");
  }
  return parseRequestAmount(input ?? "");
}

function isBlank(input: string | undefined): boolean {
  return input === undefined || input.trim() === "";
}
