import "server-only";
import { z } from "zod";
import {
  type PushDelivery,
  PushDeliveryError,
  type PushMessage,
  type PushOutcome,
} from "./push-delivery";

const SEND_URL = "https://exp.host/--/api/v2/push/send";
const SEND_TIMEOUT_MS = 10_000;
// Expo takes at most 100 messages in one request.
const BATCH_SIZE = 100;

const ticketsSchema = z.object({
  data: z.array(
    z.union([
      z.object({ status: z.literal("ok") }),
      z.object({
        status: z.literal("error"),
        details: z.object({ error: z.string() }).optional(),
      }),
    ]),
  ),
});

export function createExpoPushDelivery(options: {
  accessToken: string | null;
  fetch?: typeof fetch;
}): PushDelivery {
  const post = options.fetch ?? fetch;

  async function sendBatch(messages: PushMessage[]): Promise<PushOutcome[]> {
    let response: Response;
    try {
      response = await post(SEND_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...(options.accessToken === null
            ? {}
            : { authorization: `Bearer ${options.accessToken}` }),
        },
        body: JSON.stringify(messages.map((message) => ({ ...message, sound: "default" }))),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
    } catch (error) {
      throw new PushDeliveryError("Expo could not be reached", { cause: error });
    }
    if (!response.ok) {
      throw new PushDeliveryError(`Expo refused the push request (${String(response.status)})`);
    }
    const tickets = ticketsSchema.safeParse(await response.json());
    if (!tickets.success || tickets.data.data.length !== messages.length) {
      throw new PushDeliveryError("Expo answered without a ticket for each message");
    }
    return tickets.data.data.map((ticket) => {
      if (ticket.status === "ok") {
        return "sent";
      }
      return ticket.details?.error === "DeviceNotRegistered" ? "unregistered" : "failed";
    });
  }

  return {
    async send(messages) {
      const outcomes: PushOutcome[] = [];
      for (let start = 0; start < messages.length; start += BATCH_SIZE) {
        outcomes.push(...(await sendBatch(messages.slice(start, start + BATCH_SIZE))));
      }
      return outcomes;
    },
  };
}
