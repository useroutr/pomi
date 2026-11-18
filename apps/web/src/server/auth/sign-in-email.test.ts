import { describe, expect, it } from "vitest";
import { signInEmail } from "./sign-in-email";

const SIX_DIGITS = /(?<!\d)\d{6}(?!\d)/g;

describe("signInEmail", () => {
  const message = signInEmail("someone@example.com", "305040", 10);

  it("names the code in the subject, as code emails mail apps recognise do", () => {
    expect(message.subject).toBe("Your Pomi verification code: 305040");
  });

  it("states the code in one sentence of the text", () => {
    expect(message.text.split("\n")[0]).toBe("Your Pomi verification code is 305040.");
    expect(message.text).toContain("It works for 10 minutes.");
  });

  it("keeps the code whole in one element of the HTML", () => {
    expect(message.html).toMatch(/>305040<\/p>/);
  });

  it("hides no text, which filters can read as a trick", () => {
    expect(message.html).not.toMatch(/display:\s*none/);
  });

  it("holds no six-digit number but the code, so the code cannot be mistaken", () => {
    for (const part of [message.subject, message.text, message.html]) {
      expect(new Set(part.match(SIX_DIGITS))).toEqual(new Set(["305040"]));
    }
  });

  it("never puts the recipient in the message body", () => {
    expect(message.text).not.toContain("someone@example.com");
    expect(message.html).not.toContain("someone@example.com");
  });
});
