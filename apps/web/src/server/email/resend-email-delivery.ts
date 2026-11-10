import "server-only";
import { z } from "zod";
import { type EmailDelivery, EmailDeliveryError, type EmailMessage } from "./email-delivery";

const SEND_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;

export interface ResendEmailDeliveryOptions {
  apiKey: string;
  from: string;
  fetch?: typeof fetch;
}

const sentSchema = z.object({ id: z.string().min(1) });

// A refusal names its condition (validation_error, invalid_api_key, ...). Its
// message is not kept: it can quote the recipient.
const refusalSchema = z.object({ name: z.string().min(1) });

export function createResendEmailDelivery(options: ResendEmailDeliveryOptions): EmailDelivery {
  const post = options.fetch ?? fetch;
  return {
    async send(message: EmailMessage) {
      let response: Response;
      try {
        response = await post(SEND_URL, {
          method: "POST",
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from: options.from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
          }),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
      } catch (error) {
        throw new EmailDeliveryError("Resend could not be reached", { cause: error });
      }
      const body = await readJson(response);
      if (!response.ok) {
        const refusal = refusalSchema.safeParse(body);
        const condition = refusal.success ? ` ${refusal.data.name}` : "";
        throw new EmailDeliveryError(
          `Resend refused the message (${String(response.status)}${condition})`,
        );
      }
      if (!sentSchema.safeParse(body).success) {
        throw new EmailDeliveryError("Resend answered without a message id");
      }
    },
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
