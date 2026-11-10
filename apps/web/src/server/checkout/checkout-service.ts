import "server-only";
import { type FundingIntentStatus } from "@useroutr/sdk";
import { Prisma } from "@/generated/prisma/client";
import { type Database } from "../database";
import { newId } from "../ids";
import {
  RequestAlreadyPaidError,
  RequestClosedError,
  RequestNotFoundError,
} from "../requests/request-errors";
import { type UseroutrGateway } from "../useroutr/useroutr-gateway";
import {
  checkoutRequest,
  closedExclusiveIntentCount,
  closeIntent,
  insertExclusiveIntent,
  openExclusiveIntent,
} from "./request-intent-repository";

// An intent in one of these took no payment that still counts, so the
// request may start another. In any other state a payment may be on its way,
// and a second payable intent could have the invoice paid twice.
const REPLACEABLE: ReadonlySet<FundingIntentStatus> = new Set([
  "EXPIRED",
  "FAILED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
]);

export interface CheckoutServiceDependencies {
  database: Database;
  useroutr: Pick<UseroutrGateway, "createFundingIntent" | "fundingIntentStatus">;
  now?: () => Date;
}

export type CheckoutService = ReturnType<typeof createCheckoutService>;

export function createCheckoutService({
  database,
  useroutr,
  now = () => new Date(),
}: CheckoutServiceDependencies) {
  // Returns the funding token of the request's one live intent, creating it
  // when there is none. Every visitor to a single-use request shares it.
  async function startCheckout(requestId: string): Promise<{ token: string }> {
    const request = await checkoutRequest(database, requestId);
    // Reusable requests, with an intent per visit, follow in phase 1.
    if (request?.kind !== "SINGLE" || request.amount === null) {
      throw new RequestNotFoundError();
    }
    if (request.status === "PAID") {
      throw new RequestAlreadyPaidError();
    }
    if (request.status === "CLOSED") {
      throw new RequestClosedError();
    }

    const open = await openExclusiveIntent(database, requestId);
    if (open !== null) {
      if (open.expiresAt > now()) {
        return { token: open.fundingToken };
      }
      const status = await useroutr.fundingIntentStatus(open.fundingIntentId);
      if (status === "CREDITED") {
        // Its webhook has not arrived yet; only the webhook marks it paid.
        throw new RequestAlreadyPaidError();
      }
      if (!REPLACEABLE.has(status)) {
        return { token: open.fundingToken };
      }
      await closeIntent(database, open.fundingIntentId, now());
    }

    // The key names the request's next intent, so visitors arriving
    // together send the same key and Useroutr creates one intent for all.
    const generation = await closedExclusiveIntentCount(database, requestId);
    const amount = request.amount.toString();
    const created = await useroutr.createFundingIntent({
      amount,
      assetId: request.assetId,
      payoutAddress: request.payoutAddress.address,
      reference: request.id,
      idempotencyKey: `pomi:${request.id}:${String(generation)}`,
    });
    try {
      await insertExclusiveIntent(database, {
        id: newId("int"),
        requestId,
        fundingIntentId: created.id,
        fundingToken: created.token,
        amount,
        expiresAt: created.expiresAt,
        createdAt: now(),
      });
      return { token: created.token };
    } catch (error) {
      // Another visitor stored the intent first: theirs is the one to use.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const stored = await openExclusiveIntent(database, requestId);
        if (stored !== null) {
          return { token: stored.fundingToken };
        }
      }
      throw error;
    }
  }

  return { startCheckout };
}
