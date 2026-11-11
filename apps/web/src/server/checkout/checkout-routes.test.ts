import { ConnectionError } from "@useroutr/sdk";
import { describe, expect, it } from "vitest";
import { errorCode } from "@/test/route-requests";
import {
  RequestAlreadyPaidError,
  RequestClosedError,
  RequestNotFoundError,
} from "../requests/request-errors";
import { DestinationRefusedError } from "../useroutr/useroutr-gateway";
import { handleStartCheckout } from "./checkout-routes";

describe("handleStartCheckout", () => {
  it("returns the funding token, and nothing else", async () => {
    const response = await handleStartCheckout("req_1", {
      startCheckout: () => Promise.resolve({ token: "token_1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token: "token_1" });
  });

  it.each([
    [new RequestNotFoundError(), 404, "not_found"],
    [new RequestAlreadyPaidError(), 409, "request_paid"],
    [new RequestClosedError(), 410, "request_closed"],
    [new DestinationRefusedError("no trustline"), 422, "destination_refused"],
    [new ConnectionError("down", { code: "CONNECTION_ERROR" }), 503, "useroutr_unavailable"],
  ])("answers %s with %i", async (error, status, code) => {
    const response = await handleStartCheckout("req_1", {
      startCheckout: () => Promise.reject(error),
    });

    expect(response.status).toBe(status);
    expect(await errorCode(response)).toBe(code);
  });
});
