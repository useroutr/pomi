export interface PushMessage {
  // An Expo push token.
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

// Per message, in the order sent. "unregistered": the app was removed or the
// token expired, so the device should be forgotten.
export type PushOutcome = "sent" | "unregistered" | "failed";

export interface PushDelivery {
  send(messages: PushMessage[]): Promise<PushOutcome[]>;
}

// The request as a whole failed: nothing was sent, and it can be retried.
export class PushDeliveryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PushDeliveryError";
  }
}
