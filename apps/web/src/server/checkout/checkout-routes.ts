import "server-only";
import { NextResponse } from "next/server";
import { errorResponse, rethrow } from "../http/error-response";
import {
  RequestAlreadyPaidError,
  RequestClosedError,
  RequestNotFoundError,
} from "../requests/request-errors";
import { useroutrErrorResponse } from "../requests/request-routes";
import { DestinationRefusedError } from "../useroutr/useroutr-gateway";
import { type CheckoutService } from "./checkout-service";

// Anyone with the link may start the checkout: the request id is the secret,
// and the token returned grants only this request's intent.
export async function handleStartCheckout(
  requestId: string,
  checkout: Pick<CheckoutService, "startCheckout">,
) {
  try {
    return NextResponse.json(await checkout.startCheckout(requestId));
  } catch (error) {
    if (error instanceof RequestNotFoundError) {
      return errorResponse(404, "not_found", error.message);
    }
    if (error instanceof RequestAlreadyPaidError) {
      return errorResponse(409, "request_paid", error.message);
    }
    if (error instanceof RequestClosedError) {
      return errorResponse(410, "request_closed", error.message);
    }
    if (error instanceof DestinationRefusedError) {
      return errorResponse(
        422,
        "destination_refused",
        "The receiver's account cannot take this payment right now. Let them know.",
      );
    }
    return useroutrErrorResponse(error) ?? rethrow(error);
  }
}
