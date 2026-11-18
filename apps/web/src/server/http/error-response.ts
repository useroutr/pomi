import { NextResponse } from "next/server";
import { NotSignedInError } from "../auth/signed-in-user";
import { InvalidRequestBodyError, UnsupportedContentTypeError } from "./json-request";

export type ErrorCode =
  | "unsupported_content_type"
  | "invalid_request"
  | "invalid_email"
  | "invalid_code"
  | "rate_limited"
  | "email_unavailable"
  | "not_signed_in"
  | "invalid_address"
  | "account_missing"
  | "memo_required"
  | "asset_not_trusted"
  | "payout_address_required"
  | "invalid_amount"
  | "invalid_note"
  | "unsupported_asset"
  | "not_found"
  | "request_paid"
  | "request_closed"
  | "request_ended"
  | "below_minimum"
  | "invalid_end_date"
  | "invalid_minimum"
  | "handle_taken"
  | "handle_claimed"
  | "invalid_handle"
  | "invalid_display_name"
  | "invalid_push_token"
  | "destination_refused"
  | "stellar_unavailable"
  | "useroutr_unavailable";

export interface ErrorBody {
  error: { code: ErrorCode; message: string };
}

export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  headers?: HeadersInit,
): NextResponse<ErrorBody> {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

// Undefined for anything else, which the caller rethrows: Next answers an
// unexpected error with a bare 500 and logs it on the server.
export function requestErrorResponse(error: unknown): NextResponse<ErrorBody> | undefined {
  if (error instanceof UnsupportedContentTypeError) {
    return errorResponse(415, "unsupported_content_type", error.message);
  }
  if (error instanceof InvalidRequestBodyError) {
    return errorResponse(400, "invalid_request", error.message);
  }
  if (error instanceof NotSignedInError) {
    return errorResponse(401, "not_signed_in", error.message);
  }
  return undefined;
}

export function rethrow(error: unknown): never {
  throw error;
}
