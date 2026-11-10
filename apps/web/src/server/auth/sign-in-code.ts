import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

const CODE_DIGITS = 6;
const CODE_FORMAT = /^\d{6}$/;

export function generateSignInCode(): string {
  return randomInt(0, 10 ** CODE_DIGITS)
    .toString()
    .padStart(CODE_DIGITS, "0");
}

// People paste codes with spaces, or type them in groups.
export function normalizeSignInCode(input: string): string | undefined {
  const code = input.replace(/\s/g, "");
  return CODE_FORMAT.test(code) ? code : undefined;
}

// Keyed, and bound to the address: an unkeyed hash of six digits is reversed
// by trying all million.
export function hashSignInCode(secret: string, email: string, code: string): string {
  return createHmac("sha256", secret).update(`${email}\n${code}`).digest("hex");
}

export function signInCodeMatches(
  secret: string,
  email: string,
  code: string,
  codeHash: string,
): boolean {
  const candidate = Buffer.from(hashSignInCode(secret, email, code), "hex");
  const stored = Buffer.from(codeHash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}
