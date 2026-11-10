import "server-only";
import { cookies } from "next/headers";
import { authService } from "../app-services";
import { type SignedInUser } from "./auth-service";
import { SESSION_COOKIE } from "./session-cookie";

// For server components and server actions. Route handlers read the cookie
// from their request instead.
export async function currentUser(): Promise<SignedInUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token === undefined ? null : authService().resolveSession(token);
}
