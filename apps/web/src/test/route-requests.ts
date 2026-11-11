import { NextRequest } from "next/server";
import { z } from "zod";
import { type SignedInUser } from "@/server/auth/auth-service";

export const SIGNED_IN: SignedInUser = { id: "usr_1", email: "receiver@example.com", handle: null };

// Resolves the session cookie "pomi_session=valid" to SIGNED_IN, and
// anything else to no one.
export const fakeAuth = {
  resolveSession: (token: string) => Promise.resolve(token === "valid" ? SIGNED_IN : null),
};

export function apiRequest(
  path: string,
  init: { method?: string; body?: unknown; signedIn?: boolean } = {},
): NextRequest {
  const headers = new Headers();
  if (init.signedIn ?? true) {
    headers.set("cookie", "pomi_session=valid");
  }
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  return new NextRequest(`http://localhost:3000${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

const errorBodySchema = z.object({ error: z.object({ code: z.string() }) });

export async function errorCode(response: Response): Promise<string | undefined> {
  return errorBodySchema.safeParse(await response.json()).data?.error.code;
}
