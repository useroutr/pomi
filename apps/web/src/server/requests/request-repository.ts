import "server-only";
import { type Prisma } from "@/generated/prisma/client";
import { type Database } from "../database";

type Client = Database | Prisma.TransactionClient;

export function insertFixedRequest(
  client: Client,
  request: {
    id: string;
    userId: string;
    kind: "SINGLE" | "REUSABLE";
    amount: string;
    assetId: string;
    note: string | null;
    listed: boolean;
    endsAt: Date | null;
    payoutAddressId: string;
    createdAt: Date;
  },
) {
  return client.request.create({
    data: { ...request, amountKind: "FIXED" },
    select: { id: true },
  });
}

const receiverFields = {
  id: true,
  kind: true,
  amount: true,
  assetId: true,
  note: true,
  listed: true,
  status: true,
  endsAt: true,
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
} satisfies Prisma.RequestSelect;

// The pay box has its own place on the dashboard, so it is not listed here.
export function requestsOf(client: Client, userId: string) {
  return client.request.findMany({
    where: { userId, payBox: false },
    orderBy: { createdAt: "desc" },
    select: receiverFields,
  });
}

const payerFields = {
  id: true,
  kind: true,
  amountKind: true,
  amount: true,
  minimumAmount: true,
  assetId: true,
  note: true,
  status: true,
  endsAt: true,
  payoutAddress: { select: { address: true, verifiedAt: true } },
  user: { select: { displayName: true, handle: true } },
} satisfies Prisma.RequestSelect;

export function requestForPayer(client: Client, requestId: string) {
  return client.request.findUnique({ where: { id: requestId }, select: payerFields });
}

export function openPayBoxForPayer(client: Client, userId: string) {
  return client.request.findFirst({
    where: { userId, payBox: true, status: "OPEN" },
    select: payerFields,
  });
}

export function listedRequestsOf(client: Client, userId: string, now: Date) {
  return client.request.findMany({
    where: {
      userId,
      listed: true,
      payBox: false,
      status: "OPEN",
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
    select: payerFields,
  });
}

export function userByHandle(client: Client, handle: string) {
  return client.user.findUnique({
    where: { handle },
    select: { id: true, handle: true, displayName: true },
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
    where: { id: requestId, userId, status: "OPEN", payBox: false },
    data: { status: "CLOSED", closedAt: now },
  });
  return count === 1;
}

// False when the request is not the receiver's.
export async function setRequestListed(
  client: Client,
  userId: string,
  requestId: string,
  listed: boolean,
) {
  const { count } = await client.request.updateMany({
    where: { id: requestId, userId, payBox: false },
    data: { listed },
  });
  return count === 1;
}

export function requestOwnedBy(client: Client, userId: string, requestId: string) {
  return client.request.findFirst({
    where: { id: requestId, userId, payBox: false },
    select: { status: true },
  });
}

export function payBoxOf(client: Client, userId: string) {
  return client.request.findFirst({
    where: { userId, payBox: true },
    select: {
      id: true,
      amountKind: true,
      amount: true,
      minimumAmount: true,
      assetId: true,
      status: true,
      payoutAddress: { select: { address: true } },
    },
  });
}

export interface PayBoxFields {
  assetId: string;
  amountKind: "FIXED" | "OPEN";
  amount: string | null;
  minimumAmount: string | null;
  payoutAddressId: string;
}

export async function savePayBox(
  client: Client,
  userId: string,
  fields: PayBoxFields,
  newPayBox: { id: string; createdAt: Date },
) {
  // requests_one_pay_box_per_user keeps one row per receiver, closed or open,
  // so the box is changed in place rather than replaced.
  await client.request.upsert({
    where: { id: (await payBoxOf(client, userId))?.id ?? newPayBox.id },
    create: {
      ...fields,
      id: newPayBox.id,
      userId,
      kind: "REUSABLE",
      payBox: true,
      createdAt: newPayBox.createdAt,
    },
    update: { ...fields, status: "OPEN", closedAt: null },
  });
}

export async function closePayBoxOf(client: Client, userId: string, now: Date) {
  await client.request.updateMany({
    where: { userId, payBox: true, status: "OPEN" },
    data: { status: "CLOSED", closedAt: now },
  });
}
