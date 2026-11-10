import "server-only";
import { randomBytes } from "node:crypto";

// 128 random bits. A request's id is the only secret in its link, so ids are
// never sequential or guessable.
export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString("base64url")}`;
}
