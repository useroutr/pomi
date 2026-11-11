import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { FakeUseroutr } from "@/test/fake-useroutr";
import { emptyTables, RECEIVER_ACCOUNT, testDatabase } from "@/test/test-database";
import {
  RequestAlreadyPaidError,
  RequestClosedError,
  RequestNotFoundError,
} from "../requests/request-errors";
import { createCheckoutService } from "./checkout-service";

const database = testDatabase();
const MINUTE_MS = 60_000;

let currentTime: Date;
let useroutr: FakeUseroutr;

function checkout() {
  return createCheckoutService({ database, useroutr, now: () => currentTime });
}

function advance(milliseconds: number) {
  currentTime = new Date(currentTime.getTime() + milliseconds);
}

beforeEach(async () => {
  await emptyTables(database);
  currentTime = new Date("2026-11-10T12:00:00Z");
  useroutr = new FakeUseroutr();
  useroutr.now = () => currentTime;
  await database.user.create({ data: { id: "usr_1", email: "receiver@example.com" } });
  await database.payoutAddress.create({
    data: { id: "addr_1", userId: "usr_1", address: RECEIVER_ACCOUNT },
  });
  await database.request.create({
    data: {
      id: "req_1",
      userId: "usr_1",
      kind: "SINGLE",
      amountKind: "FIXED",
      amount: "25",
      assetId: "asset_usdc_stellar",
      payoutAddressId: "addr_1",
    },
  });
});

afterAll(async () => {
  await database.$disconnect();
});

describe("starting a checkout", () => {
  it("creates an intent for the request's amount, paying its address", async () => {
    await expect(checkout().startCheckout("req_1")).resolves.toEqual({ token: "token_1" });

    const [created] = [...useroutr.created.values()];
    expect(created?.request).toEqual({
      amount: "25",
      assetId: "asset_usdc_stellar",
      payoutAddress: RECEIVER_ACCOUNT,
      reference: "req_1",
      idempotencyKey: "pomi:req_1:0",
    });
    await expect(database.requestIntent.findFirstOrThrow()).resolves.toMatchObject({
      fundingIntentId: "fi_1",
      fundingToken: "token_1",
      exclusive: true,
      visitId: null,
      state: "OPEN",
      expiresAt: new Date(currentTime.getTime() + 30 * MINUTE_MS),
    });
  });

  it("gives a later visitor the same intent", async () => {
    await checkout().startCheckout("req_1");
    advance(10 * MINUTE_MS);

    await expect(checkout().startCheckout("req_1")).resolves.toEqual({ token: "token_1" });
    expect(useroutr.created.size).toBe(1);
  });

  it("gives visitors arriving together one intent", async () => {
    useroutr.createDelayMs = 50;

    const results = await Promise.all(
      Array.from({ length: 5 }, () => checkout().startCheckout("req_1")),
    );

    expect(new Set(results.map((result) => result.token))).toEqual(new Set(["token_1"]));
    expect(useroutr.created.size).toBe(1);
    expect(await database.requestIntent.count()).toBe(1);
  });

  it("starts a new intent once the last one expired unpaid", async () => {
    await checkout().startCheckout("req_1");
    advance(31 * MINUTE_MS);
    useroutr.statuses.set("fi_1", "EXPIRED");

    await expect(checkout().startCheckout("req_1")).resolves.toEqual({ token: "token_2" });

    expect([...useroutr.created.keys()]).toEqual(["pomi:req_1:0", "pomi:req_1:1"]);
    const intents = await database.requestIntent.findMany({ orderBy: { createdAt: "asc" } });
    expect(intents.map((intent) => [intent.fundingIntentId, intent.state])).toEqual([
      ["fi_1", "CLOSED"],
      ["fi_2", "OPEN"],
    ]);
  });

  it.each(["PAYMENT_DETECTED", "SETTLING", "AWAITING_PAYMENT"] as const)(
    "keeps an expired intent that Useroutr still reports as %s, so it cannot be paid twice",
    async (status) => {
      await checkout().startCheckout("req_1");
      advance(31 * MINUTE_MS);
      useroutr.statuses.set("fi_1", status);

      await expect(checkout().startCheckout("req_1")).resolves.toEqual({ token: "token_1" });
      expect(useroutr.created.size).toBe(1);
    },
  );

  it("refuses a new intent when the last one was credited before its webhook arrived", async () => {
    await checkout().startCheckout("req_1");
    advance(31 * MINUTE_MS);
    useroutr.statuses.set("fi_1", "CREDITED");

    await expect(checkout().startCheckout("req_1")).rejects.toThrow(RequestAlreadyPaidError);
  });

  it("starts a new intent without asking Useroutr once a webhook closed the last", async () => {
    await checkout().startCheckout("req_1");
    await database.requestIntent.updateMany({ data: { state: "CLOSED" } });
    useroutr.statuses.clear();

    await expect(checkout().startCheckout("req_1")).resolves.toEqual({ token: "token_2" });
  });

  it.each([
    ["PAID", RequestAlreadyPaidError],
    ["CLOSED", RequestClosedError],
  ] as const)("refuses a %s request", async (status, errorType) => {
    await database.request.update({ where: { id: "req_1" }, data: { status } });

    await expect(checkout().startCheckout("req_1")).rejects.toThrow(errorType);
    expect(useroutr.created.size).toBe(0);
  });

  it("refuses a request that does not exist", async () => {
    await expect(checkout().startCheckout("req_missing")).rejects.toThrow(RequestNotFoundError);
  });
});
