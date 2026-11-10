import "server-only";
import { type Database } from "../database";
import { type EmailDelivery } from "../email/email-delivery";
import { newId } from "../ids";
import { InvalidSignInCodeError, SignInCodeRateLimitedError } from "./auth-errors";
import {
  consumeSignInCode,
  insertSession,
  insertSignInCode,
  liveSessionUser,
  lockSignInCodes,
  newestSignInCode,
  recordSignInAttempt,
  revokeSession,
  signInCodeTimesSince,
  upsertUserByEmail,
} from "./auth-repository";
import { parseEmailAddress } from "./email-address";
import { generateSessionToken, hashSessionToken } from "./session-token";
import {
  generateSignInCode,
  hashSignInCode,
  normalizeSignInCode,
  signInCodeMatches,
} from "./sign-in-code";
import { signInEmail } from "./sign-in-email";

const MINUTE_MS = 60_000;
const CODE_LIFETIME_MINUTES = 10;
const MAX_ATTEMPTS_PER_CODE = 5;
// Per address: one code a minute, five an hour. Codes cost the sender's
// reputation, and an address should not be flooded by someone else.
const CODE_INTERVAL_MS = MINUTE_MS;
const CODES_PER_HOUR = 5;
const SESSION_LIFETIME_MS = 30 * 24 * 60 * MINUTE_MS;

export interface SignedInUser {
  id: string;
  email: string;
  handle: string | null;
}

export interface NewSessionGrant {
  token: string;
  expiresAt: Date;
  user: SignedInUser;
}

export interface AuthServiceDependencies {
  database: Database;
  emailDelivery: EmailDelivery;
  authSecret: string;
  now?: () => Date;
}

export type AuthService = ReturnType<typeof createAuthService>;

export function createAuthService({
  database,
  emailDelivery,
  authSecret,
  now = () => new Date(),
}: AuthServiceDependencies) {
  async function requestSignInCode(emailInput: string): Promise<void> {
    const email = parseEmailAddress(emailInput);
    const code = generateSignInCode();
    const issuedAt = now();
    await database.$transaction(async (transaction) => {
      await lockSignInCodes(transaction, email);
      const recent = await signInCodeTimesSince(
        transaction,
        email,
        new Date(issuedAt.getTime() - 60 * MINUTE_MS),
      );
      const retryAfterMs = codeRetryDelay(recent, issuedAt);
      if (retryAfterMs > 0) {
        throw new SignInCodeRateLimitedError(Math.ceil(retryAfterMs / 1000));
      }
      await insertSignInCode(transaction, {
        id: newId("code"),
        email,
        codeHash: hashSignInCode(authSecret, email, code),
        expiresAt: new Date(issuedAt.getTime() + CODE_LIFETIME_MINUTES * MINUTE_MS),
        createdAt: issuedAt,
      });
    });
    // Sent after the commit: a slow provider never holds the lock. A code
    // that fails to send still counts toward the limit.
    await emailDelivery.send(signInEmail(email, code, CODE_LIFETIME_MINUTES));
  }

  async function verifySignInCode(emailInput: string, codeInput: string): Promise<NewSessionGrant> {
    const email = parseEmailAddress(emailInput);
    const code = normalizeSignInCode(codeInput);
    const attemptedAt = now();
    const signInCode = await newestSignInCode(database, email);
    if (
      code === undefined ||
      signInCode?.consumedAt !== null ||
      signInCode.expiresAt <= attemptedAt
    ) {
      throw new InvalidSignInCodeError();
    }
    // Counted before comparing, so a wrong guess always costs an attempt.
    if (!(await recordSignInAttempt(database, signInCode.id, MAX_ATTEMPTS_PER_CODE))) {
      throw new InvalidSignInCodeError();
    }
    if (!signInCodeMatches(authSecret, email, code, signInCode.codeHash)) {
      throw new InvalidSignInCodeError();
    }
    return database.$transaction(async (transaction) => {
      if (!(await consumeSignInCode(transaction, signInCode.id, attemptedAt))) {
        throw new InvalidSignInCodeError();
      }
      const user = await upsertUserByEmail(transaction, email);
      const token = generateSessionToken();
      const expiresAt = new Date(attemptedAt.getTime() + SESSION_LIFETIME_MS);
      await insertSession(transaction, {
        id: newId("ses"),
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt,
        createdAt: attemptedAt,
      });
      return { token, expiresAt, user };
    });
  }

  function resolveSession(token: string): Promise<SignedInUser | null> {
    return liveSessionUser(database, hashSessionToken(token), now());
  }

  async function signOut(token: string): Promise<void> {
    await revokeSession(database, hashSessionToken(token), now());
  }

  return { requestSignInCode, verifySignInCode, resolveSession, signOut };
}

// How long until another code may be sent; zero when it may be sent now.
// recent holds this address's codes from the last hour, newest first.
function codeRetryDelay(recent: Date[], at: Date): number {
  const newest = recent[0];
  const intervalWait =
    newest === undefined ? 0 : newest.getTime() + CODE_INTERVAL_MS - at.getTime();
  const oldestCounted = recent[CODES_PER_HOUR - 1];
  const hourlyWait =
    oldestCounted === undefined ? 0 : oldestCounted.getTime() + 60 * MINUTE_MS - at.getTime();
  return Math.max(intervalWait, hourlyWait, 0);
}
