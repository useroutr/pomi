import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { FakeStellar } from "@/test/fake-stellar";
import { FakeUseroutr, USDC_ISSUER } from "@/test/fake-useroutr";
import { emptyTables, OTHER_ACCOUNT, RECEIVER_ACCOUNT, testDatabase } from "@/test/test-database";
import { createPayoutAddressService } from "../payout-addresses/payout-address-service";
import { createRequestService } from "../requests/request-service";
import { CHART_DAYS, createActivityService, RECENT_PAYMENTS } from "./activity-service";

const database = testDatabase();
const NOW = new Date("2026-11-18T12:00:00Z");
const useroutr = new FakeUseroutr();

function services() {
  const stellar = new FakeStellar();
  for (const account of [RECEIVER_ACCOUNT, OTHER_ACCOUNT]) {
    stellar.accounts.set(account, {
      trustlines: [{ code: "USDC", issuer: USDC_ISSUER, authorized: true }],
      memoRequired: false,
    });
  }
  const payoutAddresses = createPayoutAddressService({
    database,
    accountReader: stellar,
    network: "testnet",
  });
  return {
    payoutAddresses,
    requests: createRequestService({ database, useroutr, payoutAddresses, now: () => NOW }),
    activity: createActivityService({ database, useroutr, now: () => NOW }),
  };
}

let paymentCount = 0;

async function pay(requestId: string, amount: string, assetId: string, creditedAt: string) {
  paymentCount += 1;
  await database.requestPayment.create({
    data: {
      id: `pay_${String(paymentCount)}`,
      requestId,
      fundingIntentId: `fi_${String(paymentCount)}`,
      amount,
      assetId,
      settlementTransactionHash: `settlement_${String(paymentCount)}`,
      creditedAt: new Date(creditedAt),
    },
  });
}

beforeEach(async () => {
  paymentCount = 0;
  await emptyTables(database);
  await database.user.create({ data: { id: "usr_1", email: "receiver@example.com" } });
  await database.user.create({ data: { id: "usr_2", email: "other@example.com" } });
  const { payoutAddresses } = services();
  const stellar = { network: "stellar", addressKind: "stellar" } as const;
  await payoutAddresses.setPayoutAddress("usr_1", RECEIVER_ACCOUNT, stellar);
  await payoutAddresses.setPayoutAddress("usr_2", OTHER_ACCOUNT, stellar);
});

afterAll(async () => {
  await database.$disconnect();
});

