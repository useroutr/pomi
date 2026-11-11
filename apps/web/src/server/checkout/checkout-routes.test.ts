import { InvalidAmountError } from "@pomi/shared";
import { ConnectionError } from "@useroutr/sdk";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { errorCode } from "@/test/route-requests";
import {
  RequestAlreadyPaidError,
  RequestClosedError,
  RequestEndedError,
  RequestNotFoundError,
} from "../requests/request-errors";
import { DestinationRefusedError } from "../useroutr/useroutr-gateway";
import { BelowMinimumError, CheckoutRateLimitedError } from "./checkout-errors";
import { handleStartCheckout } from "./checkout-routes";
import { type CheckoutVisitor } from "./checkout-service";

const KNOWN_VISITOR = "vis_AAAAAAAAAAAAAAAAAAAAAA";

function checkoutRequest(
  init: { body?: unknown; cookie?: string; headers?: Record<string, string> } = {},
) {
  return new NextRequest("http://localhost:3000/api/r/req_1/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(init.cookie === undefined ? {} : { cookie: init.cookie }),
      ...init.headers,
    },
    body: JSON.stringify(init.body ?? {}),
  });
}

function recordingCheckout() {
  const calls: { amount: string | undefined; visitor: CheckoutVisitor }[] = [];
  return {
    calls,
    services: {
      checkout: {
        startCheckout: (
          _requestId: string,
          amount: string | undefined,
          visitor: CheckoutVisitor,
        ) => {
          calls.push({ amount, visitor });
          return Promise.resolve({ token: "token_1" });
        },
      },
      clientIpHeader: "x-real-ip",
      clientKeySecret: "s".repeat(32),
    },
  };
}

describe("handleStartCheckout", () => {
  it("returns the funding token, and gives a new visitor a cookie", async () => {
    const { calls, services } = recordingCheckout();

    const response = await handleStartCheckout(checkoutRequest(), "req_1", services);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token: "token_1" });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^pomi_visitor=vis_[\w-]{22};/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toContain(`pomi_visitor=${calls[0]?.visitor.visitorId ?? "missing"}`);
  });

  it("keeps a returning visitor's id, and sets no cookie", async () => {
    const { calls, services } = recordingCheckout();

    const response = await handleStartCheckout(
      checkoutRequest({ cookie: `pomi_visitor=${KNOWN_VISITOR}` }),
      "req_1",
      services,
    );

    expect(calls[0]?.visitor.visitorId).toBe(KNOWN_VISITOR);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("replaces a visitor cookie that is not one of Pomi's", async () => {
    const { calls, services } = recordingCheckout();

    await handleStartCheckout(
      checkoutRequest({ cookie: "pomi_visitor=forged" }),
      "req_1",
      services,
    );

    expect(calls[0]?.visitor.visitorId).toMatch(/^vis_[\w-]{22}$/);
  });

  it("passes the payer's amount and a keyed hash of the address the host reports", async () => {
    const { calls, services } = recordingCheckout();

    await handleStartCheckout(
      checkoutRequest({ body: { amount: "12.5" }, headers: { "x-real-ip": "203.0.113.7" } }),
      "req_1",
      services,
    );
    await handleStartCheckout(
      checkoutRequest({ headers: { "x-real-ip": "203.0.113.8" } }),
      "req_1",
      services,
    );

    expect(calls[0]?.amount).toBe("12.5");
    expect(calls[0]?.visitor.clientKey).toMatch(/^[0-9a-f]{64}$/);
    expect(calls[0]?.visitor.clientKey).not.toContain("203.0.113.7");
    expect(calls[1]?.visitor.clientKey).not.toBe(calls[0]?.visitor.clientKey);
  });

  it("uses no client key when the host is not configured to report addresses", async () => {
    const { calls, services } = recordingCheckout();

    await handleStartCheckout(
      checkoutRequest({ headers: { "x-real-ip": "203.0.113.7" } }),
      "req_1",
      { ...services, clientIpHeader: null },
    );

    expect(calls[0]?.visitor.clientKey).toBeNull();
  });

  it.each([
    [new RequestNotFoundError(), 404, "not_found"],
    [new RequestAlreadyPaidError(), 409, "request_paid"],
    [new RequestClosedError(), 410, "request_closed"],
    [new RequestEndedError(), 410, "request_ended"],
    [new InvalidAmountError("Enter an amount"), 400, "invalid_amount"],
    [new BelowMinimumError("5"), 400, "below_minimum"],
    [new DestinationRefusedError("no trustline"), 422, "destination_refused"],
    [new ConnectionError("down", { code: "CONNECTION_ERROR" }), 503, "useroutr_unavailable"],
  ])("answers %s with %i", async (error, status, code) => {
    const response = await handleStartCheckout(checkoutRequest(), "req_1", {
      ...recordingCheckout().services,
      checkout: { startCheckout: () => Promise.reject(error) },
    });

    expect(response.status).toBe(status);
    expect(await errorCode(response)).toBe(code);
  });

  it("answers 429 with Retry-After when the visitor is limited", async () => {
    const response = await handleStartCheckout(checkoutRequest(), "req_1", {
      ...recordingCheckout().services,
      checkout: { startCheckout: () => Promise.reject(new CheckoutRateLimitedError(90)) },
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("90");
  });
});
