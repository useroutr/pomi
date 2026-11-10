import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../database";
import { type EmailDelivery, EmailDeliveryError, type EmailMessage } from "../email/email-delivery";
import {
  InvalidEmailAddressError,
  InvalidSignInCodeError,
  SignInCodeRateLimitedError,
} from "./auth-errors";
import { createAuthService } from "./auth-service";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) {
  throw new Error(
    "DATABASE_URL is not set: start Postgres (docker compose up -d) and migrate (pnpm db:migrate)",
  );
}
const database = createDatabase(databaseUrl);

const EMAIL = "receiver@example.com";
const MINUTE_MS = 60_000;

let currentTime: Date;
let sent: EmailMessage[];

const recordingDelivery: EmailDelivery = {
  send(message) {
    sent.push(message);
    return Promise.resolve();
  },
};

function authService(emailDelivery: EmailDelivery = recordingDelivery) {
  return createAuthService({
    database,
    emailDelivery,
    authSecret: "s".repeat(32),
    now: () => currentTime,
  });
}

function advance(milliseconds: number) {
  currentTime = new Date(currentTime.getTime() + milliseconds);
}

function lastCode(): string {
  const message = sent.at(-1);
  const code = message?.text.match(/\b(\d{6})\b/)?.[1];
  if (code === undefined) {
    throw new Error("no sign-in code was sent");
  }
  return code;
}

// Any six digits but the right ones.
function wrongCode(code: string): string {
  return code === "000000" ? "000001" : "000000";
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected a rejection");
}

beforeEach(async () => {
  await database.$executeRaw`TRUNCATE "users", "sessions", "sign_in_codes" CASCADE`;
  currentTime = new Date("2026-11-10T12:00:00Z");
  sent = [];
});

afterAll(async () => {
  await database.$disconnect();
});

