import { describe, expect, it } from "vitest";
import { InvalidEmailAddressError } from "./auth-errors";
import { parseEmailAddress } from "./email-address";

describe("parseEmailAddress", () => {
  it("trims and lowercases, so one inbox is one account", () => {
    expect(parseEmailAddress("  Receiver@Example.COM ")).toBe("receiver@example.com");
  });

  it.each(["", "receiver", "receiver@", "@example.com", `${"a".repeat(250)}@example.com`])(
    "refuses %j",
    (input) => {
      expect(() => parseEmailAddress(input)).toThrow(InvalidEmailAddressError);
    },
  );
});
