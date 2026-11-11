import "server-only";
import { type Prisma } from "@/generated/prisma/client";
import { type Database } from "../database";

type Client = Database | Prisma.TransactionClient;

export function checkoutRequest(client: Client, requestId: string) {
  return client.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      kind: true,
      status: true,
      amount: true,
      assetId: true,
      payoutAddress: { select: { address: true } },
    },
  });
}

export function openExclusiveIntent(client: Client, requestId: string) {
  return client.requestIntent.findFirst({
    where: { requestId, exclusive: true, state: "OPEN" },
    select: { id: true, fundingIntentId: true, fundingToken: true, expiresAt: true },
  });
}

export function closedExclusiveIntentCount(client: Client, requestId: string) {
  return client.requestIntent.count({ where: { requestId, exclusive: true, state: "CLOSED" } });
}

export async function insertExclusiveIntent(
  client: Client,
  intent: {
    id: string;
    requestId: string;
    fundingIntentId: string;
    fundingToken: string;
    amount: string;
    expiresAt: Date;
    createdAt: Date;
  },
) {
  await client.requestIntent.create({ data: { ...intent, exclusive: true, visitId: null } });
}

// By Useroutr's funding intent id, so the webhook and the checkout close the
// same row however they learned the intent ended.
export async function closeIntent(client: Client, fundingIntentId: string, now: Date) {
  await client.requestIntent.updateMany({
    where: { fundingIntentId, state: "OPEN" },
    data: { state: "CLOSED", closedAt: now },
  });
}
