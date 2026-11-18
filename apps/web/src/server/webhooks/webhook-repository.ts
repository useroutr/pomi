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

// Only a single-use request is done after one payment; a reusable one stays
// open. A closed request that is paid anyway keeps its status, and the
// payment is still recorded beside it.
export async function markSingleRequestPaid(client: Prisma.TransactionClient, requestId: string) {
  await client.request.updateMany({
    where: { id: requestId, kind: "SINGLE", status: "OPEN" },
    data: { status: "PAID" },
  });
}

export async function queuePaymentNotices(
  client: Prisma.TransactionClient,
  notice: { requestPaymentId: string; emailId: string; pushId: string; createdAt: Date },
) {
  await client.outboxEmail.create({
    data: {
      id: notice.emailId,
      kind: "PAYMENT_RECEIVED",
      requestPaymentId: notice.requestPaymentId,
      createdAt: notice.createdAt,
    },
  });
  await client.outboxPush.create({
    data: {
      id: notice.pushId,
      requestPaymentId: notice.requestPaymentId,
      createdAt: notice.createdAt,
    },
  });
}

export async function upsertRefund(
  client: Prisma.TransactionClient,
  refund: { id: string; fundingIntentId: string; status: string; destinationRequiredAt?: Date },
) {
  await client.refund.upsert({
    where: { id: refund.id },
    create: refund,
    update: {
      status: refund.status,
      ...(refund.destinationRequiredAt === undefined
        ? {}
        : { destinationRequiredAt: refund.destinationRequiredAt }),
    },
  });
}

// One alert per refund, however often Useroutr asks.
export async function queueRefundAlert(
  client: Prisma.TransactionClient,
  alert: { id: string; refundId: string; createdAt: Date },
) {
  await client.outboxEmail.createMany({
    data: [{ ...alert, kind: "REFUND_DESTINATION_REQUIRED" }],
    skipDuplicates: true,
  });
}
