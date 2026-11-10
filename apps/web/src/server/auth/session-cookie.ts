export const SESSION_COOKIE = "pomi_session";

// HttpOnly keeps the token from page scripts. SameSite=Lax keeps it off
// cross-site POSTs, which with JSON-only routes is the app's CSRF defence.
export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  } as const;
}
