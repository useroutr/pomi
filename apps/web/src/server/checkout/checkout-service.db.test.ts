import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { FakeUseroutr } from "@/test/fake-useroutr";
import { emptyTables, RECEIVER_ACCOUNT, testDatabase } from "@/test/test-database";
import { InvalidAmountError } from "@pomi/shared";
import {
  RequestAlreadyPaidError,
  RequestClosedError,
  RequestEndedError,
  RequestNotFoundError,
} from "../requests/request-errors";
import { BelowMinimumError, CheckoutRateLimitedError } from "./checkout-errors";
import { type CheckoutVisitor, createCheckoutService } from "./checkout-service";

const database = testDatabase();
const MINUTE_MS = 60_000;

let currentTime: Date;
let useroutr: FakeUseroutr;

function checkout() {
  return createCheckoutService({ database, useroutr, now: () => currentTime });
}

let visitorNumber = 0;

// A different visitor each time unless one is given, as separate people
// opening a link would be.
function visitor(visitorId?: string, clientKey: string | null = null): CheckoutVisitor {
  visitorNumber += 1;
  return { visitorId: visitorId ?? `vis_${String(visitorNumber)}`, clientKey };
}

function start(requestId: string, amount?: string, as: CheckoutVisitor = visitor()) {
  return checkout().startCheckout(requestId, amount, as);
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
    await expect(start("req_1")).resolves.toEqual({ token: "token_1" });

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
    await start("req_1");
    advance(10 * MINUTE_MS);

    await expect(start("req_1")).resolves.toEqual({ token: "token_1" });
    expect(useroutr.created.size).toBe(1);
  });

  it("gives visitors arriving together one intent", async () => {
    useroutr.createDelayMs = 50;

    const results = await Promise.all(Array.from({ length: 5 }, () => start("req_1")));

    expect(new Set(results.map((result) => result.token))).toEqual(new Set(["token_1"]));
    expect(useroutr.created.size).toBe(1);
    expect(await database.requestIntent.count()).toBe(1);
  });

  it("starts a new intent once the last one expired unpaid", async () => {
    await start("req_1");
    advance(31 * MINUTE_MS);
    useroutr.statuses.set("fi_1", "EXPIRED");

    await expect(start("req_1")).resolves.toEqual({ token: "token_2" });

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
      await start("req_1");
      advance(31 * MINUTE_MS);
      useroutr.statuses.set("fi_1", status);

      await expect(start("req_1")).resolves.toEqual({ token: "token_1" });
      expect(useroutr.created.size).toBe(1);
    },
  );

  it("refuses a new intent when the last one was credited before its webhook arrived", async () => {
    await start("req_1");
    advance(31 * MINUTE_MS);
    useroutr.statuses.set("fi_1", "CREDITED");

    await expect(start("req_1")).rejects.toThrow(RequestAlreadyPaidError);
  });

  it("starts a new intent without asking Useroutr once a webhook closed the last", async () => {
    await start("req_1");
    await database.requestIntent.updateMany({ data: { state: "CLOSED" } });
    useroutr.statuses.clear();

    await expect(start("req_1")).resolves.toEqual({ token: "token_2" });
  });

  it.each([
    ["PAID", RequestAlreadyPaidError],
    ["CLOSED", RequestClosedError],
  ] as const)("refuses a %s request", async (status, errorType) => {
    await database.request.update({ where: { id: "req_1" }, data: { status } });

    await expect(start("req_1")).rejects.toThrow(errorType);
    expect(useroutr.created.size).toBe(0);
  });

  it("refuses a request that does not exist", async () => {
    await expect(start("req_missing")).rejects.toThrow(RequestNotFoundError);
  });
});

