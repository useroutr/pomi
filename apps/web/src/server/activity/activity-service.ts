import "server-only";
import { type Database } from "../database";
import { assetDetailsOf, describeAsset } from "../useroutr/asset-details";
import { type UseroutrGateway } from "../useroutr/useroutr-gateway";
import { paymentTimesSince, recentPaymentsOf, totalsOf } from "./activity-repository";

// The latest payments shown; the totals count every payment.
export const RECENT_PAYMENTS = 50;
// Days in the daily chart, today included.
export const CHART_DAYS = 30;

const DAY_MS = 86_400_000;

// What reached the receiver in one asset. Amounts are exact decimal strings;
// amounts in different assets are never added together.
export interface AssetTotal {
  assetSymbol: string;
  assetNetwork: string;
  total: string;
  payments: number;
  thisMonth: string;
  paymentsThisMonth: number;
}

export interface ReceivedPayment {
  id: string;
  amount: string;
  assetSymbol: string;
  assetNetwork: string;
  creditedAt: Date;
  paymentTransactionHash: string | null;
  settlementTransactionHash: string | null;
  // What was paid: the pay box, or one of the receiver's requests.
  requestId: string;
  payBox: boolean;
  note: string | null;
}

export interface PaymentDay {
  // A UTC calendar day, "2026-11-18".
  date: string;
  payments: number;
}

export interface ReceivedActivity {
  totals: AssetTotal[];
  // Newest first, at most RECENT_PAYMENTS.
  recent: ReceivedPayment[];
  // The last CHART_DAYS UTC days, oldest first, today last.
  days: PaymentDay[];
}

export interface ActivityServiceDependencies {
  database: Database;
  useroutr: Pick<UseroutrGateway, "assets">;
  now?: () => Date;
}

export type ActivityService = ReturnType<typeof createActivityService>;

export function createActivityService({
  database,
  useroutr,
  now = () => new Date(),
}: ActivityServiceDependencies) {
  // Months and days are UTC, as every date the dashboard shows.
  async function receivedActivity(userId: string): Promise<ReceivedActivity> {
    const today = startOfUtcDay(now());
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const chartStart = new Date(today.getTime() - (CHART_DAYS - 1) * DAY_MS);
    const [allTime, thisMonth, recent, times, catalog] = await Promise.all([
      totalsOf(database, userId),
      totalsOf(database, userId, monthStart),
      recentPaymentsOf(database, userId, RECENT_PAYMENTS),
      paymentTimesSince(database, userId, chartStart),
      useroutr.assets(),
    ]);
    const details = assetDetailsOf(catalog);
    const monthByAsset = new Map(thisMonth.map((group) => [group.assetId, group]));

    const totals = allTime
      .map((group) => {
        const month = monthByAsset.get(group.assetId);
        return {
          ...describeAsset(details, group.assetId),
          total: group._sum.amount?.toString() ?? "0",
          payments: group._count._all,
          thisMonth: month?._sum.amount?.toString() ?? "0",
          paymentsThisMonth: month?._count._all ?? 0,
        };
      })
      .sort(
        (a, b) =>
          b.payments - a.payments ||
          a.assetSymbol.localeCompare(b.assetSymbol) ||
          a.assetNetwork.localeCompare(b.assetNetwork),
      );

    return {
      totals,
      recent: recent.map((payment) => ({
        id: payment.id,
        amount: payment.amount.toString(),
        ...describeAsset(details, payment.assetId),
        creditedAt: payment.creditedAt,
        paymentTransactionHash: payment.paymentTransactionHash,
        settlementTransactionHash: payment.settlementTransactionHash,
        requestId: payment.request.id,
        payBox: payment.request.payBox,
        note: payment.request.note,
      })),
      days: paymentsPerDay(
        times.map((payment) => payment.creditedAt),
        chartStart,
      ),
    };
  }

  return { receivedActivity };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function paymentsPerDay(times: Date[], start: Date): PaymentDay[] {
  const counts = new Map<string, number>();
  for (const time of times) {
    counts.set(utcDay(time), (counts.get(utcDay(time)) ?? 0) + 1);
  }
  return Array.from({ length: CHART_DAYS }, (_, index) => {
    const date = utcDay(new Date(start.getTime() + index * DAY_MS));
    return { date, payments: counts.get(date) ?? 0 };
  });
}
