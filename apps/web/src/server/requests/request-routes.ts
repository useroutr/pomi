import "server-only";
import { InvalidAmountError } from "@pomi/shared";
import { UseroutrError } from "@useroutr/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { type AuthService } from "../auth/auth-service";
import { signedInUser } from "../auth/signed-in-user";
import { errorResponse, requestErrorResponse, rethrow } from "../http/error-response";
import { readJsonBody } from "../http/json-request";
import {
  PayoutAddressRequiredError,
  PayoutAssetNotTrustedError,
} from "../payout-addresses/payout-address-errors";
import { payoutAddressErrorResponse } from "../payout-addresses/payout-address-routes";
import {
  InvalidNoteError,
  RequestAlreadyPaidError,
  RequestNotFoundError,
  UnsupportedAssetError,
} from "./request-errors";
import { type RequestService } from "./request-service";

interface Services {
  auth: Pick<AuthService, "resolveSession">;
  requests: Pick<RequestService, "createRequest" | "listRequests" | "closeRequest">;
  appUrl: string;
}

const createRequestBodySchema = z.object({
  amount: z.string().max(40),
  assetId: z.string().max(100),
  note: z.string().max(1000).optional(),
});

export async function handleCreateRequest(request: NextRequest, services: Services) {
  try {
    const user = await signedInUser(request, services.auth);
    const body = await readJsonBody(request, createRequestBodySchema);
    const created = await services.requests.createRequest(user.id, body);
    return NextResponse.json(
      { request: { id: created.id, url: `${services.appUrl}/r/${created.id}` } },
      { status: 201 },
    );
  } catch (error) {
    return (
      createRequestErrorResponse(error) ??
      payoutAddressErrorResponse(error) ??
      requestErrorResponse(error) ??
      rethrow(error)
    );
  }
}

export async function handleListRequests(request: NextRequest, services: Services) {
  try {
    const user = await signedInUser(request, services.auth);
    return NextResponse.json({ requests: await services.requests.listRequests(user.id) });
  } catch (error) {
    return useroutrErrorResponse(error) ?? requestErrorResponse(error) ?? rethrow(error);
  }
}

export async function handleCloseRequest(
  request: NextRequest,
  requestId: string,
  services: Services,
) {
  try {
    const user = await signedInUser(request, services.auth);
    await services.requests.closeRequest(user.id, requestId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof RequestNotFoundError) {
      return errorResponse(404, "not_found", error.message);
    }
    if (error instanceof RequestAlreadyPaidError) {
      return errorResponse(409, "request_paid", error.message);
    }
    return requestErrorResponse(error) ?? rethrow(error);
  }
}

function createRequestErrorResponse(error: unknown) {
  if (error instanceof InvalidAmountError) {
    return errorResponse(400, "invalid_amount", error.message);
  }
  if (error instanceof InvalidNoteError) {
    return errorResponse(400, "invalid_note", error.message);
  }
  if (error instanceof UnsupportedAssetError) {
    return errorResponse(400, "unsupported_asset", error.message);
  }
  if (error instanceof PayoutAddressRequiredError) {
    return errorResponse(409, "payout_address_required", error.message);
  }
  if (error instanceof PayoutAssetNotTrustedError) {
    return errorResponse(422, "asset_not_trusted", error.message);
  }
  return useroutrErrorResponse(error);
}

export function useroutrErrorResponse(error: unknown) {
  if (error instanceof UseroutrError) {
    return errorResponse(
      503,
      "useroutr_unavailable",
      "Payments are unavailable right now. Try again in a moment.",
    );
  }
  return undefined;
}
