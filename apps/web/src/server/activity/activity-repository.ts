import "server-only";
import { type Database } from "../database";

// Every payment to any of the receiver's requests, the pay box's included.
function receivedBy(userId: string) {
  return { request: { userId } };
}

export function recentPaymentsOf(database: Database, userId: string, take: number) {
  return database.requestPayment.findMany({
    where: receivedBy(userId),
    orderBy: [{ creditedAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      amount: true,
      // The payment's own asset: the pay box is edited in place, so a payment
      // to it may be in an asset the box no longer asks for.
      assetId: true,
      creditedAt: true,
      paymentTransactionHash: true,
      settlementTransactionHash: true,
      request: { select: { id: true, note: true, payBox: true } },
    },
  });
}

// Summed by Postgres over NUMERIC amounts, so the totals are exact.
export function totalsOf(database: Database, userId: string, since?: Date) {
  return database.requestPayment.groupBy({
    by: ["assetId"],
    where: {
      ...receivedBy(userId),
      ...(since === undefined ? {} : { creditedAt: { gte: since } }),
    },
    _sum: { amount: true },
    _count: { _all: true },
  });
}

export function paymentTimesSince(database: Database, userId: string, since: Date) {
  return database.requestPayment.findMany({
    where: { ...receivedBy(userId), creditedAt: { gte: since } },
    select: { creditedAt: true },
  });
}
