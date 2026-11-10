import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { handleSendEmailsJob } from "./job-routes";

const SECRET = "c".repeat(32);
const outbox = { sendPending: () => Promise.resolve({ sent: 2 }) };

function job(authorization?: string) {
  return new NextRequest("http://localhost:3000/api/jobs/send-emails", {
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe("handleSendEmailsJob", () => {
  it("sends the outbox for the scheduler holding the secret", async () => {
    const response = await handleSendEmailsJob(job(`Bearer ${SECRET}`), SECRET, outbox);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: 2 });
  });

  it.each([undefined, "Bearer wrong", `Bearer ${SECRET}x`])("refuses %j", async (authorization) => {
    const response = await handleSendEmailsJob(job(authorization), SECRET, outbox);

    expect(response.status).toBe(401);
  });

  it("refuses every caller while no secret is set", async () => {
    const response = await handleSendEmailsJob(job("Bearer "), null, outbox);

    expect(response.status).toBe(503);
  });
});
