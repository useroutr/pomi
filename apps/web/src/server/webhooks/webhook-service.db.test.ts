import { WebhookSignatureError } from "@useroutr/sdk";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { signWebhook, WEBHOOK_SECRET } from "@/test/fake-useroutr";
import { emptyTables, RECEIVER_ACCOUNT, testDatabase } from "@/test/test-database";
import { createUseroutrGateway } from "../useroutr/useroutr-gateway";
import { createWebhookService } from "./webhook-service";

const database = testDatabase();
const gateway = createUseroutrGateway({
  apiKey: "ur_test_key",
  apiUrl: "https://api.sandbox.useroutr.com",
  webhookSecret: WEBHOOK_SECRET,
});
const webhooks = createWebhookService({ database, useroutr: gateway, alertsOperator: true });

function fundingEvent(
  eventId: string,
  type: string,
  fundingIntentId: string,
  transferTransactionHash: string | null = "transfer_hash",
) {
  return JSON.stringify({
    id: eventId,
    object: "event",
    api_version: "1",
    application_id: "app_1",
    funding_intent_id: fundingIntentId,
    type,
    created_at: "2026-11-10T12:05:00.000Z",
    data: {
      object: {
        id: fundingIntentId,
        requirement: { amount: "25", asset: "asset_usdc_stellar" },
        status: type === "funding.credited" ? "CREDITED" : "EXPIRED",
        payment: type === "funding.credited" ? { transaction_hash: "payment_hash" } : null,
        settlement:
          type === "funding.credited"
            ? {
                // As Useroutr reports a deposit account payment: the payer's
                // payment, then the transfer that paid the receiver.
                transaction_hash: "payment_hash",
                transfer_transaction_hash: transferTransactionHash,
                destination: { amount: "25" },
              }
            : null,
      },
    },
  });
}

function deliver(payload: string, eventId: string) {
  return webhooks.handleDelivery(payload, signWebhook(payload, eventId), eventId);
}

beforeEach(async () => {
  await emptyTables(database);
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
  await database.requestIntent.create({
    data: {
      id: "int_1",
      requestId: "req_1",
      fundingIntentId: "fi_1",
      fundingToken: "token_1",
      amount: "25",
      exclusive: true,
      expiresAt: new Date("2026-11-10T12:30:00Z"),
    },
  });
});

afterAll(async () => {
  await database.$disconnect();
});

describe("funding.credited", () => {
  it("records the payment with its hashes, marks the request paid and queues one email", async () => {
    await expect(deliver(fundingEvent("evt_1", "funding.credited", "fi_1"), "evt_1")).resolves.toBe(
      "processed",
    );

    const payment = await database.requestPayment.findFirstOrThrow();
    expect(payment).toMatchObject({
      requestId: "req_1",
      fundingIntentId: "fi_1",
      assetId: "asset_usdc_stellar",
      paymentTransactionHash: "payment_hash",
      settlementTransactionHash: "transfer_hash",
      creditedAt: new Date("2026-11-10T12:05:00.000Z"),
    });
    expect(payment.amount.toString()).toBe("25");
    await expect(
      database.request.findUniqueOrThrow({ where: { id: "req_1" } }),
    ).resolves.toMatchObject({
      status: "PAID",
    });
    await expect(
      database.requestIntent.findUniqueOrThrow({ where: { id: "int_1" } }),
    ).resolves.toMatchObject({
      state: "CLOSED",
    });
    await expect(database.outboxEmail.findFirstOrThrow()).resolves.toMatchObject({
      kind: "PAYMENT_RECEIVED",
      requestPaymentId: payment.id,
      sentAt: null,
    });
    await expect(database.outboxPush.findFirstOrThrow()).resolves.toMatchObject({
      requestPaymentId: payment.id,
      sentAt: null,
    });
  });

  it("keeps a reusable request open for its next payment", async () => {
    await database.request.update({ where: { id: "req_1" }, data: { kind: "REUSABLE" } });
    await database.requestIntent.update({
      where: { id: "int_1" },
      data: { exclusive: false, visitId: "vis_1:0", visitorId: "vis_1" },
    });

    await deliver(fundingEvent("evt_1", "funding.credited", "fi_1"), "evt_1");

    expect(await database.requestPayment.count()).toBe(1);
    await expect(
      database.request.findUniqueOrThrow({ where: { id: "req_1" } }),
    ).resolves.toMatchObject({
      status: "OPEN",
    });
  });

  it("keeps the settlement's own hash when there was no separate transfer", async () => {
    await deliver(fundingEvent("evt_1", "funding.credited", "fi_1", null), "evt_1");

    await expect(database.requestPayment.findFirstOrThrow()).resolves.toMatchObject({
      settlementTransactionHash: "payment_hash",
    });
  });

  it("changes nothing when the same event is delivered again", async () => {
    const payload = fundingEvent("evt_1", "funding.credited", "fi_1");
    await deliver(payload, "evt_1");

    await expect(deliver(payload, "evt_1")).resolves.toBe("duplicate");

    expect(await database.requestPayment.count()).toBe(1);
    expect(await database.outboxEmail.count()).toBe(1);
    expect(await database.outboxPush.count()).toBe(1);
  });

  it("records one payment when two copies arrive at the same moment", async () => {
    const payload = fundingEvent("evt_1", "funding.credited", "fi_1");

    const outcomes = await Promise.all([deliver(payload, "evt_1"), deliver(payload, "evt_1")]);

    expect(outcomes.sort()).toEqual(["duplicate", "processed"]);
    expect(await database.requestPayment.count()).toBe(1);
    expect(await database.outboxEmail.count()).toBe(1);
  });

  it("records one payment for an intent credited under two event ids", async () => {
    await deliver(fundingEvent("evt_1", "funding.credited", "fi_1"), "evt_1");

    await expect(deliver(fundingEvent("evt_2", "funding.credited", "fi_1"), "evt_2")).resolves.toBe(
      "processed",
    );
    expect(await database.requestPayment.count()).toBe(1);
  });

  it("records a payment to a closed request, which stays closed", async () => {
    await database.request.update({ where: { id: "req_1" }, data: { status: "CLOSED" } });

    await deliver(fundingEvent("evt_1", "funding.credited", "fi_1"), "evt_1");

    expect(await database.requestPayment.count()).toBe(1);
    await expect(
      database.request.findUniqueOrThrow({ where: { id: "req_1" } }),
    ).resolves.toMatchObject({
      status: "CLOSED",
    });
  });

  it("acknowledges an intent that is not Pomi's without recording a payment", async () => {
    await expect(
      deliver(fundingEvent("evt_1", "funding.credited", "fi_other"), "evt_1"),
    ).resolves.toBe("processed");
    expect(await database.requestPayment.count()).toBe(0);
  });

  it("refuses an event without the fields a payment needs, so Useroutr retries it", async () => {
    const payload = JSON.stringify({
      ...JSON.parse(fundingEvent("evt_1", "funding.credited", "fi_1")),
      data: { object: { id: "fi_1" } },
    });

    await expect(deliver(payload, "evt_1")).rejects.toThrow();
    expect(await database.webhookEvent.count()).toBe(0);
  });
});

