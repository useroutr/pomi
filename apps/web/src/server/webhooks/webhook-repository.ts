import "server-only";
import { type Prisma } from "@/generated/prisma/client";

// False when the event was processed before. A copy arriving at the same
// moment waits for the first transaction, then finds its row.
export async function insertProcessedEvent(
  client: Prisma.TransactionClient,
  event: { id: string; type: string; at: Date },
) {
  const { count } = await client.webhookEvent.createMany({
    data: [{ id: event.id, type: event.type, receivedAt: event.at, processedAt: event.at }],
    skipDuplicates: true,
  });
  return count === 1;
}

export function intentForFundingIntent(client: Prisma.TransactionClient, fundingIntentId: string) {
  return client.requestIntent.findUnique({
    where: { fundingIntentId },
    select: { requestId: true },
  });
}

export async function paymentExists(client: Prisma.TransactionClient, fundingIntentId: string) {
  return (await client.requestPayment.count({ where: { fundingIntentId } })) > 0;
}

export async function insertPayment(
  client: Prisma.TransactionClient,
  payment: {
    id: string;
    requestId: string;
    fundingIntentId: string;
    amount: string;
    assetId: string;
    paymentTransactionHash: string | null;
    settlementTransactionHash: string | null;
    creditedAt: Date;
  },
) {
  await client.requestPayment.create({ data: payment });
}

// A closed request that is paid anyway keeps its status: the receiver
// closed it, and the payment is still recorded beside it.
export async function markRequestPaid(client: Prisma.TransactionClient, requestId: string) {
  await client.request.updateMany({
    where: { id: requestId, status: "OPEN" },
    data: { status: "PAID" },
  });
}

export async function queuePaymentEmail(
  client: Prisma.TransactionClient,
  email: { id: string; requestPaymentId: string; createdAt: Date },
) {
  await client.outboxEmail.create({ data: { ...email, kind: "PAYMENT_RECEIVED" } });
}
