import { describe, expect, it } from "vitest";
import { createConsoleEmailDelivery } from "./console-email-delivery";

describe("createConsoleEmailDelivery", () => {
  it("writes the subject and text, and never the recipient", async () => {
    const written: string[] = [];
    const delivery = createConsoleEmailDelivery({
      write: (chunk: string | Uint8Array) => {
        written.push(String(chunk));
        return true;
      },
    });

    await delivery.send({
      to: "receiver@example.com",
      subject: "123456 is your Pomi sign-in code",
      text: "Your Pomi sign-in code is 123456.",
      html: "<p>123456</p>",
    });

    const output = written.join("");
    expect(output).toContain("123456 is your Pomi sign-in code");
    expect(output).toContain("Your Pomi sign-in code is 123456.");
    expect(output).not.toContain("receiver@example.com");
  });
});
