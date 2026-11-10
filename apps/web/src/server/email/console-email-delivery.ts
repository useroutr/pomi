import "server-only";
import { type EmailDelivery, type EmailMessage } from "./email-delivery";

// Local development only, so sign-in works without a mail provider: the
// message is written to the server's output. The configuration refuses it in
// a production build. The recipient is left out, since addresses are never
// logged.
export function createConsoleEmailDelivery(
  output: Pick<NodeJS.WriteStream, "write"> = process.stdout,
): EmailDelivery {
  return {
    send(message: EmailMessage) {
      output.write(`\n[email] ${message.subject}\n${message.text}\n\n`);
      return Promise.resolve();
    },
  };
}
