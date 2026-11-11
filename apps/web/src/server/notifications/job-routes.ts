import "server-only";
import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { type OutboxSender } from "./outbox-sender";

// Vercel Cron calls this with "Authorization: Bearer <CRON_SECRET>". It
// retries the emails whose first send, right after their webhook, failed.
export async function handleSendEmailsJob(
  request: NextRequest,
  cronSecret: string | null,
  outbox: Pick<OutboxSender, "sendPending">,
) {
  if (cronSecret === null) {
    return new NextResponse("CRON_SECRET is not set", { status: 503 });
  }
  if (!bearerMatches(request.headers.get("authorization"), cronSecret)) {
    return new NextResponse(null, { status: 401 });
  }
  return NextResponse.json(await outbox.sendPending());
}

function bearerMatches(header: string | null, secret: string): boolean {
  const presented = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}
