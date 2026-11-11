import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { type Database } from "../database";

const MAX_ATTEMPTS = 8;

type OutboxTable = "outbox_emails" | "outbox_pushes";

// Takes up to `limit` unsent rows and holds them for `claimFor`, so a second
// sender running at the same moment takes others or none. A sender that dies
// leaves its claim to lapse, and the row is tried again.
export async function claimUnsent(
  database: Database,
  table: OutboxTable,
  { limit, now, claimFor }: { limit: number; now: Date; claimFor: number },
): Promise<string[]> {
  // The name comes from the union above, never from input.
  const tableName = Prisma.raw(`"${table}"`);
  const claimedUntil = new Date(now.getTime() + claimFor);
  const rows = await database.$queryRaw<{ id: string }[]>`
    UPDATE ${tableName}
    SET "claimed_until" = ${claimedUntil}, "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM ${tableName}
      WHERE "sent_at" IS NULL
        AND "attempts" < ${MAX_ATTEMPTS}
        AND ("claimed_until" IS NULL OR "claimed_until" < ${now})
      ORDER BY "created_at"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"`;
  return rows.map((row) => row.id);
}

const paymentFields = {
  amount: true,
  assetId: true,
  settlementTransactionHash: true,
  request: { select: { id: true, note: true, user: { select: { id: true, email: true } } } },
} satisfies Prisma.RequestPaymentSelect;

export function outboxEmailContent(database: Database, emailId: string) {
  return database.outboxEmail.findUniqueOrThrow({
    where: { id: emailId },
    select: {
      kind: true,
      requestPayment: { select: paymentFields },
      refund: { select: { id: true, fundingIntentId: true } },
    },
  });
}

export function outboxPushContent(database: Database, pushId: string) {
  return database.outboxPush.findUniqueOrThrow({
    where: { id: pushId },
    select: { requestPayment: { select: paymentFields } },
  });
}

export function devicesOf(database: Database, userId: string) {
  return database.device.findMany({ where: { userId }, select: { pushToken: true } });
}

export async function forgetDevices(database: Database, pushTokens: string[]) {
  if (pushTokens.length > 0) {
    await database.device.deleteMany({ where: { pushToken: { in: pushTokens } } });
  }
}

export async function markEmailSent(database: Database, emailId: string, now: Date) {
  await database.outboxEmail.update({ where: { id: emailId }, data: { sentAt: now } });
}

export async function markPushSent(database: Database, pushId: string, now: Date) {
  await database.outboxPush.update({ where: { id: pushId }, data: { sentAt: now } });
}
