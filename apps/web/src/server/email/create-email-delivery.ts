import "server-only";
import { type EmailDeliveryConfig } from "../config";
import { createConsoleEmailDelivery } from "./console-email-delivery";
import { type EmailDelivery } from "./email-delivery";
import { createResendEmailDelivery } from "./resend-email-delivery";

export function createEmailDelivery(config: EmailDeliveryConfig): EmailDelivery {
  switch (config.provider) {
    case "console":
      return createConsoleEmailDelivery();
    case "resend":
      return createResendEmailDelivery({ apiKey: config.apiKey, from: config.from });
  }
}
