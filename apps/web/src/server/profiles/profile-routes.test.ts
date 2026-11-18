import { describe, expect, it } from "vitest";
import { apiRequest, errorCode, fakeAuth } from "@/test/route-requests";
import { handleGetHandleAvailability } from "./profile-routes";

const services = {
  auth: fakeAuth,
  profiles: {
    profile: () => Promise.resolve({ handle: null, displayName: null }),
    claimHandle: () => Promise.resolve({ handle: "ada", displayName: null }),
    setDisplayName: () => Promise.resolve({ handle: null, displayName: "Ada" }),
    handleAvailability: (handle: string) =>
      Promise.resolve({ handle, available: true, problem: null }),
  },
};

describe("handle availability route", () => {
  it("says whether a handle is free", async () => {
    const response = await handleGetHandleAvailability(
      apiRequest("/api/handles/ada"),
      "ada",
      services,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ handle: "ada", available: true, problem: null });
  });

  it("answers only signed-in receivers, so handles cannot be listed for free", async () => {
    const response = await handleGetHandleAvailability(
      apiRequest("/api/handles/ada", { signedIn: false }),
      "ada",
      services,
    );

    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("not_signed_in");
  });
});
