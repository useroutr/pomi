import "server-only";
import { type Prisma } from "@/generated/prisma/client";
import { type Database } from "../database";

type Client = Database | Prisma.TransactionClient;

const payoutAddressFields = { id: true, address: true, verifiedAt: true } as const;

export function activePayoutAddress(client: Client, userId: string) {
  return client.payoutAddress.findFirst({
    where: { userId, active: true },
    select: payoutAddressFields,
  });
}

// Held until the transaction ends, so two saves for one receiver cannot both
// leave an address active.
export async function lockPayoutAddresses(client: Prisma.TransactionClient, userId: string) {
  await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payout:${userId}`}, 0))`;
}

export async function deactivatePayoutAddresses(client: Client, userId: string) {
  await client.payoutAddress.updateMany({
    where: { userId, active: true },
    data: { active: false },
  });
}

export function insertActivePayoutAddress(
  client: Client,
  payoutAddress: { id: string; userId: string; address: string; createdAt: Date },
) {
  return client.payoutAddress.create({
    data: { ...payoutAddress, active: true },
    select: payoutAddressFields,
  });
}
