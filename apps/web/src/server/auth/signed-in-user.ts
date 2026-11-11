import "server-only";
import { type NextRequest } from "next/server";
import { type AuthService, type SignedInUser } from "./auth-service";
import { SESSION_COOKIE } from "./session-cookie";

export class NotSignedInError extends Error {
  constructor() {
    super("Sign in to continue.");
    this.name = "NotSignedInError";
  }
}

// The web holds the session in its cookie; the mobile app sends the same
// kind of token as a bearer token. A page on another site can make a
// browser send the cookie, never the header.
export function sessionToken(request: NextRequest): string | undefined {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer ([\w-]+)$/)?.[1];
  return bearer ?? request.cookies.get(SESSION_COOKIE)?.value;
}

export async function signedInUser(
  request: NextRequest,
  authService: Pick<AuthService, "resolveSession">,
): Promise<SignedInUser> {
  const token = sessionToken(request);
  const user = token === undefined ? null : await authService.resolveSession(token);
  if (user === null) {
    throw new NotSignedInError();
  }
  return user;
}
