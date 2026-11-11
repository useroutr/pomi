export interface EmailMessage {
  to: string;
  subject: string;
  // The fallback for clients that do not render HTML.
  text: string;
  html: string;
}

export interface SendOptions {
  // The same key sent again within a day sends nothing new, so a retry after
  // an unclear failure cannot email twice.
  idempotencyKey?: string;
}

export interface EmailDelivery {
  send(message: EmailMessage, options?: SendOptions): Promise<void>;
}

// Its message names the provider and the condition, never the recipient, the
// body or a credential.
export class EmailDeliveryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EmailDeliveryError";
  }
}
