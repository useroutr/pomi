import { NextResponse } from "next/server";
import { InvalidRequestBodyError, UnsupportedContentTypeError } from "./json-request";

export type ErrorCode =
  | "unsupported_content_type"
  | "invalid_request"
  | "invalid_email"
  | "invalid_code"
  | "rate_limited"
  | "email_unavailable";

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
  return undefined;
}
