import { describe, expect, it } from "vitest";
import { EmailDeliveryError } from "./email-delivery";
import { createResendEmailDelivery } from "./resend-email-delivery";

const message = {
  to: "receiver@example.com",
  subject: "123456 is your Pomi sign-in code",
  text: "Your Pomi sign-in code is 123456.",
  html: "<p>123456</p>",
};

interface RecordedCall {
  url: string;
  init: RequestInit | undefined;
}

function deliveryAnswering(answer: Response | Error) {
  const calls: RecordedCall[] = [];
  const fetchStub: typeof fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  const delivery = createResendEmailDelivery({
    apiKey: "re_secret_key",
    from: "Pomi <hello@pomi.app>",
    fetch: fetchStub,
  });
  return { calls, delivery };
}

async function failureOf(promise: Promise<unknown>): Promise<EmailDeliveryError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof EmailDeliveryError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected the send to fail");
}

describe("createResendEmailDelivery", () => {
  it("posts the message to Resend with the key as a bearer token", async () => {
    const { calls, delivery } = deliveryAnswering(Response.json({ id: "email_1" }));

    await delivery.send(message);

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe("https://api.resend.com/emails");
    expect(call?.init?.method).toBe("POST");
    expect(new Headers(call?.init?.headers).get("authorization")).toBe("Bearer re_secret_key");
    const body = call?.init?.body;
    expect(typeof body).toBe("string");
    expect(JSON.parse(typeof body === "string" ? body : "null")).toEqual({
      from: "Pomi <hello@pomi.app>",
      to: ["receiver@example.com"],
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  });

  it("passes an idempotency key on, so a retry cannot email twice", async () => {
    const { calls, delivery } = deliveryAnswering(Response.json({ id: "email_1" }));

    await delivery.send(message, { idempotencyKey: "email_abc" });

    expect(new Headers(calls[0]?.init?.headers).get("idempotency-key")).toBe("email_abc");
  });

  it("names Resend's condition when it refuses, without quoting its message", async () => {
    const { delivery } = deliveryAnswering(
      Response.json(
        { name: "validation_error", message: "Invalid `to` field: receiver@example.com" },
        { status: 422 },
      ),
    );

    const error = await failureOf(delivery.send(message));

    expect(error.message).toBe("Resend refused the message (422 validation_error)");
    expect(error.message).not.toContain("receiver@example.com");
  });

  it("fails when Resend cannot be reached", async () => {
    const { delivery } = deliveryAnswering(new TypeError("fetch failed"));

    const error = await failureOf(delivery.send(message));

    expect(error.message).toBe("Resend could not be reached");
    expect(error.cause).toBeInstanceOf(TypeError);
  });

  it("fails when Resend accepts without a message id", async () => {
    const { delivery } = deliveryAnswering(new Response("ok", { status: 200 }));

    const error = await failureOf(delivery.send(message));

    expect(error.message).toBe("Resend answered without a message id");
  });
});
