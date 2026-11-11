import { WebhookSignatureError } from "@useroutr/sdk";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { type DeliveryOutcome } from "./webhook-service";
import { handleUseroutrWebhook } from "./webhook-routes";

function delivery(body: string) {
  return new NextRequest("http://localhost:3000/api/webhooks/useroutr", {
    method: "POST",
    headers: { "useroutr-signature": "t=1,v1=abc", "useroutr-event-id": "evt_1" },
    body,
  });
}

describe("handleUseroutrWebhook", () => {
  it("passes the exact body and headers on, and sends email after a processed event", async () => {
    const received: unknown[] = [];
    let emailsScheduled = 0;

    const response = await handleUseroutrWebhook(
      delivery('{"id": "evt_1"}'),
      {
        handleDelivery: (...args) => {
          received.push(args);
          return Promise.resolve<DeliveryOutcome>("processed");
        },
      },
      () => {
        emailsScheduled += 1;
      },
    );

    expect(response.status).toBe(200);
    expect(received).toEqual([['{"id": "evt_1"}', "t=1,v1=abc", "evt_1"]]);
    expect(emailsScheduled).toBe(1);
  });

  it("acknowledges a duplicate without sending email", async () => {
    let emailsScheduled = 0;

    const response = await handleUseroutrWebhook(
      delivery("{}"),
      { handleDelivery: () => Promise.resolve<DeliveryOutcome>("duplicate") },
      () => {
        emailsScheduled += 1;
      },
    );

    expect(response.status).toBe(200);
    expect(emailsScheduled).toBe(0);
  });

  it("answers 400 to a bad signature", async () => {
    const response = await handleUseroutrWebhook(
      delivery("{}"),
      { handleDelivery: () => Promise.reject(new WebhookSignatureError("No signature matched")) },
      () => undefined,
    );

    expect(response.status).toBe(400);
  });

  it("rethrows any other failure, so Next answers 500 and Useroutr retries", async () => {
    const failure = new Error("database unreachable");

    await expect(
      handleUseroutrWebhook(
        delivery("{}"),
        { handleDelivery: () => Promise.reject(failure) },
        () => undefined,
      ),
    ).rejects.toBe(failure);
  });
});
