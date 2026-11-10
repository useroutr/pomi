import { InvalidStellarAccountError } from "@pomi/shared";
import { describe, expect, it } from "vitest";
import { apiRequest, errorCode, fakeAuth } from "@/test/route-requests";
import { StellarNetworkUnavailableError } from "../stellar/horizon-account-reader";
import { PayoutAccountMissingError, PayoutAccountNeedsMemoError } from "./payout-address-errors";
import { handleGetPayoutAddress, handleSetPayoutAddress } from "./payout-address-routes";

const saved = { id: "addr_1", address: "GABC", verified: false };

function servicesFailingWith(error: Error) {
  return {
    auth: fakeAuth,
    payoutAddresses: {
      payoutAddress: () => Promise.resolve(saved),
      setPayoutAddress: () => Promise.reject(error),
    },
  };
}

const services = {
  auth: fakeAuth,
  payoutAddresses: {
    payoutAddress: () => Promise.resolve(saved),
    setPayoutAddress: (_userId: string, address: string) => Promise.resolve({ ...saved, address }),
  },
};

describe("payout address routes", () => {
  it("returns the signed-in receiver's address", async () => {
    const response = await handleGetPayoutAddress(apiRequest("/api/me/payout-address"), services);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ payoutAddress: saved });
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

  it("saves an address", async () => {
    const response = await handleSetPayoutAddress(
      apiRequest("/api/me/payout-address", { method: "PUT", body: { address: "GXYZ" } }),
      services,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ payoutAddress: { ...saved, address: "GXYZ" } });
  });

  it.each([
    [new InvalidStellarAccountError("typo"), 400, "invalid_address"],
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
