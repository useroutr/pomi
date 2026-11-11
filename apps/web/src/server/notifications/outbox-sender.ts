import "server-only";
import { type StellarNetwork } from "../config";
import { type Database } from "../database";
import { type EmailDelivery } from "../email/email-delivery";
import { type UseroutrGateway } from "../useroutr/useroutr-gateway";
import { claimUnsentEmails, markEmailSent, paymentEmailContent } from "./outbox-repository";
import { paymentEmail } from "./payment-email";

const BATCH_SIZE = 20;
const CLAIM_MS = 2 * 60_000;

export class OutboxDeliveryError extends Error {
  constructor(failures: string[]) {
    super(`${String(failures.length)} outbox emails could not be sent: ${failures.join("; ")}`);
    this.name = "OutboxDeliveryError";
  }
}

export interface OutboxSenderDependencies {
  database: Database;
  emailDelivery: EmailDelivery;
  useroutr: Pick<UseroutrGateway, "stellarAssets">;
  appUrl: string;
  network: StellarNetwork;
  now?: () => Date;
}

export type OutboxSender = ReturnType<typeof createOutboxSender>;

export function createOutboxSender({
  database,
  emailDelivery,
  useroutr,
  appUrl,
  network,
  now = () => new Date(),
}: OutboxSenderDependencies) {
  // Sends what is waiting. Throws after trying them all if any failed; the
  // failed ones are tried again once their claim lapses.
  async function sendPending(): Promise<{ sent: number }> {
    const emailIds = await claimUnsentEmails(database, {
      limit: BATCH_SIZE,
      now: now(),
      claimFor: CLAIM_MS,
    });
    if (emailIds.length === 0) {
      return { sent: 0 };
    }
    const symbols = new Map(
      (await useroutr.stellarAssets()).map((asset) => [asset.id, asset.symbol]),
    );
    const failures: string[] = [];
    let sent = 0;
    for (const emailId of emailIds) {
      try {
        const { requestPayment } = await paymentEmailContent(database, emailId);
        await emailDelivery.send(
          paymentEmail({
            to: requestPayment.request.user.email,
            amount: requestPayment.amount.toString(),
            assetSymbol: symbols.get(requestPayment.assetId) ?? requestPayment.assetId,
            note: requestPayment.request.note,
            settlementTransactionHash: requestPayment.settlementTransactionHash,
            appUrl,
            network,
          }),
          { idempotencyKey: emailId },
        );
        await markEmailSent(database, emailId, now());
        sent += 1;
      } catch (error) {
        failures.push(`${emailId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (failures.length > 0) {
      throw new OutboxDeliveryError(failures);
    }
    return { sent };
  }

  return { sendPending };
}
