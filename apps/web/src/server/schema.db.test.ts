import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { type Prisma } from "@/generated/prisma/client";
import { createDatabase } from "./database";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) {
  throw new Error(
    "DATABASE_URL is not set: start Postgres (docker compose up -d) and migrate (pnpm db:migrate)",
  );
}
const database = createDatabase(databaseUrl);

const STELLAR_ACCOUNT = `G${"A".repeat(55)}`;

function createUser(id: string, overrides: Partial<Prisma.UserUncheckedCreateInput> = {}) {
  return database.user.create({ data: { id, email: `${id}@example.com`, ...overrides } });
}

function createRequest(id: string, overrides: Partial<Prisma.RequestUncheckedCreateInput> = {}) {
  return database.request.create({
    data: {
      id,
      userId: "usr_1",
      kind: "SINGLE",
      amountKind: "FIXED",
      amount: "25",
      assetId: "asset_usdc_stellar",
      payoutAddressId: "addr_requests",
      ...overrides,
    },
  });
}

function createIntent(
  id: string,
  overrides: Partial<Prisma.RequestIntentUncheckedCreateInput> = {},
) {
  return database.requestIntent.create({
    data: {
      id,
      requestId: "req_1",
      fundingIntentId: `fi_${id}`,
      fundingToken: `token_${id}`,
      amount: "25",
      exclusive: true,
      expiresAt: new Date(Date.now() + 30 * 60_000),
      ...overrides,
    },
  });
}

function createPayment(id: string, fundingIntentId: string) {
  return database.requestPayment.create({
    data: {
      id,
      requestId: "req_1",
      fundingIntentId,
      amount: "25",
      assetId: "asset_usdc_stellar",
      creditedAt: new Date(),
    },
  });
}

beforeEach(async () => {
  await database.$executeRaw`TRUNCATE "users", "payout_addresses", "requests", "request_intents", "request_payments", "outbox_emails", "outbox_pushes", "devices", "refunds", "webhook_events", "sign_in_codes", "sessions" CASCADE`;
  await createUser("usr_1");
  // Inactive, so the tests of the one active address start from none.
  await database.payoutAddress.create({
    data: { id: "addr_requests", userId: "usr_1", address: STELLAR_ACCOUNT, active: false },
  });
});

afterAll(async () => {
  await database.$disconnect();
});

describe("payments", () => {
  it("counts a credited funding intent once, however often its webhook arrives", async () => {
    await createRequest("req_1");
    await createPayment("pay_1", "fi_1");

    await expect(createPayment("pay_2", "fi_1")).rejects.toThrow("funding_intent_id");
    expect(await database.requestPayment.count()).toBe(1);
  });

  it("emails about a payment once, however often its webhook arrives", async () => {
    await createRequest("req_1");
    await createPayment("pay_1", "fi_1");
    const email = {
      kind: "PAYMENT_RECEIVED",
      requestPaymentId: "pay_1",
      createdAt: new Date(),
    } as const;
    await database.outboxEmail.create({ data: { id: "email_1", ...email } });

    await expect(
      database.outboxEmail.create({ data: { id: "email_2", ...email } }),
    ).rejects.toThrow("kind");
  });

  it("processes a webhook event once", async () => {
    await database.webhookEvent.create({ data: { id: "evt_1", type: "funding.credited" } });

    await expect(
      database.webhookEvent.create({ data: { id: "evt_1", type: "funding.credited" } }),
    ).rejects.toThrow("Unique constraint");
  });
});

describe("funding intents", () => {
  it("gives a single-use request one open intent, shared by every visitor", async () => {
    await createRequest("req_1");
    await createIntent("int_1");

    await expect(createIntent("int_2")).rejects.toThrow("request_intents_one_open_exclusive");

    await database.requestIntent.update({ where: { id: "int_1" }, data: { state: "CLOSED" } });
    await expect(createIntent("int_3")).resolves.toMatchObject({ id: "int_3" });
  });

  it("gives a reusable request one intent per visit", async () => {
    await createRequest("req_1", { kind: "REUSABLE" });
    await createIntent("int_1", { exclusive: false, visitId: "visit_1" });
    await createIntent("int_2", { exclusive: false, visitId: "visit_2" });

    await expect(createIntent("int_3", { exclusive: false, visitId: "visit_1" })).rejects.toThrow(
      "visit_id",
    );
  });

  it.each([
    ["a shared intent tied to one visit", { exclusive: true, visitId: "visit_1" }],
    ["a per-visit intent without its visit", { exclusive: false, visitId: null }],
  ] satisfies [string, Partial<Prisma.RequestIntentUncheckedCreateInput>][])(
    "refuses %s",
    async (_case, overrides) => {
      await createRequest("req_1", { kind: "REUSABLE" });

      await expect(createIntent("int_1", overrides)).rejects.toThrow(
        "request_intents_visit_matches_kind",
      );
    },
  );

  it("refuses an intent for nothing", async () => {
    await createRequest("req_1");

    await expect(createIntent("int_1", { amount: "0" })).rejects.toThrow(
      "request_intents_amount_positive",
    );
  });
});

