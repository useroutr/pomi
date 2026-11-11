import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { FakeUseroutr } from "@/test/fake-useroutr";
import { emptyTables, RECEIVER_ACCOUNT, testDatabase } from "@/test/test-database";
import {
  type EmailDelivery,
  EmailDeliveryError,
  type EmailMessage,
  type SendOptions,
} from "../email/email-delivery";
import { createOutboxSender, OutboxDeliveryError } from "./outbox-sender";

const database = testDatabase();

let currentTime: Date;
let sent: { message: EmailMessage; options: SendOptions | undefined }[];
let failing: boolean;

const delivery: EmailDelivery = {
  send(message, options) {
    if (failing) {
      return Promise.reject(new EmailDeliveryError("Resend could not be reached"));
    }
    sent.push({ message, options });
    return Promise.resolve();
  },
};

function sender() {
  return createOutboxSender({
    database,
    emailDelivery: delivery,
    useroutr: new FakeUseroutr(),
    appUrl: "https://pomi.app",
    network: "testnet",
    now: () => currentTime,
  });
}

async function queuePayment(paymentId: string, emailId: string) {
  await database.requestPayment.create({
    data: {
      id: paymentId,
      requestId: "req_1",
      fundingIntentId: `fi_${paymentId}`,
      amount: "25",
      assetId: "asset_usdc_stellar",
      settlementTransactionHash: "settlement_hash",
      creditedAt: currentTime,
    },
  });
  await database.outboxEmail.create({
    data: {
      id: emailId,
      kind: "PAYMENT_RECEIVED",
      requestPaymentId: paymentId,
      createdAt: currentTime,
    },
  });
}

beforeEach(async () => {
  await emptyTables(database);
  currentTime = new Date("2026-11-10T12:00:00Z");
  sent = [];
  failing = false;
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
      note: "Logo design",
      payoutAddressId: "addr_1",
    },
  });
});

afterAll(async () => {
  await database.$disconnect();
});

describe("sending the outbox", () => {
  it("emails the receiver once, keyed by the outbox row", async () => {
    await queuePayment("pay_1", "email_1");

    await expect(sender().sendPending()).resolves.toEqual({ sent: 1 });
    await expect(sender().sendPending()).resolves.toEqual({ sent: 0 });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.message).toMatchObject({
      to: "receiver@example.com",
      subject: "You were paid 25 USDC",
    });
    expect(sent[0]?.message.text).toContain(
      "https://stellar.expert/explorer/testnet/tx/settlement_hash",
    );
    expect(sent[0]?.options).toEqual({ idempotencyKey: "email_1" });
    await expect(
      database.outboxEmail.findUniqueOrThrow({ where: { id: "email_1" } }),
    ).resolves.toMatchObject({
      sentAt: currentTime,
      attempts: 1,
    });
  });

  it("keeps a failed email and tries it again once its claim lapses", async () => {
    await queuePayment("pay_1", "email_1");
    failing = true;

    await expect(sender().sendPending()).rejects.toThrow(OutboxDeliveryError);
    failing = false;
    await expect(sender().sendPending()).resolves.toEqual({ sent: 0 });
    currentTime = new Date(currentTime.getTime() + 3 * 60_000);
    await expect(sender().sendPending()).resolves.toEqual({ sent: 1 });

    await expect(
      database.outboxEmail.findUniqueOrThrow({ where: { id: "email_1" } }),
    ).resolves.toMatchObject({
      attempts: 2,
    });
  });

  it("sends each email once when two senders run together", async () => {
    await queuePayment("pay_1", "email_1");
    await queuePayment("pay_2", "email_2");
    await queuePayment("pay_3", "email_3");

    const results = await Promise.all([sender().sendPending(), sender().sendPending()]);

    expect(results.reduce((total, result) => total + result.sent, 0)).toBe(3);
    expect(sent.map((email) => email.options?.idempotencyKey).sort()).toEqual([
      "email_1",
      "email_2",
      "email_3",
    ]);
  });

  it("stops trying after eight attempts", async () => {
    await queuePayment("pay_1", "email_1");
    await database.outboxEmail.update({ where: { id: "email_1" }, data: { attempts: 8 } });

    await expect(sender().sendPending()).resolves.toEqual({ sent: 0 });
  });
});
