import "server-only";
import { InvalidAmountError } from "@pomi/shared";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clientKey } from "../http/client-key";
import { errorResponse, requestErrorResponse, rethrow } from "../http/error-response";
import { readJsonBody } from "../http/json-request";
import { newId } from "../ids";
import {
  RequestAlreadyPaidError,
  RequestClosedError,
  RequestEndedError,
  RequestNotFoundError,
} from "../requests/request-errors";
import { useroutrErrorResponse } from "../requests/request-routes";
import { DestinationRefusedError } from "../useroutr/useroutr-gateway";
import { BelowMinimumError, CheckoutRateLimitedError } from "./checkout-errors";
import { type CheckoutService } from "./checkout-service";

export const VISITOR_COOKIE = "pomi_visitor";
const VISITOR_FORMAT = /^vis_[\w-]{22}$/;
const VISITOR_LIFETIME_SECONDS = 365 * 24 * 60 * 60;

const checkoutBodySchema = z.object({ amount: z.string().max(40).optional() });

export interface CheckoutRouteServices {
  checkout: Pick<CheckoutService, "startCheckout">;
  clientIpHeader: string | null;
  clientKeySecret: string;
}

// Anyone with the link may start the checkout: the request id is the secret,
// and the token returned grants only an intent for this request.
export async function handleStartCheckout(
  request: NextRequest,
  requestId: string,
  services: CheckoutRouteServices,
) {
  const knownVisitor = request.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId =
    knownVisitor !== undefined && VISITOR_FORMAT.test(knownVisitor) ? knownVisitor : newId("vis");
  try {
    const body = await readJsonBody(request, checkoutBodySchema);
    const started = await services.checkout.startCheckout(requestId, body.amount, {
      visitorId,
      clientKey: clientKey(request, services.clientIpHeader, services.clientKeySecret),
    });
    const response = NextResponse.json(started);
    if (visitorId !== knownVisitor) {
      response.cookies.set(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: VISITOR_LIFETIME_SECONDS,
      });
    }
    return response;
  } catch (error) {
    return checkoutErrorResponse(error) ?? requestErrorResponse(error) ?? rethrow(error);
  }
}

function checkoutErrorResponse(error: unknown) {
  if (error instanceof RequestNotFoundError) {
    return errorResponse(404, "not_found", error.message);
  }
  if (error instanceof RequestAlreadyPaidError) {
    return errorResponse(409, "request_paid", error.message);
  }
  if (error instanceof RequestClosedError) {
    return errorResponse(410, "request_closed", error.message);
  }
  if (error instanceof RequestEndedError) {
    return errorResponse(410, "request_ended", error.message);
  }
  if (error instanceof InvalidAmountError) {
    return errorResponse(400, "invalid_amount", error.message);
  }
  if (error instanceof BelowMinimumError) {
    return errorResponse(400, "below_minimum", error.message);
  }
  if (error instanceof CheckoutRateLimitedError) {
    return errorResponse(429, "rate_limited", error.message, {
      "retry-after": String(error.retryAfterSeconds),
    });
  }
  if (error instanceof DestinationRefusedError) {
    return errorResponse(
      422,
      "destination_refused",
      "The receiver's account cannot take this payment right now. Let them know.",
    );
  }
  return useroutrErrorResponse(error);
}