describe("reusable requests", () => {
  async function reusableRequest(
    id: string,
    fields: { amountKind?: "FIXED" | "OPEN"; amount?: string | null; minimumAmount?: string } = {},
  ) {
    await database.request.create({
      data: {
        id,
        userId: "usr_1",
        kind: "REUSABLE",
        amountKind: fields.amountKind ?? "FIXED",
        amount: fields.amount === undefined ? "10" : fields.amount,
        minimumAmount: fields.minimumAmount ?? null,
        assetId: "asset_usdc_stellar",
        payoutAddressId: "addr_1",
      },
    });
  }

  it("gives each visitor an intent of their own, and the same one when they return", async () => {
    await reusableRequest("req_reusable");
    const ada = visitor("vis_ada");
    const ben = visitor("vis_ben");

    const first = await start("req_reusable", undefined, ada);
    const again = await start("req_reusable", undefined, ada);
    const other = await start("req_reusable", undefined, ben);

    expect(again).toEqual(first);
    expect(other).not.toEqual(first);
    expect([...useroutr.created.keys()]).toEqual([
      "pomi:req_reusable:vis_ada:0",
      "pomi:req_reusable:vis_ben:0",
    ]);
    const intents = await database.requestIntent.findMany({
      where: { requestId: "req_reusable" },
      orderBy: { createdAt: "asc" },
    });
    expect(intents.map((intent) => [intent.exclusive, intent.visitId, intent.visitorId])).toEqual([
      [false, "vis_ada:0", "vis_ada"],
      [false, "vis_ben:0", "vis_ben"],
    ]);
  });

  it("stays open to more payments after one is credited", async () => {
    await reusableRequest("req_reusable");
    const ada = visitor("vis_ada");
    await start("req_reusable", undefined, ada);
    await database.requestIntent.updateMany({ data: { state: "CLOSED" } });

    await expect(start("req_reusable", undefined, ada)).resolves.toEqual({ token: "token_2" });
    expect([...useroutr.created.keys()].at(-1)).toBe("pomi:req_reusable:vis_ada:1");
  });

  it("gives a visitor one intent when they press Pay twice at once", async () => {
    await reusableRequest("req_reusable");
    useroutr.createDelayMs = 50;
    const ada = visitor("vis_ada");

    const results = await Promise.all([
      start("req_reusable", undefined, ada),
      start("req_reusable", undefined, ada),
    ]);

    expect(results[0]).toEqual(results[1]);
    expect(await database.requestIntent.count({ where: { requestId: "req_reusable" } })).toBe(1);
  });

  it("asks for the amount the payer chose on an open request", async () => {
    await reusableRequest("req_open", { amountKind: "OPEN", amount: null, minimumAmount: "5" });

    await start("req_open", "12.50");

    const [created] = [...useroutr.created.values()];
    expect(created?.request.amount).toBe("12.5");
  });

  it("starts a new intent when the same payer chooses another amount", async () => {
    await reusableRequest("req_open", { amountKind: "OPEN", amount: null });
    const ada = visitor("vis_ada");

    const first = await start("req_open", "5", ada);
    const second = await start("req_open", "6", ada);

    expect(second).not.toEqual(first);
    expect(useroutr.created.size).toBe(2);
  });

  it.each([
    ["no amount", undefined, InvalidAmountError],
    ["an amount below the minimum", "4.9999999", BelowMinimumError],
    ["an amount that is not one", "five", InvalidAmountError],
  ])("refuses %s on an open request", async (_case, amount, errorType) => {
    await reusableRequest("req_open", { amountKind: "OPEN", amount: null, minimumAmount: "5" });

    await expect(start("req_open", amount)).rejects.toThrow(errorType);
    expect(useroutr.created.size).toBe(0);
  });

  it("ignores an amount sent for a fixed request", async () => {
    await reusableRequest("req_reusable");

    await start("req_reusable", "0.01");

    expect([...useroutr.created.values()][0]?.request.amount).toBe("10");
  });
});

describe("limits and end dates", () => {
  it("refuses a request past its end date", async () => {
    await database.request.update({
      where: { id: "req_1" },
      data: { endsAt: new Date(currentTime.getTime() - 1) },
    });

    await expect(start("req_1")).rejects.toThrow(RequestEndedError);
  });

  it("lets one visitor start five intents in ten minutes, then waits", async () => {
    for (let index = 0; index < 5; index += 1) {
      await database.request.create({
        data: {
          id: `req_limit_${String(index)}`,
          userId: "usr_1",
          kind: "SINGLE",
          amountKind: "FIXED",
          amount: "1",
          assetId: "asset_usdc_stellar",
          payoutAddressId: "addr_1",
        },
      });
      await start(`req_limit_${String(index)}`, undefined, visitor("vis_busy"));
      advance(MINUTE_MS);
    }

    const refusal = start("req_1", undefined, visitor("vis_busy"));

    await expect(refusal).rejects.toThrow(CheckoutRateLimitedError);
    await expect(refusal).rejects.toMatchObject({ retryAfterSeconds: 5 * 60 });
    await expect(start("req_1", undefined, visitor("vis_other"))).resolves.toHaveProperty("token");
  });

  it("limits one address across visitors", async () => {
    for (let index = 0; index < 20; index += 1) {
      await database.request.create({
        data: {
          id: `req_ip_${String(index)}`,
          userId: "usr_1",
          kind: "SINGLE",
          amountKind: "FIXED",
          amount: "1",
          assetId: "asset_usdc_stellar",
          payoutAddressId: "addr_1",
        },
      });
      await start(`req_ip_${String(index)}`, undefined, visitor(undefined, "client_a"));
    }

    await expect(start("req_1", undefined, visitor(undefined, "client_a"))).rejects.toThrow(
      CheckoutRateLimitedError,
    );
    await expect(start("req_1", undefined, visitor(undefined, "client_b"))).resolves.toHaveProperty(
      "token",
    );
  });

  it("costs nothing to reopen a live intent", async () => {
    await start("req_1", undefined, visitor("vis_busy"));

    for (let index = 0; index < 10; index += 1) {
      await expect(start("req_1", undefined, visitor("vis_busy"))).resolves.toEqual({
        token: "token_1",
      });
    }
  });
});
