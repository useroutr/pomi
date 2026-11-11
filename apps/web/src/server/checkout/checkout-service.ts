import "server-only";
import { InvalidAmountError, parseRequestAmount } from "@pomi/shared";
import { type FundingIntentStatus } from "@useroutr/sdk";
import { Prisma } from "@/generated/prisma/client";
import { type Database } from "../database";
import { newId } from "../ids";
import {
  RequestAlreadyPaidError,
  RequestClosedError,
  RequestEndedError,
  RequestNotFoundError,
} from "../requests/request-errors";
import { type UseroutrGateway } from "../useroutr/useroutr-gateway";
import { BelowMinimumError, CheckoutRateLimitedError } from "./checkout-errors";
import {
  checkoutRequest,
  closedExclusiveIntentCount,
  closeIntent,
  insertIntent,
  intentByVisit,
  intentsStartedSince,
  liveVisitorIntent,
  openExclusiveIntent,
  visitorIntentCount,
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

// New intents each visitor and each IP address may start in the window.
// Reusing a live intent costs nothing; these bound what one person can make
// Useroutr create by reloading or clearing cookies.
const LIMIT_WINDOW_MS = 10 * 60_000;
const INTENTS_PER_VISITOR = 5;
const INTENTS_PER_CLIENT = 20;

export interface CheckoutVisitor {
  visitorId: string;
  // An HMAC of the client's IP address, or null when the host gives none.
  clientKey: string | null;
}

export interface CheckoutServiceDependencies {
  database: Database;
  useroutr: Pick<UseroutrGateway, "createFundingIntent" | "fundingIntentStatus">;
  now?: () => Date;
}

type CheckoutRequest = NonNullable<Awaited<ReturnType<typeof checkoutRequest>>>;

export type CheckoutService = ReturnType<typeof createCheckoutService>;

export function createCheckoutService({
  database,
  useroutr,
  now = () => new Date(),
}: CheckoutServiceDependencies) {
  // Returns the funding token of the intent this visitor should pay. Every
  // visitor to a single-use request shares one; on a reusable request each
  // visit has its own, for the amount the payer chose when it is open.
  async function startCheckout(
    requestId: string,
    payerAmount: string | undefined,
    visitor: CheckoutVisitor,
  ): Promise<{ token: string }> {
    const request = await checkoutRequest(database, requestId);
    if (request === null) {
      throw new RequestNotFoundError();
    }
    if (request.status === "PAID") {
      throw new RequestAlreadyPaidError();
    }
    if (request.status === "CLOSED") {
      throw new RequestClosedError();
    }
    if (request.endsAt !== null && request.endsAt <= now()) {
      throw new RequestEndedError();
    }
    const amount = intentAmount(request, payerAmount);
    return request.kind === "SINGLE"
      ? sharedIntent(request, amount, visitor)
      : visitIntent(request, amount, visitor);
  }

  async function sharedIntent(request: CheckoutRequest, amount: string, visitor: CheckoutVisitor) {
    const open = await openExclusiveIntent(database, request.id);
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
    await assertWithinLimits(visitor);
    // The key names the request's next intent, so visitors arriving
    // together send the same key and Useroutr creates one intent for all.
    const generation = await closedExclusiveIntentCount(database, request.id);
    return createAndStore(request, amount, visitor, {
      exclusive: true,
      visitId: null,
      idempotencyKey: `pomi:${request.id}:${String(generation)}`,
    });
  }

  // A visit is one payer's attempt: a new amount, or a return after the last
  // intent expired, is a new visit with an intent of its own.
  async function visitIntent(request: CheckoutRequest, amount: string, visitor: CheckoutVisitor) {
    const live = await liveVisitorIntent(database, {
      requestId: request.id,
      visitorId: visitor.visitorId,
      amount,
      now: now(),
    });
    if (live !== null) {
      return { token: live.fundingToken };
    }
    await assertWithinLimits(visitor);
    const visitNumber = await visitorIntentCount(database, request.id, visitor.visitorId);
    const visitId = `${visitor.visitorId}:${String(visitNumber)}`;
    return createAndStore(request, amount, visitor, {
      exclusive: false,
      visitId,
      idempotencyKey: `pomi:${request.id}:${visitId}`,
    });
  }

  async function createAndStore(
    request: CheckoutRequest,
    amount: string,
    visitor: CheckoutVisitor,
    intent: { exclusive: boolean; visitId: string | null; idempotencyKey: string },
  ) {
    const created = await useroutr.createFundingIntent({
      amount,
      assetId: request.assetId,
      payoutAddress: request.payoutAddress.address,
      reference: request.id,
      idempotencyKey: intent.idempotencyKey,
    });
    try {
      await insertIntent(database, {
        id: newId("int"),
        requestId: request.id,
        fundingIntentId: created.id,
        fundingToken: created.token,
        amount,
        exclusive: intent.exclusive,
        visitId: intent.visitId,
        visitorId: visitor.visitorId,
        clientKey: visitor.clientKey,
        expiresAt: created.expiresAt,
        createdAt: now(),
      });
      return { token: created.token };
    } catch (error) {
      // Another request with the same key stored the intent first: theirs is
      // the one to use.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const stored =
          intent.visitId === null
            ? await openExclusiveIntent(database, request.id)
            : await intentByVisit(database, request.id, intent.visitId);
        if (stored !== null) {
          return { token: stored.fundingToken };
        }
      }
      throw error;
    }
  }

  async function assertWithinLimits(visitor: CheckoutVisitor) {
    const since = new Date(now().getTime() - LIMIT_WINDOW_MS);
    const checks: { starter: { visitorId: string } | { clientKey: string }; limit: number }[] = [
      { starter: { visitorId: visitor.visitorId }, limit: INTENTS_PER_VISITOR },
    ];
    if (visitor.clientKey !== null) {
      checks.push({ starter: { clientKey: visitor.clientKey }, limit: INTENTS_PER_CLIENT });
    }
    for (const { starter, limit } of checks) {
      const started = await intentsStartedSince(database, starter, since);
      const oldestCounted = started.at(-limit);
      if (started.length >= limit && oldestCounted !== undefined) {
        const freeAt = oldestCounted.createdAt.getTime() + LIMIT_WINDOW_MS;
        throw new CheckoutRateLimitedError(
          Math.max(1, Math.ceil((freeAt - now().getTime()) / 1000)),
        );
      }
    }
  }

  return { startCheckout };
}

// What the intent asks for: the request's fixed amount, or the payer's
// choice when the receiver left it open, checked against the minimum.
function intentAmount(request: CheckoutRequest, payerAmount: string | undefined): string {
  if (request.amountKind === "FIXED") {
    if (request.amount === null) {
      throw new RequestNotFoundError();
    }
    return request.amount.toString();
  }
  if (payerAmount === undefined) {
    throw new InvalidAmountError("Enter the amount you want to pay.");
  }
  const amount = parseRequestAmount(payerAmount);
  if (request.minimumAmount?.greaterThan(amount) === true) {
    throw new BelowMinimumError(request.minimumAmount.toString());
  }
  return amount;
}
