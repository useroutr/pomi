import { InvalidAmountError } from "@pomi/shared";
import { ConnectionError } from "@useroutr/sdk";
import { describe, expect, it } from "vitest";
import { apiRequest, errorCode, fakeAuth } from "@/test/route-requests";
import {
  PayoutAddressRequiredError,
  PayoutAssetNotTrustedError,
} from "../payout-addresses/payout-address-errors";
import {
  RequestAlreadyPaidError,
  RequestNotFoundError,
  UnsupportedAssetError,
} from "./request-errors";
import { handleCloseRequest, handleCreateRequest, handleListRequests } from "./request-routes";

function servicesWith(requests: {
  createRequest?: () => Promise<{ id: string }>;
  closeRequest?: () => Promise<void>;
}) {
  return {
    auth: fakeAuth,
    appUrl: "https://pomi.app",
    requests: {
      createRequest: requests.createRequest ?? (() => Promise.resolve({ id: "req_1" })),
      listRequests: () => Promise.resolve([]),
      closeRequest: requests.closeRequest ?? (() => Promise.resolve()),
    },
  };
}

const newRequest = { amount: "25", assetId: "asset_usdc_stellar", note: "Logo" };

describe("request routes", () => {
  it("creates a request and returns its link", async () => {
    const response = await handleCreateRequest(
      apiRequest("/api/requests", { method: "POST", body: newRequest }),
      servicesWith({}),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      request: { id: "req_1", url: "https://pomi.app/r/req_1" },
    });
  });

  it.each([
    [new InvalidAmountError("bad"), 400, "invalid_amount"],
    [new UnsupportedAssetError(), 400, "unsupported_asset"],
    [new PayoutAddressRequiredError(), 409, "payout_address_required"],
    [new PayoutAssetNotTrustedError("USDC", "GA5Z...KZVN"), 422, "asset_not_trusted"],
    [new ConnectionError("down", { code: "CONNECTION_ERROR" }), 503, "useroutr_unavailable"],
  ])("answers %s with %i", async (error, status, code) => {
    const response = await handleCreateRequest(
      apiRequest("/api/requests", { method: "POST", body: newRequest }),
      servicesWith({ createRequest: () => Promise.reject(error) }),
    );

    expect(response.status).toBe(status);
    expect(await errorCode(response)).toBe(code);
  });

  it("refuses to list requests for anyone not signed in", async () => {
    const response = await handleListRequests(
      apiRequest("/api/requests", { signedIn: false }),
      servicesWith({}),
    );

    expect(response.status).toBe(401);
  });

  it.each([
    [undefined, 204, undefined],
    [new RequestNotFoundError(), 404, "not_found"],
    [new RequestAlreadyPaidError(), 409, "request_paid"],
  ])("closes a request, or answers %s", async (error, status, code) => {
    const response = await handleCloseRequest(
      apiRequest("/api/requests/req_1/close", { method: "POST" }),
      "req_1",
      servicesWith({
        closeRequest: () => (error === undefined ? Promise.resolve() : Promise.reject(error)),
      }),
    );

    expect(response.status).toBe(status);
    if (code !== undefined) {
      expect(await errorCode(response)).toBe(code);
    }
  });
});
