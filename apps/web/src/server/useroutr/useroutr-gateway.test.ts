import { Useroutr, WebhookSignatureError } from "@useroutr/sdk";
import { describe, expect, it } from "vitest";
import { signWebhook, WEBHOOK_SECRET } from "@/test/fake-useroutr";
import {
  createUseroutrGateway,
  DestinationRefusedError,
  UseroutrResponseError,
} from "./useroutr-gateway";

interface RecordedCall {
  url: string;
  init: RequestInit;
}

function gatewayAnswering(answers: Response[]) {
  const calls: RecordedCall[] = [];
  const client = new Useroutr({
    apiKey: "ur_test_key",
    maxRetries: 0,
    fetch: (url, init) => {
      calls.push({ url, init });
      const answer = answers.shift();
      return answer === undefined
        ? Promise.reject(new Error("no answer left"))
        : Promise.resolve(answer);
    },
  });
  const sleeps: number[] = [];
  const gateway = createUseroutrGateway({
    apiKey: "ur_test_key",
    webhookSecret: WEBHOOK_SECRET,
    client,
    sleep: (milliseconds) => {
      sleeps.push(milliseconds);
      return Promise.resolve();
    },
  });
  return { gateway, calls, sleeps };
}

const createdIntent = {
  id: "fi_1",
  hosted_funding_url: "https://checkout.sandbox.useroutr.com/fund/tok_abc",
  expires_at: "2026-11-10T12:30:00.000Z",
};

const newIntent = {
  amount: "25",
  assetId: "asset_usdc_stellar",
  payoutAddress: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  reference: "req_1",
  idempotencyKey: "pomi:req_1:0",
};

function apiError(status: number, code: string) {
  return Response.json(
    { error: { code, message: `refused: ${code}`, requestId: "req_x", retryable: status >= 500 } },
    { status },
  );
}

describe("createUseroutrGateway", () => {
  it("lists only Stellar assets, and caches the list", async () => {
    const { gateway, calls } = gatewayAnswering([
      Response.json({
        object: "list",
        data: [
          {
            id: "asset_usdc_stellar",
            object: "asset",
            network: "stellar",
            symbol: "USDC",
            decimals: 7,
            stellar_asset: "USDC:GISSUER",
            code: "USDC",
            issuer: "GISSUER",
            contract: "CCONTRACT",
          },
          {
            id: "asset_usdc_base",
            object: "asset",
            network: "base",
            symbol: "USDC",
            decimals: 6,
            contract: "0xabc",
          },
        ],
      }),
    ]);

    const assets = await gateway.stellarAssets();
    await gateway.stellarAssets();

    expect(assets).toEqual([
      { id: "asset_usdc_stellar", symbol: "USDC", code: "USDC", issuer: "GISSUER" },
    ]);
    expect(calls).toHaveLength(1);
  });

  it("creates an intent paying the receiver on Stellar, under the request's key", async () => {
    const { gateway, calls } = gatewayAnswering([Response.json(createdIntent, { status: 201 })]);

    const created = await gateway.createFundingIntent(newIntent);

    expect(created).toEqual({
      id: "fi_1",
      token: "tok_abc",
      expiresAt: new Date("2026-11-10T12:30:00.000Z"),
    });
    const [call] = calls;
    expect(call?.url).toBe("https://api.sandbox.useroutr.com/v1/funding-intents");
    expect(new Headers(call?.init.headers).get("idempotency-key")).toBe("pomi:req_1:0");
    expect(JSON.parse(typeof call?.init.body === "string" ? call.init.body : "null")).toEqual({
      amount: "25",
      asset: "asset_usdc_stellar",
      destination: {
        network: "stellar",
        asset: "asset_usdc_stellar",
        address: newIntent.payoutAddress,
      },
      reference: "req_1",
    });
  });

  it("waits for another visitor's identical request, then takes its replayed answer", async () => {
    const { gateway, calls, sleeps } = gatewayAnswering([
      apiError(409, "IDEMPOTENCY_REQUEST_IN_PROGRESS"),
      apiError(409, "IDEMPOTENCY_REQUEST_IN_PROGRESS"),
      Response.json(createdIntent, { status: 201 }),
    ]);

    await expect(gateway.createFundingIntent(newIntent)).resolves.toMatchObject({ id: "fi_1" });
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([300, 600]);
  });

  it("gives up after five tries while the other request is still running", async () => {
    const { gateway, calls } = gatewayAnswering(
      Array.from({ length: 5 }, () => apiError(409, "IDEMPOTENCY_REQUEST_IN_PROGRESS")),
    );

    await expect(gateway.createFundingIntent(newIntent)).rejects.toMatchObject({
      code: "IDEMPOTENCY_REQUEST_IN_PROGRESS",
    });
    expect(calls).toHaveLength(5);
  });

  it("reports a destination Useroutr refuses", async () => {
    const { gateway } = gatewayAnswering([apiError(422, "INVALID_DESTINATION")]);

    await expect(gateway.createFundingIntent(newIntent)).rejects.toThrow(DestinationRefusedError);
  });

  it("fails on an intent without a funding page", async () => {
    const { gateway } = gatewayAnswering([
      Response.json({ ...createdIntent, hosted_funding_url: null }, { status: 201 }),
    ]);

    await expect(gateway.createFundingIntent(newIntent)).rejects.toThrow(UseroutrResponseError);
  });

  it("reads an intent's status", async () => {
    const { gateway, calls } = gatewayAnswering([Response.json({ id: "fi_1", status: "EXPIRED" })]);

    await expect(gateway.fundingIntentStatus("fi_1")).resolves.toBe("EXPIRED");
    expect(calls[0]?.url).toBe("https://api.sandbox.useroutr.com/v1/funding-intents/fi_1");
  });

  it("accepts a delivery signed with the endpoint's secret", () => {
    const { gateway } = gatewayAnswering([]);
    const payload = JSON.stringify({ id: "evt_1", type: "funding.credited" });

    expect(
      gateway.constructWebhookEvent(payload, signWebhook(payload, "evt_1"), "evt_1"),
    ).toMatchObject({
      id: "evt_1",
    });
  });

  it("refuses a delivery signed with another secret", () => {
    const { gateway } = gatewayAnswering([]);
    const payload = JSON.stringify({ id: "evt_1", type: "funding.credited" });

    expect(() =>
      gateway.constructWebhookEvent(payload, signWebhook(payload, "evt_1", "whsec_other"), "evt_1"),
    ).toThrow(WebhookSignatureError);
  });
});
