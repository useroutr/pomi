import "server-only";
import { parseRequestAmount } from "@pomi/shared";
import { type Database } from "../database";
import { newId } from "../ids";
import { PayoutAddressRequiredError } from "../payout-addresses/payout-address-errors";
import { activePayoutAddress } from "../payout-addresses/payout-address-repository";
import { type PayoutAddressService } from "../payout-addresses/payout-address-service";
import { ProfileNotFoundError } from "../profiles/profile-errors";
import { type StellarAsset, type UseroutrGateway } from "../useroutr/useroutr-gateway";
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

// Phase 1 asks for these two (docs/spec.md, section 12.2). The ids come
// from Useroutr's own asset list, never from this file.
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
  useroutr: Pick<UseroutrGateway, "stellarAssets">;
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
  async function requestableAssets(): Promise<StellarAsset[]> {
    const assets = await useroutr.stellarAssets();
    return assets.filter((asset) => REQUESTABLE_SYMBOLS.has(asset.symbol));
  }

  async function requestableAsset(assetId: string): Promise<StellarAsset> {
    const asset = (await requestableAssets()).find((candidate) => candidate.id === assetId);
    if (asset === undefined) {
      throw new UnsupportedAssetError();
    }
    return asset;
  }

  // The receiver's current address, checked on Stellar for the asset at the
  // moment it is attached to a request.
  async function payableAddress(userId: string, asset: StellarAsset) {
    const payoutAddress = await activePayoutAddress(database, userId);
    if (payoutAddress === null) {
      throw new PayoutAddressRequiredError();
    }
    await payoutAddresses.assertCanReceive(payoutAddress.address, asset);
    return payoutAddress;
  }

  async function createRequest(userId: string, input: NewRequest): Promise<{ id: string }> {
    const amount = parseRequestAmount(input.amount);
    const note = parseNote(input.note);
    const endsAt = parseEndsAt(input.endsAt, now());
    const asset = await requestableAsset(input.assetId);
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
    const [requests, symbols] = await Promise.all([requestsOf(database, userId), assetSymbols()]);
    return requests.map((request) => ({
      id: request.id,
      kind: request.kind,
      amount: request.amount?.toString() ?? null,
      assetSymbol: symbols.get(request.assetId) ?? request.assetId,
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
    return request === null ? null : toPayerRequest(request, await assetSymbols());
  }

  async function handlePage(handleInput: string): Promise<HandlePage> {
    const user = await userByHandle(database, handleInput.toLowerCase());
    if (user?.handle == null) {
      throw new ProfileNotFoundError();
    }
    const [payBox, listed, symbols] = await Promise.all([
      openPayBoxForPayer(database, user.id),
      listedRequestsOf(database, user.id, now()),
      assetSymbols(),
    ]);
    return {
      handle: user.handle,
      displayName: user.displayName,
      payBox: payBox === null ? null : toPayerRequest(payBox, symbols),
      listedRequests: listed.map((request) => toPayerRequest(request, symbols)),
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
    const [box, symbols] = await Promise.all([payBoxOf(database, userId), assetSymbols()]);
    if (box === null) {
      return null;
    }
    return {
      open: box.status === "OPEN",
      assetId: box.assetId,
      assetSymbol: symbols.get(box.assetId) ?? box.assetId,
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

  // The symbol is shown wherever an amount is; Useroutr's list is the
  // source of truth for it, and is cached by the gateway.
  async function assetSymbols(): Promise<Map<string, string>> {
    const assets = await useroutr.stellarAssets();
    return new Map(assets.map((asset) => [asset.id, asset.symbol]));
  }

  function toPayerRequest(
    request: NonNullable<Awaited<ReturnType<typeof requestForPayer>>>,
    symbols: Map<string, string>,
  ): PayerRequest {
    return {
      id: request.id,
      kind: request.kind,
      amount: request.amount?.toString() ?? null,
      minimumAmount: request.minimumAmount?.toString() ?? null,
      assetSymbol: symbols.get(request.assetId) ?? request.assetId,
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

  return {
    requestableAssets,
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
