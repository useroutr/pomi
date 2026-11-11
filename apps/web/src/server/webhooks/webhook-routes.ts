import "server-only";
import { WebhookSignatureError } from "@useroutr/sdk";
import { type NextRequest } from "next/server";
import { type WebhookService } from "./webhook-service";

// The signature covers the exact bytes sent, so the body is read as text and
// never parsed and re-serialized before it is checked. Any other failure
// throws, Next answers 500, and Useroutr delivers the event again.
export async function handleUseroutrWebhook(
  request: NextRequest,
  webhooks: Pick<WebhookService, "handleDelivery">,
  afterProcessing: () => void,
): Promise<Response> {
  const payload = await request.text();
  try {
    const outcome = await webhooks.handleDelivery(
      payload,
      request.headers.get("useroutr-signature") ?? undefined,
      request.headers.get("useroutr-event-id") ?? undefined,
    );
    if (outcome === "processed") {
      afterProcessing();
    }
  } catch (error) {
    if (error instanceof WebhookSignatureError) {
      return new Response("invalid signature", { status: 400 });
    }
    throw error;
  }
  return new Response(null, { status: 200 });
}
