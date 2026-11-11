import { InvalidAmountError } from "@pomi/shared";
import { ConnectionError } from "@useroutr/sdk";
import { describe, expect, it } from "vitest";
import { apiRequest, errorCode, fakeAuth } from "@/test/route-requests";
import {
  PayoutAddressRequiredError,
  PayoutAssetNotTrustedError,
} from "../payout-addresses/payout-address-errors";
import {
  InvalidEndDateError,
  InvalidMinimumError,
  RequestAlreadyPaidError,
  RequestNotFoundError,
  UnsupportedAssetError,
} from "./request-errors";
import {
  handleCloseRequest,
  handleCreateRequest,
  handleGetPayBox,
  handleListAssets,
  handleListRequests,
  handleSetPayBox,
  handleUpdateRequest,
} from "./request-routes";

const payBox = {
  open: true,
  assetId: "asset_usdc_stellar",
  assetSymbol: "USDC",
  amount: null,
  minimumAmount: "5",
  payoutAddress: "GABC",
};

function servicesWith(requests: {
  createRequest?: () => Promise<{ id: string }>;
  closeRequest?: () => Promise<void>;
  updateRequest?: (...args: unknown[]) => Promise<void>;
  setPayBox?: () => Promise<typeof payBox>;
}) {
  return {
    auth: fakeAuth,
    appUrl: "https://pomi.app",
    requests: {
      createRequest: requests.createRequest ?? (() => Promise.resolve({ id: "req_1" })),
      listRequests: () => Promise.resolve([]),
      closeRequest: requests.closeRequest ?? (() => Promise.resolve()),
      updateRequest: requests.updateRequest ?? (() => Promise.resolve()),
      requestableAssets: () =>
        Promise.resolve([{ id: "asset_xlm_stellar", symbol: "XLM", code: "XLM", issuer: null }]),
      payBox: () => Promise.resolve(payBox),
      setPayBox: requests.setPayBox ?? (() => Promise.resolve(payBox)),
      closePayBox: () => Promise.resolve(),
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

describe("listing, assets and the pay box", () => {
  it("lists or unlists a request", async () => {
    const changes: unknown[] = [];

    const response = await handleUpdateRequest(
      apiRequest("/api/requests/req_1", { method: "PATCH", body: { listed: true } }),
      "req_1",
      servicesWith({
        updateRequest: (...args: unknown[]) => {
          changes.push(args);
          return Promise.resolve();
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(changes).toEqual([["usr_1", "req_1", { listed: true }]]);
  });

  it("answers 404 for a request that is not the receiver's", async () => {
    const response = await handleUpdateRequest(
      apiRequest("/api/requests/req_1", { method: "PATCH", body: { listed: true } }),
      "req_1",
      servicesWith({ updateRequest: () => Promise.reject(new RequestNotFoundError()) }),
    );

    expect(response.status).toBe(404);
  });

  it("lists the assets a request can ask for, by id and symbol only", async () => {
    const response = await handleListAssets(apiRequest("/api/assets"), servicesWith({}));

    expect(await response.json()).toEqual({ assets: [{ id: "asset_xlm_stellar", symbol: "XLM" }] });
  });

  it("returns and saves the pay box", async () => {
    const read = await handleGetPayBox(apiRequest("/api/me/pay-box"), servicesWith({}));
    const saved = await handleSetPayBox(
      apiRequest("/api/me/pay-box", {
        method: "PUT",
        body: { assetId: "asset_usdc_stellar", minimumAmount: "5" },
      }),
      servicesWith({}),
    );

    expect(await read.json()).toEqual({ payBox });
    expect(saved.status).toBe(200);
  });

  it.each([
    [new InvalidMinimumError("A fixed amount has no minimum."), 400, "invalid_minimum"],
    [new PayoutAddressRequiredError(), 409, "payout_address_required"],
  ])("refuses a pay box with %s", async (error, status, code) => {
    const response = await handleSetPayBox(
      apiRequest("/api/me/pay-box", { method: "PUT", body: { assetId: "asset_usdc_stellar" } }),
      servicesWith({ setPayBox: () => Promise.reject(error) }),
    );

    expect(response.status).toBe(status);
    expect(await errorCode(response)).toBe(code);
  });

  it("refuses an end date in the past", async () => {
    const response = await handleCreateRequest(
      apiRequest("/api/requests", {
        method: "POST",
        body: { ...newRequest, endsAt: "2020-01-01" },
      }),
      servicesWith({ createRequest: () => Promise.reject(new InvalidEndDateError()) }),
    );

    expect(await errorCode(response)).toBe("invalid_end_date");
  });
});
