import "server-only";
import { type WebhookEvent } from "@useroutr/sdk";
import { z } from "zod";
import { type Prisma } from "@/generated/prisma/client";
import { closeIntent } from "../checkout/request-intent-repository";
import { type Database } from "../database";
import { newId } from "../ids";
import { type UseroutrGateway } from "../useroutr/useroutr-gateway";
import {
  insertPayment,
  insertProcessedEvent,
  intentForFundingIntent,
  markRequestPaid,
  paymentExists,
  queuePaymentEmail,
} from "./webhook-repository";

export type DeliveryOutcome = "processed" | "duplicate";

// The fields Pomi reads from a credited intent. The signature proves the
// event came from Useroutr; this proves it has the shape Pomi relies on.
const creditedIntentSchema = z.object({
  id: z.string().min(1),
  requirement: z.object({ amount: z.string().min(1), asset: z.string().min(1) }),
  payment: z.object({ transaction_hash: z.string().nullable() }).nullable(),
  settlement: z
    .object({
      transaction_hash: z.string(),
      destination: z.object({ amount: z.string().min(1) }),
    })
    .nullable(),
});

export interface WebhookServiceDependencies {
  database: Database;
  useroutr: Pick<UseroutrGateway, "constructWebhookEvent">;
  now?: () => Date;
}

export type WebhookService = ReturnType<typeof createWebhookService>;

export function createWebhookService({
  database,
  useroutr,
  now = () => new Date(),
}: WebhookServiceDependencies) {
  // Throws WebhookSignatureError for a delivery that is not Useroutr's.
  // Everything an event changes is written in one transaction with its
  // webhook_events row, so a delivery is either fully applied or, on error,
  // not at all and retried by Useroutr.
  async function handleDelivery(
    payload: string,
    signatureHeader: string | undefined,
    eventId: string | undefined,
  ): Promise<DeliveryOutcome> {
    const event = useroutr.constructWebhookEvent(payload, signatureHeader, eventId);
    return database.$transaction(async (transaction) => {
      if (
        !(await insertProcessedEvent(transaction, { id: event.id, type: event.type, at: now() }))
      ) {
        return "duplicate";
      }
      await apply(transaction, event);
      return "processed";
    });
  }

  async function apply(transaction: Prisma.TransactionClient, event: WebhookEvent) {
    switch (event.type) {
      case "funding.credited":
        await recordPayment(transaction, event.data.object, new Date(event.created_at));
        return;
      case "funding.expired":
      case "funding.failed":
        // The next visitor then starts a new intent without asking Useroutr.
        await closeIntent(transaction, event.data.object.id, now());
        return;
      default:
        // Acknowledged and recorded, so Useroutr stops sending it.
        return;
    }
  }

  async function recordPayment(
    transaction: Prisma.TransactionClient,
    object: unknown,
    creditedAt: Date,
  ) {
    const credited = creditedIntentSchema.parse(object);
    const intent = await intentForFundingIntent(transaction, credited.id);
    // Not one of Pomi's intents, or already recorded under another event.
    if (intent === null || (await paymentExists(transaction, credited.id))) {
      return;
    }
    const paymentId = newId("pay");
    await insertPayment(transaction, {
      id: paymentId,
      requestId: intent.requestId,
      fundingIntentId: credited.id,
      // What reached the receiver, which a direct payment makes equal to
      // what was asked for.
      amount: credited.settlement?.destination.amount ?? credited.requirement.amount,
      assetId: credited.requirement.asset,
      paymentTransactionHash: credited.payment?.transaction_hash ?? null,
      settlementTransactionHash: credited.settlement?.transaction_hash ?? null,
      creditedAt,
    });
    await closeIntent(transaction, credited.id, now());
    await markRequestPaid(transaction, intent.requestId);
    await queuePaymentEmail(transaction, {
      id: newId("email"),
      requestPaymentId: paymentId,
      createdAt: now(),
    });
  }

  return { handleDelivery };
}