describe("other events", () => {
  it.each(["funding.expired", "funding.failed"])("closes the intent on %s", async (type) => {
    await deliver(fundingEvent("evt_1", type, "fi_1"), "evt_1");

    await expect(
      database.requestIntent.findUniqueOrThrow({ where: { id: "int_1" } }),
    ).resolves.toMatchObject({
      state: "CLOSED",
    });
    await expect(
      database.request.findUniqueOrThrow({ where: { id: "req_1" } }),
    ).resolves.toMatchObject({
      status: "OPEN",
    });
  });

  it("records an event Pomi does not act on, so it is not processed twice", async () => {
    await deliver(fundingEvent("evt_1", "funding.settling", "fi_1"), "evt_1");

    expect(await database.webhookEvent.count()).toBe(1);
    expect(await database.requestPayment.count()).toBe(0);
  });
});

describe("refunds", () => {
  function refundEvent(eventId: string, type: string, status = "PENDING") {
    return JSON.stringify({
      id: eventId,
      object: "event",
      api_version: "1",
      application_id: "app_1",
      funding_intent_id: "fi_1",
      type,
      created_at: "2026-11-10T12:10:00.000Z",
      data: { object: { id: "ref_1", funding_intent_id: "fi_1", status } },
    });
  }

  it("records a refund that needs a destination and alerts the operator once", async () => {
    await deliver(refundEvent("evt_1", "refund.destination_required"), "evt_1");
    await deliver(refundEvent("evt_2", "refund.destination_required"), "evt_2");

    await expect(
      database.refund.findUniqueOrThrow({ where: { id: "ref_1" } }),
    ).resolves.toMatchObject({
      fundingIntentId: "fi_1",
      status: "PENDING",
      destinationRequiredAt: new Date("2026-11-10T12:10:00.000Z"),
    });
    await expect(database.outboxEmail.findMany()).resolves.toMatchObject([
      { kind: "REFUND_DESTINATION_REQUIRED", refundId: "ref_1", requestPaymentId: null },
    ]);
  });

  it("follows a refund's status as it completes", async () => {
    await deliver(refundEvent("evt_1", "refund.created"), "evt_1");
    await deliver(refundEvent("evt_2", "refund.completed", "COMPLETED"), "evt_2");

    await expect(
      database.refund.findUniqueOrThrow({ where: { id: "ref_1" } }),
    ).resolves.toMatchObject({
      status: "COMPLETED",
      destinationRequiredAt: null,
    });
    expect(await database.outboxEmail.count()).toBe(0);
  });

  it("records the refund but emails no one when no operator is set", async () => {
    const quiet = createWebhookService({ database, useroutr: gateway, alertsOperator: false });
    const payload = refundEvent("evt_1", "refund.destination_required");

    await quiet.handleDelivery(payload, signWebhook(payload, "evt_1"), "evt_1");

    expect(await database.refund.count()).toBe(1);
    expect(await database.outboxEmail.count()).toBe(0);
  });
});

describe("signatures", () => {
  it("refuses a delivery that is not signed by Useroutr, recording nothing", async () => {
    const payload = fundingEvent("evt_1", "funding.credited", "fi_1");

    await expect(
      webhooks.handleDelivery(payload, signWebhook(payload, "evt_1", "whsec_forged"), "evt_1"),
    ).rejects.toThrow(WebhookSignatureError);
    expect(await database.webhookEvent.count()).toBe(0);
    expect(await database.requestPayment.count()).toBe(0);
  });
});
