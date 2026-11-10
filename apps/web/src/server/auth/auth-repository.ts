import "server-only";
import { type Prisma } from "@/generated/prisma/client";
import { type Database } from "../database";
import { newId } from "../ids";

type Client = Database | Prisma.TransactionClient;

export interface NewSignInCode {
  id: string;
  email: string;
  codeHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface NewSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

const signedInUserFields = { id: true, email: true, handle: true } as const;

// Held until the transaction ends, so two requests for one address cannot
// both pass the rate limit.
export async function lockSignInCodes(client: Prisma.TransactionClient, email: string) {
  await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 0))`;
}

// Newest first.
export async function signInCodeTimesSince(client: Client, email: string, since: Date) {
  const codes = await client.signInCode.findMany({
    where: { email, createdAt: { gte: since } },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return codes.map((code) => code.createdAt);
}

export async function insertSignInCode(client: Client, code: NewSignInCode) {
  await client.signInCode.create({ data: code });
}

export function newestSignInCode(client: Client, email: string) {
  return client.signInCode.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });
}

// False once the code is used or out of attempts. The condition is checked in
// the update itself, so attempts made at the same moment are all counted.
export async function recordSignInAttempt(client: Client, id: string, maxAttempts: number) {
  const { count } = await client.signInCode.updateMany({
    where: { id, consumedAt: null, attempts: { lt: maxAttempts } },
    data: { attempts: { increment: 1 } },
  });
  return count === 1;
}

// False when another request used the code first.
export async function consumeSignInCode(client: Client, id: string, now: Date) {
  const { count } = await client.signInCode.updateMany({
    where: { id, consumedAt: null },
    data: { consumedAt: now },
  });
  return count === 1;
}

export function upsertUserByEmail(client: Client, email: string) {
  return client.user.upsert({
    where: { email },
    create: { id: newId("usr"), email },
    update: {},
    select: signedInUserFields,
  });
}

export async function insertSession(client: Client, session: NewSession) {
  await client.session.create({ data: session });
}

export async function liveSessionUser(client: Client, tokenHash: string, now: Date) {
  const session = await client.session.findFirst({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: now } },
    select: { user: { select: signedInUserFields } },
  });
  return session?.user ?? null;
}

export async function revokeSession(client: Client, tokenHash: string, now: Date) {
  await client.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: now },
  });
}
