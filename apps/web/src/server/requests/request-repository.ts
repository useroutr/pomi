import "server-only";
import { type Prisma } from "@/generated/prisma/client";
import { type Database } from "../database";

type Client = Database | Prisma.TransactionClient;

export function insertSingleRequest(
  client: Client,
  request: {
    id: string;
    userId: string;
    amount: string;
    assetId: string;
    note: string | null;
    payoutAddressId: string;
    createdAt: Date;
  },
) {
  return client.request.create({
    data: { ...request, kind: "SINGLE", amountKind: "FIXED" },
    select: { id: true },
  });
}

export function requestsOf(client: Client, userId: string) {
  return client.request.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      amount: true,
      assetId: true,
      note: true,
      status: true,
      createdAt: true,
      payments: {
        orderBy: { creditedAt: "asc" },
        select: {
          amount: true,
          creditedAt: true,
          paymentTransactionHash: true,
          settlementTransactionHash: true,
        },
      },
    },
  });
}

export function requestForPayer(client: Client, requestId: string) {
  return client.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      kind: true,
      amount: true,
      assetId: true,
      note: true,
      status: true,
      payoutAddress: { select: { address: true, verifiedAt: true } },
      user: { select: { displayName: true, handle: true } },
    },
  });
}

// False when the request is not the receiver's or is no longer open.
export async function closeOpenRequest(
  client: Client,
  userId: string,
  requestId: string,
  now: Date,
) {
  const { count } = await client.request.updateMany({
    where: { id: requestId, userId, status: "OPEN" },
    data: { status: "CLOSED", closedAt: now },
  });
  return count === 1;
}

export function requestOwnedBy(client: Client, userId: string, requestId: string) {
  return client.request.findFirst({
    where: { id: requestId, userId },
    select: { status: true },
  });
}