describe("requests", () => {
  const openAmount = { kind: "REUSABLE", amountKind: "OPEN", amount: null } as const;

  it.each([
    [
      "an invoice for the payer's choice of amount",
      { amountKind: "OPEN", amount: null },
      "requests_single_is_fixed",
    ],
    ["a fixed request without its amount", { amount: null }, "requests_amount_matches_kind"],
    [
      "an open request with a fixed amount",
      { ...openAmount, amount: "5" },
      "requests_amount_matches_kind",
    ],
    ["a fixed request with a minimum", { minimumAmount: "1" }, "requests_amount_matches_kind"],
    ["a zero amount", { amount: "0" }, "requests_amounts_positive"],
    ["a negative minimum", { ...openAmount, minimumAmount: "-1" }, "requests_amounts_positive"],
    ["a single-use pay box", { payBox: true }, "requests_pay_box_is_reusable"],
    ["a note over 280 characters", { note: "x".repeat(281) }, "requests_note_length"],
  ] satisfies [string, Partial<Prisma.RequestUncheckedCreateInput>, string][])(
    "refuses %s",
    async (_case, overrides, constraint) => {
      await expect(createRequest("req_1", overrides)).rejects.toThrow(constraint);
    },
  );

  it("refuses a request without a payout address", async () => {
    await expect(createRequest("req_1", { payoutAddressId: "addr_missing" })).rejects.toThrow(
      "requests_payout_address_id_fkey",
    );
  });

  it("accepts a pay box for the payer's choice of amount, above a minimum", async () => {
    await expect(
      createRequest("req_1", { ...openAmount, minimumAmount: "1", payBox: true }),
    ).resolves.toMatchObject({ payBox: true });
  });

  it("keeps one pay box per receiver", async () => {
    await createRequest("req_1", { ...openAmount, payBox: true });

    await expect(createRequest("req_2", { ...openAmount, payBox: true })).rejects.toThrow(
      "requests_one_pay_box_per_user",
    );
    await expect(createRequest("req_3", openAmount)).resolves.toMatchObject({ payBox: false });
  });
});

describe("receivers", () => {
  it.each(["Collins", "ab--cd", "collins-", "1collins"])(
    "refuses the handle %j",
    async (handle) => {
      await expect(createUser("usr_2", { handle })).rejects.toThrow("users_handle_format");
    },
  );

  it("accepts a handle in the shared format", async () => {
    await expect(createUser("usr_2", { handle: "ada-lovelace" })).resolves.toMatchObject({
      handle: "ada-lovelace",
    });
  });

  it("refuses an email that is not lowercase", async () => {
    await expect(createUser("usr_2", { email: "Ada@Example.com" })).rejects.toThrow(
      "users_email_lowercase",
    );
  });

  it("refuses a payout address that is not a Stellar account", async () => {
    await expect(
      database.payoutAddress.create({
        data: { id: "addr_1", userId: "usr_1", address: `C${"A".repeat(55)}` },
      }),
    ).rejects.toThrow("payout_addresses_stellar_account");
  });

  it("keeps one active payout address per receiver", async () => {
    await database.payoutAddress.create({
      data: { id: "addr_1", userId: "usr_1", address: STELLAR_ACCOUNT, active: false },
    });
    await database.payoutAddress.create({
      data: { id: "addr_2", userId: "usr_1", address: STELLAR_ACCOUNT },
    });

    await expect(
      database.payoutAddress.create({
        data: { id: "addr_3", userId: "usr_1", address: STELLAR_ACCOUNT },
      }),
    ).rejects.toThrow("payout_addresses_one_active_per_user");
  });
});

describe("sign-in", () => {
  function createSignInCode(id: string, email: string) {
    const createdAt = new Date();
    return database.signInCode.create({
      data: {
        id,
        email,
        codeHash: "hash",
        expiresAt: new Date(createdAt.getTime() + 600_000),
        createdAt,
      },
    });
  }

  function createSession(id: string, tokenHash: string) {
    return database.session.create({
      data: { id, userId: "usr_1", tokenHash, expiresAt: new Date(), createdAt: new Date() },
    });
  }

  it("refuses a sign-in code for an address that is not lowercase", async () => {
    await expect(createSignInCode("code_1", "Ada@Example.com")).rejects.toThrow(
      "sign_in_codes_email_lowercase",
    );
  });

  it("keeps several codes for one address, since only the newest counts", async () => {
    await createSignInCode("code_1", "ada@example.com");

    await expect(createSignInCode("code_2", "ada@example.com")).resolves.toMatchObject({
      id: "code_2",
    });
  });

  it("refuses two sessions with one token", async () => {
    await createSession("ses_1", "token_hash");

    await expect(createSession("ses_2", "token_hash")).rejects.toThrow("token_hash");
  });

  it("refuses a session for a receiver that does not exist", async () => {
    await expect(
      database.session.create({
        data: {
          id: "ses_1",
          userId: "usr_missing",
          tokenHash: "token_hash",
          expiresAt: new Date(),
          createdAt: new Date(),
        },
      }),
    ).rejects.toThrow("sessions_user_id_fkey");
  });
});

describe("profiles, devices and notices", () => {
  it.each(["", "x".repeat(51)])("refuses the display name %j", async (displayName) => {
    await expect(createUser("usr_2", { displayName })).rejects.toThrow("users_display_name_length");
  });

  it("gives a push token to one device", async () => {
    const device = { userId: "usr_1", pushToken: "ExponentPushToken[a]", platform: "IOS" } as const;
    await database.device.create({ data: { id: "dev_1", ...device, createdAt: new Date() } });

    await expect(
      database.device.create({ data: { id: "dev_2", ...device, createdAt: new Date() } }),
    ).rejects.toThrow("push_token");
  });

  it("refuses a payment email without its payment, or with a refund", async () => {
    await database.refund.create({
      data: { id: "ref_1", fundingIntentId: "fi_1", status: "PENDING" },
    });

    await expect(
      database.outboxEmail.create({
        data: { id: "email_1", kind: "PAYMENT_RECEIVED", createdAt: new Date() },
      }),
    ).rejects.toThrow("outbox_emails_subject_matches_kind");
    await expect(
      database.outboxEmail.create({
        data: { id: "email_2", kind: "REFUND_DESTINATION_REQUIRED", createdAt: new Date() },
      }),
    ).rejects.toThrow("outbox_emails_subject_matches_kind");
  });
});
