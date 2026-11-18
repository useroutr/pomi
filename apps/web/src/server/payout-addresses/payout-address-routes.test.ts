import { InvalidEvmAddressError, InvalidStellarAccountError } from "@pomi/shared";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { CATALOG_ASSETS } from "@/test/fake-useroutr";
import { apiRequest, errorCode, fakeAuth } from "@/test/route-requests";
import { StellarNetworkUnavailableError } from "../stellar/horizon-account-reader";
import { PayoutAccountMissingError, PayoutAccountNeedsMemoError } from "./payout-address-errors";
import {
  handleGetPayoutAddress,
  handleGetPayoutReadiness,
  handleListPayoutAddresses,
  handleSetPayoutAddress,
} from "./payout-address-routes";

const saved = { id: "addr_1", network: "stellar", address: "GABC", verified: false };
const baseAddress = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
// What request creation offers: the fake's catalog, USDC on Base included.
const requests = {
  requestableAssets: () => Promise.resolve(CATALOG_ASSETS.filter((asset) => asset.payout)),
};

function servicesFailingWith(error: Error) {
  return {
    auth: fakeAuth,
    payoutAddresses: {
      payoutAddress: () => Promise.resolve(saved),
      payoutAddresses: () => Promise.resolve([saved]),
      setPayoutAddress: () => Promise.reject(error),
    },
    requests,
  };
}

function recordingServices() {
  const targets: { network: string; addressKind: string }[] = [];
  return {
    targets,
    services: {
      auth: fakeAuth,
      payoutAddresses: {
        payoutAddress: () => Promise.resolve(saved),
        payoutAddresses: () => Promise.resolve([saved]),
        setPayoutAddress: (
          _userId: string,
          address: string,
          target: { network: string; addressKind: "stellar" | "evm" },
        ) => {
          targets.push(target);
          return Promise.resolve({ ...saved, network: target.network, address });
        },
      },
      requests,
    },
  };
}

const { services } = recordingServices();

describe("payout address routes", () => {
  it("returns the signed-in receiver's Stellar address", async () => {
    const response = await handleGetPayoutAddress(apiRequest("/api/me/payout-address"), services);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ payoutAddress: saved });
  });

  it("lists the receiver's address on every network", async () => {
    const response = await handleListPayoutAddresses(
      apiRequest("/api/me/payout-addresses"),
      services,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ payoutAddresses: [saved] });
  });

  it("accepts the mobile app's bearer token in place of the cookie", async () => {
    const request = new NextRequest("http://localhost:3000/api/me/payout-address", {
      headers: { authorization: "Bearer valid" },
    });

    const response = await handleGetPayoutAddress(request, services);

    expect(response.status).toBe(200);
  });

  it("refuses a bearer token it does not know", async () => {
    const request = new NextRequest("http://localhost:3000/api/me/payout-address", {
      headers: { authorization: "Bearer stolen" },
    });

    const response = await handleGetPayoutAddress(request, services);

    expect(response.status).toBe(401);
  });

  it("refuses anyone not signed in", async () => {
    const response = await handleSetPayoutAddress(
      apiRequest("/api/me/payout-address", {
        method: "PUT",
        body: { address: "G" },
        signedIn: false,
      }),
      services,
    );

    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("not_signed_in");
  });

  it("saves a Stellar address when no network is named", async () => {
    const recording = recordingServices();
    const response = await handleSetPayoutAddress(
      apiRequest("/api/me/payout-address", { method: "PUT", body: { address: "GXYZ" } }),
      recording.services,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ payoutAddress: { ...saved, address: "GXYZ" } });
    expect(recording.targets).toEqual([{ network: "stellar", addressKind: "stellar" }]);
  });

  it("saves an address on another network Useroutr pays out on, checked as that network's", async () => {
    const recording = recordingServices();
    const response = await handleSetPayoutAddress(
      apiRequest("/api/me/payout-address", {
        method: "PUT",
        body: { address: baseAddress, network: "base" },
      }),
      recording.services,
    );

    expect(response.status).toBe(200);
    expect(recording.targets).toEqual([{ network: "base", addressKind: "evm" }]);
  });

  it("refuses a network Useroutr does not pay out on", async () => {
    const recording = recordingServices();
    const response = await handleSetPayoutAddress(
      apiRequest("/api/me/payout-address", {
        method: "PUT",
        body: { address: baseAddress, network: "arbitrum" },
      }),
      recording.services,
    );

    expect(response.status).toBe(422);
    expect(await errorCode(response)).toBe("network_unsupported");
    expect(recording.targets).toEqual([]);
  });

  it.each([
    [new InvalidStellarAccountError("typo"), 400, "invalid_address"],
    [new InvalidEvmAddressError("typo"), 400, "invalid_address"],
    [new PayoutAccountMissingError("testnet"), 422, "account_missing"],
    [new PayoutAccountNeedsMemoError(), 422, "memo_required"],
    [new StellarNetworkUnavailableError("down"), 503, "stellar_unavailable"],
  ])("answers %s with %i", async (error, status, code) => {
    const response = await handleSetPayoutAddress(
      apiRequest("/api/me/payout-address", { method: "PUT", body: { address: "GXYZ" } }),
      servicesFailingWith(error),
    );

    expect(response.status).toBe(status);
    expect(await errorCode(response)).toBe(code);
  });
});

describe("payout readiness route", () => {
  const readiness = {
    payoutAddress: saved,
    payoutAddresses: [saved],
    assets: [{ id: "xlm", symbol: "XLM", network: "stellar", ready: true, problem: null }],
  };
  const readinessServices = {
    auth: fakeAuth,
    payoutAddresses: { readiness: () => Promise.resolve(readiness) },
    requests: { requestableAssets: () => Promise.resolve([]) },
  };

  it("returns each asset's readiness for the signed-in receiver", async () => {
    const response = await handleGetPayoutReadiness(
      apiRequest("/api/me/payout-address/readiness"),
      readinessServices,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(readiness);
  });

  it("refuses anyone not signed in", async () => {
    const response = await handleGetPayoutReadiness(
      apiRequest("/api/me/payout-address/readiness", { signedIn: false }),
      readinessServices,
    );

    expect(response.status).toBe(401);
  });

  it("says when Stellar cannot be reached", async () => {
    const response = await handleGetPayoutReadiness(
      apiRequest("/api/me/payout-address/readiness"),
      {
        ...readinessServices,
        payoutAddresses: {
          readiness: () => Promise.reject(new StellarNetworkUnavailableError("down")),
        },
      },
    );

    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe("stellar_unavailable");
  });
});
