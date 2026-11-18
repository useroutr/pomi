import "server-only";
import { type StellarNetwork } from "../config";
import { type Database } from "../database";
import { type EmailDelivery, type EmailMessage } from "../email/email-delivery";
import { type PushDelivery } from "../push/push-delivery";
import { type UseroutrGateway } from "../useroutr/useroutr-gateway";
import {
  claimUnsent,
  devicesOf,
  forgetDevices,
  markEmailSent,
  markPushSent,
  outboxEmailContent,
  outboxPushContent,
} from "./outbox-repository";
import { paymentEmail } from "./payment-email";
import { refundAlertEmail } from "./refund-email";

const BATCH_SIZE = 20;
const CLAIM_MS = 2 * 60_000;

export class OutboxDeliveryError extends Error {
  constructor(failures: string[]) {
    super(`${String(failures.length)} outbox messages could not be sent: ${failures.join("; ")}`);
    this.name = "OutboxDeliveryError";
  }
}

export interface OutboxSenderDependencies {
  database: Database;
  emailDelivery: EmailDelivery;
  pushDelivery: PushDelivery;
  useroutr: Pick<UseroutrGateway, "stellarAssets">;
  appUrl: string;
  network: StellarNetwork;
  operatorEmail: string | null;
  now?: () => Date;
}

export type OutboxSender = ReturnType<typeof createOutboxSender>;

export function createOutboxSender({
  database,
  emailDelivery,
  pushDelivery,
  useroutr,
  appUrl,
  network,
  operatorEmail,
  now = () => new Date(),
}: OutboxSenderDependencies) {
  // Sends what is waiting. Throws after trying everything if anything failed;
  // the failed rows are tried again once their claim lapses.
  async function sendPending(): Promise<{ emailsSent: number; pushesSent: number }> {
    const failures: string[] = [];
    const emailsSent = await sendEmails(failures);
    const pushesSent = await sendPushes(failures);
    if (failures.length > 0) {
      throw new OutboxDeliveryError(failures);
    }
    return { emailsSent, pushesSent };
  }

  async function sendEmails(failures: string[]): Promise<number> {
    const emailIds = await claimUnsent(database, "outbox_emails", claim());
    let sent = 0;
    for (const emailId of emailIds) {
      try {
        const message = await emailMessage(emailId);
        await emailDelivery.send(message, { idempotencyKey: emailId });
        await markEmailSent(database, emailId, now());
        sent += 1;
      } catch (error) {
        failures.push(describe(emailId, error));
      }
    }
    return sent;
  }

  async function emailMessage(emailId: string): Promise<EmailMessage> {
    const email = await outboxEmailContent(database, emailId);
    if (email.kind === "REFUND_DESTINATION_REQUIRED") {
      if (email.refund === null || operatorEmail === null) {
        throw new Error("a refund alert needs its refund and OPERATOR_EMAIL");
      }
      return refundAlertEmail(operatorEmail, email.refund);
    }
    if (email.requestPayment === null) {
      throw new Error("a payment email needs its payment");
    }
    const payment = email.requestPayment;
    return paymentEmail({
      to: payment.request.user.email,
      amount: payment.amount.toString(),
      assetSymbol: await assetSymbol(payment.assetId),
      note: payment.request.note,
      settlementTransactionHash: payment.settlementTransactionHash,
      appUrl,
      network,
    });
  }

  async function sendPushes(failures: string[]): Promise<number> {
    const pushIds = await claimUnsent(database, "outbox_pushes", claim());
    let sent = 0;
    for (const pushId of pushIds) {
      try {
        const { requestPayment: payment } = await outboxPushContent(database, pushId);
        const devices = await devicesOf(database, payment.request.user.id);
        const paid = `${payment.amount.toString()} ${await assetSymbol(payment.assetId)}`;
        const outcomes = await pushDelivery.send(
          devices.map((device) => ({
            to: device.pushToken,
            title: `You were paid ${paid}`,
            body: payment.request.note ?? "A request was paid.",
            data: { requestId: payment.request.id },
          })),
        );
        // A device that left is forgotten. Other per-device failures are not
        // retried: the email carries the same news.
        await forgetDevices(
          database,
          devices.flatMap((device, index) =>
            outcomes[index] === "unregistered" ? [device.pushToken] : [],
          ),
        );
        await markPushSent(database, pushId, now());
        sent += 1;
      } catch (error) {
        failures.push(describe(pushId, error));
      }
    }
    return sent;
  }

  function claim() {
    return { limit: BATCH_SIZE, now: now(), claimFor: CLAIM_MS };
  }

  async function assetSymbol(assetId: string): Promise<string> {
    const assets = await useroutr.stellarAssets();
    return assets.find((asset) => asset.id === assetId)?.symbol ?? assetId;
  }

  return { sendPending };
}

function describe(id: string, error: unknown): string {
  return `${id}: ${error instanceof Error ? error.message : String(error)}`;
}
