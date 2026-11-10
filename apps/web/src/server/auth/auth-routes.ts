import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { EmailDeliveryError } from "../email/email-delivery";
import { errorResponse, requestErrorResponse, rethrow } from "../http/error-response";
import { readJsonBody } from "../http/json-request";
import {
  InvalidEmailAddressError,
  InvalidSignInCodeError,
  SignInCodeRateLimitedError,
} from "./auth-errors";
import { type AuthService } from "./auth-service";
import { SESSION_COOKIE, sessionCookieOptions } from "./session-cookie";

const requestCodeBodySchema = z.object({ email: z.string().max(320) });
const verifyCodeBodySchema = z.object({ email: z.string().max(320), code: z.string().max(32) });

export async function handleRequestSignInCode(
  request: NextRequest,
  authService: Pick<AuthService, "requestSignInCode">,
): Promise<NextResponse> {
  try {
    const body = await readJsonBody(request, requestCodeBodySchema);
    await authService.requestSignInCode(body.email);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof InvalidEmailAddressError) {
      return errorResponse(400, "invalid_email", error.message);
    }
    if (error instanceof SignInCodeRateLimitedError) {
      return errorResponse(429, "rate_limited", error.message, {
        "retry-after": String(error.retryAfterSeconds),
      });
    }
    if (error instanceof EmailDeliveryError) {
      return errorResponse(
        503,
        "email_unavailable",
        "We could not send the email. Try again in a moment.",
      );
    }
    return requestErrorResponse(error) ?? rethrow(error);
  }
}

export async function handleVerifySignInCode(
  request: NextRequest,
  authService: Pick<AuthService, "verifySignInCode">,
): Promise<NextResponse> {
  try {
    const body = await readJsonBody(request, verifyCodeBodySchema);
    const grant = await authService.verifySignInCode(body.email, body.code);
    // The token goes only into the cookie, never the body, so page scripts
    // never see it.
    const response = NextResponse.json({ user: { handle: grant.user.handle } });
    response.cookies.set(SESSION_COOKIE, grant.token, sessionCookieOptions(grant.expiresAt));
    return response;
  } catch (error) {
    if (error instanceof InvalidEmailAddressError) {
      return errorResponse(400, "invalid_email", error.message);
    }
    if (error instanceof InvalidSignInCodeError) {
      return errorResponse(400, "invalid_code", error.message);
    }
    return requestErrorResponse(error) ?? rethrow(error);
  }
}

export async function handleSignOut(
  request: NextRequest,
  authService: Pick<AuthService, "signOut">,
): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token !== undefined) {
    await authService.signOut(token);
  }
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
