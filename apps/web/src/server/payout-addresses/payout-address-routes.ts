import "server-only";
import { InvalidStellarAccountError } from "@pomi/shared";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { type AuthService } from "../auth/auth-service";
import { signedInUser } from "../auth/signed-in-user";
import { errorResponse, requestErrorResponse, rethrow } from "../http/error-response";
import { readJsonBody } from "../http/json-request";
import { StellarNetworkUnavailableError } from "../stellar/horizon-account-reader";
import { PayoutAccountMissingError, PayoutAccountNeedsMemoError } from "./payout-address-errors";
import { type PayoutAddressService } from "./payout-address-service";

interface Services {
  auth: Pick<AuthService, "resolveSession">;
  payoutAddresses: Pick<PayoutAddressService, "payoutAddress" | "setPayoutAddress">;
}

const setPayoutAddressBodySchema = z.object({ address: z.string().max(100) });

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

export async function handleSetPayoutAddress(request: NextRequest, services: Services) {
  try {
    const user = await signedInUser(request, services.auth);
    const body = await readJsonBody(request, setPayoutAddressBodySchema);
    return NextResponse.json({
      payoutAddress: await services.payoutAddresses.setPayoutAddress(user.id, body.address),
    });
  } catch (error) {
    return payoutAddressErrorResponse(error) ?? requestErrorResponse(error) ?? rethrow(error);
  }
}

export function payoutAddressErrorResponse(error: unknown) {
  if (error instanceof InvalidStellarAccountError) {
    return errorResponse(400, "invalid_address", error.message);
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
