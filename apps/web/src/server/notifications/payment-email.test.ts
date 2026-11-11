import { describe, expect, it } from "vitest";
import { paymentEmail, stellarExpertTransactionUrl } from "./payment-email";

const details = {
  to: "receiver@example.com",
  amount: "25",
  assetSymbol: "USDC",
  note: "Logo design",
  settlementTransactionHash: "abc123",
  appUrl: "https://pomi.app",
  network: "mainnet" as const,
};

describe("paymentEmail", () => {
  it("says what was paid, for what, and links the payment and the dashboard", () => {
    const email = paymentEmail(details);

    expect(email.to).toBe("receiver@example.com");
    expect(email.subject).toBe("You were paid 25 USDC");
    expect(email.text).toContain('Your Pomi request for "Logo design" was paid.');
    expect(email.text).toContain("https://stellar.expert/explorer/public/tx/abc123");
    expect(email.text).toContain("https://pomi.app/dashboard");
  });

  it("escapes the note in the HTML part", () => {
    const email = paymentEmail({ ...details, note: '<script>alert("x")</script>' });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("leaves out the transaction link when there is no hash", () => {
    const email = paymentEmail({ ...details, note: null, settlementTransactionHash: null });

    expect(email.text).not.toContain("stellar.expert");
    expect(email.text).toContain("Your Pomi request was paid.");
  });
});

describe("stellarExpertTransactionUrl", () => {
  it("links testnet transactions to the testnet explorer", () => {
    expect(stellarExpertTransactionUrl("testnet", "abc")).toBe(
      "https://stellar.expert/explorer/testnet/tx/abc",
    );
  });
});
