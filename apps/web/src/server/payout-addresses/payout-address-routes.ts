import "server-only";
import {
  InvalidEvmAddressError,
  InvalidSolanaAddressError,
  InvalidStarknetAddressError,
  InvalidStellarAccountError,
  InvalidTronAddressError,
} from "@pomi/shared";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { type AuthService } from "../auth/auth-service";
import { signedInUser } from "../auth/signed-in-user";
import { errorResponse, requestErrorResponse, rethrow } from "../http/error-response";
import { readJsonBody } from "../http/json-request";
import { type RequestService } from "../requests/request-service";
import { StellarNetworkUnavailableError } from "../stellar/horizon-account-reader";
import {
  PayoutAccountMissingError,
  PayoutAccountNeedsMemoError,
  PayoutNetworkUnsupportedError,
} from "./payout-address-errors";
import { type PayoutAddressService } from "./payout-address-service";

interface Services {
  auth: Pick<AuthService, "resolveSession">;
  payoutAddresses: Pick<
    PayoutAddressService,
    "payoutAddress" | "payoutAddresses" | "setPayoutAddress"
  >;
  requests: Pick<RequestService, "requestableAssets">;
}

const setPayoutAddressBodySchema = z.object({
  address: z.string().max(100),
  // Useroutr's network id; Stellar for clients that predate other networks.
  network: z
    .string()
    .regex(/^[a-z0-9-]{1,32}$/)
    .default("stellar"),
});

export async function handleGetPayoutAddress(request: NextRequest, services: Services) {
  try {
    const user = await signedInUser(request, services.auth);
    return NextResponse.json({
      payoutAddress: await services.payoutAddresses.payoutAddress(user.id),
    });
  } catch (error) {
    return requestErrorResponse(error) ?? rethrow(error);
  }
}

export async function handleListPayoutAddresses(request: NextRequest, services: Services) {
  try {
    const user = await signedInUser(request, services.auth);
    return NextResponse.json({
      payoutAddresses: await services.payoutAddresses.payoutAddresses(user.id),
    });
  } catch (error) {
    return requestErrorResponse(error) ?? rethrow(error);
  }
}

export async function handleSetPayoutAddress(request: NextRequest, services: Services) {
  try {
    const user = await signedInUser(request, services.auth);
    const body = await readJsonBody(request, setPayoutAddressBodySchema);
    // How an address is written comes from the network's assets in
    // Useroutr's list, and only a network Useroutr pays out on takes one.
    const asset = (await services.requests.requestableAssets()).find(
      (candidate) => candidate.network === body.network,
    );
    const addressKind = body.network === "stellar" ? "stellar" : asset?.addressKind;
    if (addressKind === undefined || addressKind === null) {
      throw new PayoutNetworkUnsupportedError(body.network);
    }
    return NextResponse.json({
      payoutAddress: await services.payoutAddresses.setPayoutAddress(user.id, body.address, {
        network: body.network,
        addressKind,
      }),
    });
  } catch (error) {
    return payoutAddressErrorResponse(error) ?? requestErrorResponse(error) ?? rethrow(error);
  }
}

interface ReadinessServices {
  auth: Pick<AuthService, "resolveSession">;
  payoutAddresses: Pick<PayoutAddressService, "readiness">;
  requests: Pick<RequestService, "requestableAssets">;
}

export async function handleGetPayoutReadiness(request: NextRequest, services: ReadinessServices) {
  try {
    const user = await signedInUser(request, services.auth);
    const assets = await services.requests.requestableAssets();
    return NextResponse.json(await services.payoutAddresses.readiness(user.id, assets));
  } catch (error) {
    return payoutAddressErrorResponse(error) ?? requestErrorResponse(error) ?? rethrow(error);
  }
}

export function payoutAddressErrorResponse(error: unknown) {
  if (
    error instanceof InvalidStellarAccountError ||
    error instanceof InvalidEvmAddressError ||
    error instanceof InvalidSolanaAddressError ||
    error instanceof InvalidTronAddressError ||
    error instanceof InvalidStarknetAddressError
  ) {
    return errorResponse(400, "invalid_address", error.message);
  }
  if (error instanceof PayoutNetworkUnsupportedError) {
    return errorResponse(422, "network_unsupported", error.message);
  }
  if (error instanceof PayoutAccountMissingError) {
    return errorResponse(422, "account_missing", error.message);
  }
  if (error instanceof PayoutAccountNeedsMemoError) {
    return errorResponse(422, "memo_required", error.message);
  }
  if (error instanceof StellarNetworkUnavailableError) {
    return errorResponse(
      503,
      "stellar_unavailable",
      "Stellar could not be reached to check the address. Try again in a moment.",
    );
  }
  return undefined;
}
