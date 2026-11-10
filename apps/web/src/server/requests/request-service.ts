import "server-only";
import { parseRequestAmount } from "@pomi/shared";
import { type Database } from "../database";
import { newId } from "../ids";
import { PayoutAddressRequiredError } from "../payout-addresses/payout-address-errors";
import { activePayoutAddress } from "../payout-addresses/payout-address-repository";
import { type PayoutAddressService } from "../payout-addresses/payout-address-service";
import { type StellarAsset, type UseroutrGateway } from "../useroutr/useroutr-gateway";
import {
  InvalidNoteError,
  RequestAlreadyPaidError,
  RequestNotFoundError,
  UnsupportedAssetError,
} from "./request-errors";
import {
  closeOpenRequest,
  insertSingleRequest,
  requestForPayer,
  requestOwnedBy,
  requestsOf,
} from "./request-repository";

// The first milestone asks for these two (docs/spec.md, section 12.2). The
// ids come from Useroutr's own asset list, never from this file.
const REQUESTABLE_SYMBOLS: ReadonlySet<string> = new Set(["USDC", "XLM"]);
const NOTE_MAX_LENGTH = 280;

export type RequestStatus = "OPEN" | "PAID" | "CLOSED";

export interface NewRequest {
  amount: string;
  assetId: string;
  note?: string | undefined;
}

export interface ReceiverRequest {
  id: string;
  // Null for a request where the payer chooses the amount.
  amount: string | null;
  assetSymbol: string;
  note: string | null;
  status: RequestStatus;
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
  amount: string | null;
  assetSymbol: string;
  note: string | null;
  status: RequestStatus;
  receiverName: string | null;
  payoutAddress: string;
  payoutAddressVerified: boolean;
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

  async function createRequest(userId: string, input: NewRequest): Promise<{ id: string }> {
    const amount = parseRequestAmount(input.amount);
    const note = parseNote(input.note);
    const asset = (await requestableAssets()).find((candidate) => candidate.id === input.assetId);
    if (asset === undefined) {
      throw new UnsupportedAssetError();
    }
    const payoutAddress = await activePayoutAddress(database, userId);
    if (payoutAddress === null) {
      throw new PayoutAddressRequiredError();
    }
    await payoutAddresses.assertCanReceive(payoutAddress.address, asset);
    return insertSingleRequest(database, {
      id: newId("req"),
      userId,
      amount,
      assetId: asset.id,
      note,
      payoutAddressId: payoutAddress.id,
      createdAt: now(),
    });
  }

  async function listRequests(userId: string): Promise<ReceiverRequest[]> {
    const [requests, symbols] = await Promise.all([requestsOf(database, userId), assetSymbols()]);
    return requests.map((request) => ({
      id: request.id,
      amount: request.amount?.toString() ?? null,
      assetSymbol: symbols.get(request.assetId) ?? request.assetId,
      note: request.note,
      status: request.status,
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
    if (request === null) {
      return null;
    }
    const symbols = await assetSymbols();
    return {
      id: request.id,
      amount: request.amount?.toString() ?? null,
      assetSymbol: symbols.get(request.assetId) ?? request.assetId,
      note: request.note,
      status: request.status,
      // Never the email: a payer sees only what the receiver chose to show.
      receiverName: request.user.displayName ?? request.user.handle,
      payoutAddress: request.payoutAddress.address,
      payoutAddressVerified: request.payoutAddress.verifiedAt !== null,
    };
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

  // The symbol is shown wherever an amount is; Useroutr's list is the
  // source of truth for it, and is cached by the gateway.
  async function assetSymbols(): Promise<Map<string, string>> {
    const assets = await useroutr.stellarAssets();
    return new Map(assets.map((asset) => [asset.id, asset.symbol]));
  }

  return { requestableAssets, createRequest, listRequests, payerRequest, closeRequest };
}

function parseNote(input: string | undefined): string | null {
  const note = input?.trim() ?? "";
  if (note.length > NOTE_MAX_LENGTH) {
    throw new InvalidNoteError();
  }
  return note === "" ? null : note;
}
