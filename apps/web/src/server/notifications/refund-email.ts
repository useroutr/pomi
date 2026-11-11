import { product } from "@pomi/shared";
import { type EmailMessage } from "../email/email-delivery";

// To the operator, never a payer: payers are anonymous, so in phase 1 the
// operator finds the payer and names the destination (docs/spec.md, section 9).
export function refundAlertEmail(
  to: string,
  refund: { id: string; fundingIntentId: string },
): EmailMessage {
  const lines = [
    `Useroutr cannot send refund ${refund.id} on its own: it needs a destination.`,
    `The refund is for funding intent ${refund.fundingIntentId}. Find the payer, then name the destination with refunds.update from @useroutr/sdk.`,
  ];
  return {
    to,
    subject: `A ${product.name} refund needs a destination`,
    text: lines.join("\n\n"),
    html: lines.map((line) => `<p>${line}</p>`).join("\n"),
  };
}
