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

export async function signedInUser(
  request: NextRequest,
  authService: Pick<AuthService, "resolveSession">,
): Promise<SignedInUser> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = token === undefined ? null : await authService.resolveSession(token);
  if (user === null) {
    throw new NotSignedInError();
  }
  return user;
}