describe("what a receiver has been paid", () => {
  it("lists payments to requests and to the pay box, newest first", async () => {
    const { requests, activity } = services();
    const request = await requests.createRequest("usr_1", {
      amount: "25",
      assetId: "asset_usdc_stellar",
      note: "Logo",
    });
    const payBox = await requests.setPayBox("usr_1", { assetId: "asset_usdc_stellar" });
    const payBoxId = (await database.request.findFirstOrThrow({ where: { payBox: true } })).id;
    await pay(request.id, "25", "asset_usdc_stellar", "2026-11-10T09:00:00Z");
    await pay(payBoxId, "7.5", "asset_usdc_stellar", "2026-11-17T09:00:00Z");

    const received = await activity.receivedActivity("usr_1");

    expect(payBox.open).toBe(true);
    expect(received.recent).toMatchObject([
      { amount: "7.5", assetSymbol: "USDC", payBox: true, note: null, requestId: payBoxId },
      { amount: "25", assetSymbol: "USDC", payBox: false, note: "Logo", requestId: request.id },
    ]);
  });

  it("keeps each payment in its own asset after the pay box changes asset", async () => {
    const { requests, activity } = services();
    await requests.setPayBox("usr_1", { assetId: "asset_usdc_stellar" });
    const payBoxId = (await database.request.findFirstOrThrow({ where: { payBox: true } })).id;
    await pay(payBoxId, "10", "asset_usdc_stellar", "2026-11-12T09:00:00Z");

    await requests.setPayBox("usr_1", { assetId: "asset_xlm_stellar" });
    await pay(payBoxId, "40", "asset_xlm_stellar", "2026-11-13T09:00:00Z");

    const received = await activity.receivedActivity("usr_1");

    expect(received.recent.map((payment) => [payment.amount, payment.assetSymbol])).toEqual([
      ["40", "XLM"],
      ["10", "USDC"],
    ]);
  });

  it("adds each asset up exactly, all time and this month, never across assets", async () => {
    const { requests, activity } = services();
    const usdc = await requests.createRequest("usr_1", {
      amount: "0.1",
      assetId: "asset_usdc_stellar",
      reusable: true,
    });
    const xlm = await requests.createRequest("usr_1", {
      amount: "3",
      assetId: "asset_xlm_stellar",
    });
    await pay(usdc.id, "0.1", "asset_usdc_stellar", "2026-10-30T23:59:59Z");
    await pay(usdc.id, "0.2", "asset_usdc_stellar", "2026-11-01T00:00:00Z");
    await pay(usdc.id, "0.1", "asset_usdc_stellar", "2026-11-18T08:00:00Z");
    await pay(xlm.id, "3", "asset_xlm_stellar", "2026-11-02T08:00:00Z");

    const received = await activity.receivedActivity("usr_1");

    expect(received.totals).toEqual([
      {
        assetSymbol: "USDC",
        assetNetwork: "stellar",
        total: "0.4",
        payments: 3,
        thisMonth: "0.3",
        paymentsThisMonth: 2,
      },
      {
        assetSymbol: "XLM",
        assetNetwork: "stellar",
        total: "3",
        payments: 1,
        thisMonth: "3",
        paymentsThisMonth: 1,
      },
    ]);
  });

  it("shows a receiver only their own payments", async () => {
    const { requests, activity } = services();
    const theirs = await requests.createRequest("usr_2", {
      amount: "5",
      assetId: "asset_usdc_stellar",
    });
    await pay(theirs.id, "5", "asset_usdc_stellar", "2026-11-15T09:00:00Z");

    const received = await activity.receivedActivity("usr_1");

    expect(received).toMatchObject({ totals: [], recent: [] });
  });

  it("counts payments per UTC day for the last thirty days, today last", async () => {
    const { requests, activity } = services();
    const request = await requests.createRequest("usr_1", {
      amount: "1",
      assetId: "asset_xlm_stellar",
      reusable: true,
    });
    await pay(request.id, "1", "asset_xlm_stellar", "2026-10-19T23:59:59Z");
    await pay(request.id, "1", "asset_xlm_stellar", "2026-10-20T00:00:00Z");
    await pay(request.id, "1", "asset_xlm_stellar", "2026-11-18T01:00:00Z");
    await pay(request.id, "1", "asset_xlm_stellar", "2026-11-18T11:00:00Z");

    const { days } = await activity.receivedActivity("usr_1");

    expect(days).toHaveLength(CHART_DAYS);
    expect(days[0]).toEqual({ date: "2026-10-20", payments: 1 });
    expect(days.at(-1)).toEqual({ date: "2026-11-18", payments: 2 });
    expect(days.reduce((sum, day) => sum + day.payments, 0)).toBe(3);
  });

  it("lists at most the latest payments while the totals count them all", async () => {
    const { requests, activity } = services();
    const request = await requests.createRequest("usr_1", {
      amount: "1",
      assetId: "asset_xlm_stellar",
      reusable: true,
    });
    for (let index = 0; index < RECENT_PAYMENTS + 2; index += 1) {
      await pay(request.id, "1", "asset_xlm_stellar", "2026-11-18T08:00:00Z");
    }

    const received = await activity.receivedActivity("usr_1");

    expect(received.recent).toHaveLength(RECENT_PAYMENTS);
    expect(received.totals[0]).toMatchObject({ total: "52", payments: RECENT_PAYMENTS + 2 });
  });
});
