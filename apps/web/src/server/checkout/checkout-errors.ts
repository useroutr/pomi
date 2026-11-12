export class CheckoutRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many payments started from here. Try again in a few minutes.");
    this.name = "CheckoutRateLimitedError";
  }
}

export class BelowMinimumError extends Error {
  constructor(minimum: string) {
    super(`Pay at least ${minimum}.`);
    this.name = "BelowMinimumError";
  }
}
