import "server-only";
import { type Database } from "../database";

const MAX_ATTEMPTS = 8;

// Takes up to `limit` unsent emails and holds them for `claimFor`, so a
// second sender running at the same moment takes others or none. A sender
// that dies leaves its claim to lapse, and the email is tried again.
export async function claimUnsentEmails(
  database: Database,
  { limit, now, claimFor }: { limit: number; now: Date; claimFor: number },
): Promise<string[]> {
  const claimedUntil = new Date(now.getTime() + claimFor);
  const rows = await database.$queryRaw<{ id: string }[]>`
    UPDATE "outbox_emails"
    SET "claimed_until" = ${claimedUntil}, "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM "outbox_emails"
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

export function paymentEmailContent(database: Database, emailId: string) {
  return database.outboxEmail.findUniqueOrThrow({
    where: { id: emailId },
    select: {
      requestPayment: {
        select: {
          amount: true,
          assetId: true,
          settlementTransactionHash: true,
          request: { select: { note: true, user: { select: { email: true } } } },
        },
      },
    },
  });
}

export async function markEmailSent(database: Database, emailId: string, now: Date) {
  await database.outboxEmail.update({ where: { id: emailId }, data: { sentAt: now } });
}
