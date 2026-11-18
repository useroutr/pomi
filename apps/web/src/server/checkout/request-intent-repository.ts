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
      amountKind: true,
      status: true,
      amount: true,
      minimumAmount: true,
      assetId: true,
      endsAt: true,
      payoutAddress: { select: { address: true } },
    },
  });
}

const intentFields = {
  id: true,
  fundingIntentId: true,
  fundingToken: true,
  expiresAt: true,
} satisfies Prisma.RequestIntentSelect;

export function openExclusiveIntent(client: Client, requestId: string) {
  return client.requestIntent.findFirst({
    where: { requestId, exclusive: true, state: "OPEN" },
    select: intentFields,
  });
}

export function closedExclusiveIntentCount(client: Client, requestId: string) {
  return client.requestIntent.count({ where: { requestId, exclusive: true, state: "CLOSED" } });
}

// The visitor's live intent for this request and amount, if they have one.
export function liveVisitorIntent(
  client: Client,
  intent: { requestId: string; visitorId: string; amount: string; now: Date },
) {
  return client.requestIntent.findFirst({
    where: {
      requestId: intent.requestId,
      visitorId: intent.visitorId,
      amount: intent.amount,
      state: "OPEN",
      expiresAt: { gt: intent.now },
    },
    orderBy: { createdAt: "desc" },
    select: intentFields,
  });
}

export function visitorIntentCount(client: Client, requestId: string, visitorId: string) {
  return client.requestIntent.count({ where: { requestId, visitorId } });
}

export function intentByVisit(client: Client, requestId: string, visitId: string) {
  return client.requestIntent.findUnique({
    where: { requestId_visitId: { requestId, visitId } },
    select: intentFields,
  });
}

export function intentsStartedSince(
  client: Client,
  starter: { visitorId: string } | { clientKey: string },
  since: Date,
) {
  return client.requestIntent.findMany({
    where: { ...starter, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
}

export async function insertIntent(
  client: Client,
  intent: {
    id: string;
    requestId: string;
    fundingIntentId: string;
    fundingToken: string;
    amount: string;
    exclusive: boolean;
    visitId: string | null;
    visitorId: string;
    clientKey: string | null;
    expiresAt: Date;
    createdAt: Date;
  },
) {
  await client.requestIntent.create({ data: intent });
}

// By Useroutr's funding intent id, so the webhook and the checkout close the
// same row however they learned the intent ended.
export async function closeIntent(client: Client, fundingIntentId: string, now: Date) {
  await client.requestIntent.updateMany({
    where: { fundingIntentId, state: "OPEN" },
    data: { state: "CLOSED", closedAt: now },
  });
}
