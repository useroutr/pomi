import "server-only";
import { createHash, randomBytes } from "node:crypto";

// 256 random bits, so a plain SHA-256 is enough to store: unlike a sign-in
// code, the token cannot be found by trying values.
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
