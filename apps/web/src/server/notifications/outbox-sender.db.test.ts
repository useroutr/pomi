import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { FakeUseroutr } from "@/test/fake-useroutr";
import { emptyTables, RECEIVER_ACCOUNT, testDatabase } from "@/test/test-database";
import {
  type EmailDelivery,
  EmailDeliveryError,
  type EmailMessage,
  type SendOptions,
} from "../email/email-delivery";
import {
  type PushDelivery,
  PushDeliveryError,
  type PushMessage,
  type PushOutcome,
} from "../push/push-delivery";
import { createOutboxSender, OutboxDeliveryError } from "./outbox-sender";

const database = testDatabase();
const IPHONE = "ExponentPushToken[iphone]";
const OLD_PHONE = "ExponentPushToken[old-phone]";

let currentTime: Date;
let sent: { message: EmailMessage; options: SendOptions | undefined }[];
let pushed: PushMessage[];
let emailFailing: boolean;
let pushFailing: boolean;
let unregistered: Set<string>;

const emailDelivery: EmailDelivery = {
  send(message, options) {
    if (emailFailing) {
      return Promise.reject(new EmailDeliveryError("Resend could not be reached"));
    }
    sent.push({ message, options });
    return Promise.resolve();
  },
};

const pushDelivery: PushDelivery = {
  send(messages) {
    if (pushFailing) {
      return Promise.reject(new PushDeliveryError("Expo could not be reached"));
    }
    pushed.push(...messages);
    return Promise.resolve(
      messages.map((message): PushOutcome =>
        unregistered.has(message.to) ? "unregistered" : "sent",
      ),
    );
  },
};

function sender(operatorEmail: string | null = "ops@pomi.app") {
  return createOutboxSender({
    database,
    emailDelivery,
    pushDelivery,
    useroutr: new FakeUseroutr(),
    appUrl: "https://pomi.app",
    network: "testnet",
    operatorEmail,
    now: () => currentTime,
  });
}

async function queuePayment(paymentId: string, emailId: string, pushId?: string) {
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
  if (pushId !== undefined) {
    await database.outboxPush.create({
      data: { id: pushId, requestPaymentId: paymentId, createdAt: currentTime },
    });
  }
}

beforeEach(async () => {
  await emptyTables(database);
  currentTime = new Date("2026-11-10T12:00:00Z");
  sent = [];
  pushed = [];
  emailFailing = false;
  pushFailing = false;
  unregistered = new Set();
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

describe("emails", () => {
  it("emails the receiver once, keyed by the outbox row", async () => {
    await queuePayment("pay_1", "email_1");

    await expect(sender().sendPending()).resolves.toEqual({ emailsSent: 1, pushesSent: 0 });
    await expect(sender().sendPending()).resolves.toEqual({ emailsSent: 0, pushesSent: 0 });

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
    emailFailing = true;

    await expect(sender().sendPending()).rejects.toThrow(OutboxDeliveryError);
    emailFailing = false;
    await expect(sender().sendPending()).resolves.toMatchObject({ emailsSent: 0 });
    currentTime = new Date(currentTime.getTime() + 3 * 60_000);
    await expect(sender().sendPending()).resolves.toMatchObject({ emailsSent: 1 });

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

    expect(results.reduce((total, result) => total + result.emailsSent, 0)).toBe(3);
    expect(sent.map((email) => email.options?.idempotencyKey).sort()).toEqual([
      "email_1",
      "email_2",
      "email_3",
    ]);
  });

  it("stops trying after eight attempts", async () => {
    await queuePayment("pay_1", "email_1");
    await database.outboxEmail.update({ where: { id: "email_1" }, data: { attempts: 8 } });

    await expect(sender().sendPending()).resolves.toMatchObject({ emailsSent: 0 });
  });

  it("tells the operator which refund needs a destination", async () => {
    await database.refund.create({
      data: {
        id: "ref_1",
        fundingIntentId: "fi_1",
        status: "PENDING",
        destinationRequiredAt: currentTime,
      },
    });
    await database.outboxEmail.create({
      data: {
        id: "email_r",
        kind: "REFUND_DESTINATION_REQUIRED",
        refundId: "ref_1",
        createdAt: currentTime,
      },
    });

    await sender().sendPending();

    expect(sent[0]?.message.to).toBe("ops@pomi.app");
    expect(sent[0]?.message.text).toContain("ref_1");
    expect(sent[0]?.message.text).toContain("fi_1");
  });
});

describe("push notifications", () => {
  async function registerDevice(id: string, pushToken: string) {
    await database.device.create({
      data: { id, userId: "usr_1", pushToken, platform: "IOS", createdAt: currentTime },
    });
  }

  it("notifies every device the receiver registered, once", async () => {
    await registerDevice("dev_1", IPHONE);
    await registerDevice("dev_2", OLD_PHONE);
    await queuePayment("pay_1", "email_1", "push_1");

    await expect(sender().sendPending()).resolves.toEqual({ emailsSent: 1, pushesSent: 1 });
    await sender().sendPending();

    expect(pushed.map((message) => message.to).sort()).toEqual([IPHONE, OLD_PHONE]);
    expect(pushed[0]).toMatchObject({
      title: "You were paid 25 USDC",
      body: "Logo design",
      data: { requestId: "req_1" },
    });
  });

  it("forgets a device Expo no longer knows", async () => {
    await registerDevice("dev_1", IPHONE);
    await registerDevice("dev_2", OLD_PHONE);
    unregistered.add(OLD_PHONE);
    await queuePayment("pay_1", "email_1", "push_1");

    await sender().sendPending();

    await expect(database.device.findMany({ select: { pushToken: true } })).resolves.toEqual([
      { pushToken: IPHONE },
    ]);
  });

  it("marks a push sent when the receiver has no devices", async () => {
    await queuePayment("pay_1", "email_1", "push_1");

    await expect(sender().sendPending()).resolves.toMatchObject({ pushesSent: 1 });
    expect(pushed).toHaveLength(0);
  });

  it("retries a push when Expo cannot be reached, and still sends the email", async () => {
    await registerDevice("dev_1", IPHONE);
    await queuePayment("pay_1", "email_1", "push_1");
    pushFailing = true;

    await expect(sender().sendPending()).rejects.toThrow(OutboxDeliveryError);

    expect(sent).toHaveLength(1);
    await expect(
      database.outboxPush.findUniqueOrThrow({ where: { id: "push_1" } }),
    ).resolves.toMatchObject({
      sentAt: null,
      attempts: 1,
    });
  });
});
