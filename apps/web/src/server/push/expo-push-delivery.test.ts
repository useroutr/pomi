import { describe, expect, it } from "vitest";
import { createExpoPushDelivery } from "./expo-push-delivery";
import { PushDeliveryError, type PushMessage } from "./push-delivery";

function message(to: string): PushMessage {
  return { to, title: "You were paid 5 XLM", body: "Logo", data: { requestId: "req_1" } };
}

function deliveryAnswering(answers: (Response | Error)[], accessToken: string | null = null) {
  const bodies: unknown[] = [];
  const headers: Headers[] = [];
  const delivery = createExpoPushDelivery({
    accessToken,
    fetch: (_input, init) => {
      bodies.push(JSON.parse(typeof init?.body === "string" ? init.body : "null"));
      headers.push(new Headers(init?.headers));
      const answer = answers.shift() ?? new Error("no answer left");
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
  });
  return { delivery, bodies, headers };
}

describe("createExpoPushDelivery", () => {
  it("sends each message with a sound, and reads one ticket per message", async () => {
    const { delivery, bodies } = deliveryAnswering([
      Response.json({
        data: [
          { status: "ok", id: "ticket_1" },
          { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } },
          { status: "error", message: "too big", details: { error: "MessageTooBig" } },
        ],
      }),
    ]);

    const outcomes = await delivery.send([message("a"), message("b"), message("c")]);

    expect(outcomes).toEqual(["sent", "unregistered", "failed"]);
    expect(bodies[0]).toEqual([
      { ...message("a"), sound: "default" },
      { ...message("b"), sound: "default" },
      { ...message("c"), sound: "default" },
    ]);
  });

  it("sends at most 100 messages a request", async () => {
    const tickets = (count: number) =>
      Response.json({ data: Array.from({ length: count }, () => ({ status: "ok", id: "t" })) });
    const { delivery, bodies } = deliveryAnswering([tickets(100), tickets(20)]);

    const outcomes = await delivery.send(
      Array.from({ length: 120 }, (_, index) => message(String(index))),
    );

    expect(outcomes).toHaveLength(120);
    expect(bodies.map((body) => (Array.isArray(body) ? body.length : 0))).toEqual([100, 20]);
  });

  it("sends the access token when the project has one", async () => {
    const { delivery, headers } = deliveryAnswering(
      [Response.json({ data: [{ status: "ok", id: "t" }] })],
      "expo_token",
    );

    await delivery.send([message("a")]);

    expect(headers[0]?.get("authorization")).toBe("Bearer expo_token");
  });

  it.each([
    ["Expo cannot be reached", new TypeError("fetch failed")],
    ["Expo refuses the request", new Response("no", { status: 401 })],
    ["the tickets do not match the messages", Response.json({ data: [] })],
  ])("fails when %s", async (_case, answer) => {
    const { delivery } = deliveryAnswering([answer]);

    await expect(delivery.send([message("a")])).rejects.toThrow(PushDeliveryError);
  });
});