describe("requesting a code", () => {
  it("emails a six-digit code and stores only its hash", async () => {
    await authService().requestSignInCode(" Receiver@Example.com ");

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(EMAIL);
    const code = lastCode();
    const stored = await database.signInCode.findFirstOrThrow({ where: { email: EMAIL } });
    expect(stored.codeHash).not.toContain(code);
    expect(stored.expiresAt).toEqual(new Date(currentTime.getTime() + 10 * MINUTE_MS));
  });

  it("refuses an invalid address and sends nothing", async () => {
    await expect(authService().requestSignInCode("receiver")).rejects.toThrow(
      InvalidEmailAddressError,
    );
    expect(sent).toHaveLength(0);
  });

  it("allows one code a minute per address", async () => {
    const service = authService();
    await service.requestSignInCode(EMAIL);
    advance(20_000);

    const refusal = await rejectionOf(service.requestSignInCode(EMAIL));

    expect(refusal).toBeInstanceOf(SignInCodeRateLimitedError);
    expect(refusal).toMatchObject({ retryAfterSeconds: 40 });
    advance(40_000);
    await service.requestSignInCode(EMAIL);
    expect(sent).toHaveLength(2);
  });

  it("allows five codes an hour per address", async () => {
    const service = authService();
    for (let index = 0; index < 5; index += 1) {
      await service.requestSignInCode(EMAIL);
      advance(2 * MINUTE_MS);
    }

    const refusal = await rejectionOf(service.requestSignInCode(EMAIL));

    // The first code leaves the hour 60 minutes after it was sent.
    expect(refusal).toMatchObject({ retryAfterSeconds: 50 * 60 });
    expect(sent).toHaveLength(5);
    await service.requestSignInCode("someone.else@example.com");
    expect(sent).toHaveLength(6);
  });

  it("issues one code when two requests for an address arrive together", async () => {
    const service = authService();

    const results = await Promise.allSettled([
      service.requestSignInCode(EMAIL),
      service.requestSignInCode(EMAIL),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await database.signInCode.count()).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it("passes on a failed send, and the code still counts toward the limit", async () => {
    const failing: EmailDelivery = {
      send: () => Promise.reject(new EmailDeliveryError("Resend could not be reached")),
    };

    await expect(authService(failing).requestSignInCode(EMAIL)).rejects.toThrow(EmailDeliveryError);
    expect(await database.signInCode.count()).toBe(1);
    await expect(authService().requestSignInCode(EMAIL)).rejects.toThrow(
      SignInCodeRateLimitedError,
    );
  });
});

describe("entering a code", () => {
  it("creates the account and a session on the first sign-in", async () => {
    const service = authService();
    await service.requestSignInCode(EMAIL);

    const grant = await service.verifySignInCode("RECEIVER@example.com", lastCode());

    expect(grant.user).toMatchObject({ email: EMAIL, handle: null });
    expect(grant.expiresAt).toEqual(new Date(currentTime.getTime() + 30 * 24 * 60 * MINUTE_MS));
    expect(await database.user.count()).toBe(1);
    const session = await database.session.findFirstOrThrow();
    expect(session.userId).toBe(grant.user.id);
    expect(session.tokenHash).not.toBe(grant.token);
    expect(await service.resolveSession(grant.token)).toEqual(grant.user);
  });

  it("signs an existing account in again, without a second account", async () => {
    const service = authService();
    await service.requestSignInCode(EMAIL);
    const first = await service.verifySignInCode(EMAIL, lastCode());
    advance(2 * MINUTE_MS);
    await service.requestSignInCode(EMAIL);

    const second = await service.verifySignInCode(EMAIL, lastCode());

    expect(second.user.id).toBe(first.user.id);
    expect(await database.user.count()).toBe(1);
    expect(await database.session.count()).toBe(2);
  });

  it("accepts a code typed with spaces", async () => {
    const service = authService();
    await service.requestSignInCode(EMAIL);
    const code = lastCode();

    await expect(
      service.verifySignInCode(EMAIL, `${code.slice(0, 3)} ${code.slice(3)}`),
    ).resolves.toMatchObject({ user: { email: EMAIL } });
  });

  it("refuses a wrong code", async () => {
    const service = authService();
    await service.requestSignInCode(EMAIL);

    await expect(service.verifySignInCode(EMAIL, wrongCode(lastCode()))).rejects.toThrow(
      InvalidSignInCodeError,
    );
    expect(await database.session.count()).toBe(0);
    expect(await database.user.count()).toBe(0);
  });

  it("refuses a code for an address that never asked for one", async () => {
    await expect(authService().verifySignInCode(EMAIL, "123456")).rejects.toThrow(
      InvalidSignInCodeError,
    );
  });

  it("refuses a code after ten minutes", async () => {
    const service = authService();
    await service.requestSignInCode(EMAIL);
    advance(10 * MINUTE_MS);

    await expect(service.verifySignInCode(EMAIL, lastCode())).rejects.toThrow(
      InvalidSignInCodeError,
    );
  });

  it("refuses a code used once already", async () => {
    const service = authService();
    await service.requestSignInCode(EMAIL);
    const code = lastCode();
    await service.verifySignInCode(EMAIL, code);

    await expect(service.verifySignInCode(EMAIL, code)).rejects.toThrow(InvalidSignInCodeError);
    expect(await database.session.count()).toBe(1);
  });

  it("refuses an earlier code once a newer one is sent", async () => {
    const service = authService();
    await service.requestSignInCode(EMAIL);
    const earlier = lastCode();
    advance(MINUTE_MS);
    await service.requestSignInCode(EMAIL);
    const newer = lastCode();

    // One time in a million the two codes are the same, and the newer code
    // rightly accepts it.
    if (earlier !== newer) {
      await expect(service.verifySignInCode(EMAIL, earlier)).rejects.toThrow(
        InvalidSignInCodeError,
      );
    }
    await expect(service.verifySignInCode(EMAIL, newer)).resolves.toMatchObject({
      user: { email: EMAIL },
    });
  });

  it("refuses even the right code after five wrong ones", async () => {
    const service = authService();
    await service.requestSignInCode(EMAIL);
    const code = lastCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(service.verifySignInCode(EMAIL, wrongCode(code))).rejects.toThrow(
        InvalidSignInCodeError,
      );
    }

    await expect(service.verifySignInCode(EMAIL, code)).rejects.toThrow(InvalidSignInCodeError);
    expect(await database.session.count()).toBe(0);
  });

  it("opens one session when the right code is entered twice at once", async () => {
    const service = authService();
    await service.requestSignInCode(EMAIL);
    const code = lastCode();

    const results = await Promise.allSettled([
      service.verifySignInCode(EMAIL, code),
      service.verifySignInCode(EMAIL, code),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await database.session.count()).toBe(1);
    expect(await database.user.count()).toBe(1);
  });
});

describe("sessions", () => {
  async function signedIn() {
    const service = authService();
    await service.requestSignInCode(EMAIL);
    const grant = await service.verifySignInCode(EMAIL, lastCode());
    return { service, grant };
  }

  it("does not know a token it never issued", async () => {
    await signedIn();

    expect(await authService().resolveSession("not-a-real-token")).toBeNull();
  });

  it("ends after 30 days", async () => {
    const { service, grant } = await signedIn();
    advance(30 * 24 * 60 * MINUTE_MS);

    expect(await service.resolveSession(grant.token)).toBeNull();
  });

  it("ends on sign-out, leaving other sessions signed in", async () => {
    const { service, grant } = await signedIn();
    advance(MINUTE_MS);
    await service.requestSignInCode(EMAIL);
    const other = await service.verifySignInCode(EMAIL, lastCode());

    await service.signOut(grant.token);

    expect(await service.resolveSession(grant.token)).toBeNull();
    expect(await service.resolveSession(other.token)).toMatchObject({ email: EMAIL });
  });
});
