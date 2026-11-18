import { ConnectionError } from "@useroutr/sdk";
import { describe, expect, it } from "vitest";
import { apiRequest, errorCode, fakeAuth, SIGNED_IN } from "@/test/route-requests";
import { handleReceivedActivity } from "./activity-routes";
import { type ReceivedActivity } from "./activity-service";

const activity: ReceivedActivity = {
  totals: [
    {
      assetSymbol: "USDC",
      assetNetwork: "stellar",
      total: "35.5",
      payments: 2,
      thisMonth: "25.5",
      paymentsThisMonth: 1,
    },
  ],
  recent: [
    {
      id: "pay_1",
      amount: "25.5",
      assetSymbol: "USDC",
      assetNetwork: "stellar",
      creditedAt: new Date("2026-11-18T08:00:00Z"),
      paymentTransactionHash: null,
      settlementTransactionHash: "hash",
      requestId: "req_box",
      payBox: true,
      note: null,
    },
  ],
  days: [{ date: "2026-11-18", payments: 1 }],
};

describe("GET /api/me/payments", () => {
  it("answers with the signed-in receiver's payments, dates as ISO strings", async () => {
    const asked: string[] = [];
    const response = await handleReceivedActivity(apiRequest("/api/me/payments"), {
      auth: fakeAuth,
      activity: {
        receivedActivity: (userId) => {
          asked.push(userId);
          return Promise.resolve(activity);
        },
      },
    });

    expect(response.status).toBe(200);
    expect(asked).toEqual([SIGNED_IN.id]);
    await expect(response.json()).resolves.toMatchObject({
      totals: [{ assetSymbol: "USDC", total: "35.5", thisMonth: "25.5" }],
      recent: [{ id: "pay_1", payBox: true, creditedAt: "2026-11-18T08:00:00.000Z" }],
      days: [{ date: "2026-11-18", payments: 1 }],
    });
  });

  it("refuses a signed-out caller", async () => {
    const response = await handleReceivedActivity(
      apiRequest("/api/me/payments", { signedIn: false }),
      { auth: fakeAuth, activity: { receivedActivity: () => Promise.resolve(activity) } },
    );

    expect(response.status).toBe(401);
  });

  it("says payments are unavailable while Useroutr cannot be reached", async () => {
    const response = await handleReceivedActivity(apiRequest("/api/me/payments"), {
      auth: fakeAuth,
      activity: {
        receivedActivity: () =>
          Promise.reject(new ConnectionError("down", { code: "CONNECTION_ERROR" })),
      },
    });

    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe("useroutr_unavailable");
  });
});
