import { describe, expect, it } from "vitest";
import { SignInCodeRateLimitedError } from "./auth-errors";

describe("SignInCodeRateLimitedError", () => {
  it.each([
    [1, "1 second"],
    [42, "42 seconds"],
    [60, "1 minute"],
    [61, "2 minutes"],
    [3000, "50 minutes"],
  ])("tells the person to wait %i seconds as %j", (seconds, wait) => {
    expect(new SignInCodeRateLimitedError(seconds).message).toBe(
      `A code was sent to this address recently. Ask again in ${wait}.`,
    );
  });
});
