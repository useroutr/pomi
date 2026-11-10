export class InvalidEmailAddressError extends Error {
  constructor() {
    super("Enter a valid email address.");
    this.name = "InvalidEmailAddressError";
  }
}

// One error for a wrong, expired, used or exhausted code, so a guesser learns
// nothing about which it was.
export class InvalidSignInCodeError extends Error {
  constructor() {
    super("That code is wrong or has expired. Ask for a new one.");
    this.name = "InvalidSignInCodeError";
  }
}

export class SignInCodeRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(
      `A code was sent to this address recently. Ask again in ${waitDescription(retryAfterSeconds)}.`,
    );
    this.name = "SignInCodeRateLimitedError";
  }
}

function waitDescription(seconds: number): string {
  if (seconds < 60) {
    return seconds === 1 ? "1 second" : `${String(seconds)} seconds`;
  }
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "1 minute" : `${String(minutes)} minutes`;
}
