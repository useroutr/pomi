import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { EmailDeliveryError } from "../email/email-delivery";
import {
  InvalidEmailAddressError,
  InvalidSignInCodeError,
  SignInCodeRateLimitedError,
} from "./auth-errors";
import { handleRequestSignInCode, handleSignOut, handleVerifySignInCode } from "./auth-routes";
import { type NewSessionGrant } from "./auth-service";

function jsonRequest(path: string, body: unknown, contentType = "application/json") {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "content-type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function errorCodeOf(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  return typeof body === "object" && body !== null && "error" in body ? body.error : undefined;
}

const grant: NewSessionGrant = {
  token: "session_token_value",
  expiresAt: new Date("2026-12-10T00:00:00Z"),
  user: { id: "usr_1", email: "receiver@example.com", handle: null },
};

describe("handleRequestSignInCode", () => {
  it("asks the service for a code and answers 204", async () => {
    const requested: string[] = [];

    const response = await handleRequestSignInCode(
      jsonRequest("/api/auth/code", { email: "receiver@example.com" }),
      {
        requestSignInCode: (email) => {
          requested.push(email);
          return Promise.resolve();
        },
      },
    );

    expect(response.status).toBe(204);
    expect(requested).toEqual(["receiver@example.com"]);
  });

  it("refuses a body that is not JSON", async () => {
    const response = await handleRequestSignInCode(
      jsonRequest(
        "/api/auth/code",
        "email=receiver@example.com",
        "application/x-www-form-urlencoded",
      ),
      { requestSignInCode: () => Promise.reject(new Error("not called")) },
    );

    expect(response.status).toBe(415);
    expect(await errorCodeOf(response)).toMatchObject({ code: "unsupported_content_type" });
  });

  it.each([
    ["malformed JSON", "{"],
    ["a missing email", {}],
    ["an email that is not a string", { email: 42 }],
  ])("refuses %s", async (_case, body) => {
    const response = await handleRequestSignInCode(jsonRequest("/api/auth/code", body), {
      requestSignInCode: () => Promise.reject(new Error("not called")),
    });

    expect(response.status).toBe(400);
    expect(await errorCodeOf(response)).toMatchObject({ code: "invalid_request" });
  });

  it("answers 400 for an invalid address", async () => {
    const response = await handleRequestSignInCode(
      jsonRequest("/api/auth/code", { email: "receiver" }),
      { requestSignInCode: () => Promise.reject(new InvalidEmailAddressError()) },
    );

    expect(response.status).toBe(400);
    expect(await errorCodeOf(response)).toMatchObject({ code: "invalid_email" });
  });

  it("answers 429 with Retry-After when the address is rate limited", async () => {
    const response = await handleRequestSignInCode(
      jsonRequest("/api/auth/code", { email: "receiver@example.com" }),
      { requestSignInCode: () => Promise.reject(new SignInCodeRateLimitedError(42)) },
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(await errorCodeOf(response)).toMatchObject({ code: "rate_limited" });
  });

  it("answers 503 without the provider's details when the email cannot be sent", async () => {
    const response = await handleRequestSignInCode(
      jsonRequest("/api/auth/code", { email: "receiver@example.com" }),
      {
        requestSignInCode: () =>
          Promise.reject(
            new EmailDeliveryError("Resend refused the message (401 invalid_api_key)"),
          ),
      },
    );

    expect(response.status).toBe(503);
    const error = await errorCodeOf(response);
    expect(error).toMatchObject({ code: "email_unavailable" });
    expect(JSON.stringify(error)).not.toContain("Resend");
  });

  it("rethrows an unexpected error, so Next answers 500 and logs it", async () => {
    const unexpected = new Error("database unreachable");

    await expect(
      handleRequestSignInCode(jsonRequest("/api/auth/code", { email: "receiver@example.com" }), {
        requestSignInCode: () => Promise.reject(unexpected),
      }),
    ).rejects.toBe(unexpected);
  });
});

describe("handleVerifySignInCode", () => {
  it("sets the session cookie, and keeps the token out of the body", async () => {
    const response = await handleVerifySignInCode(
      jsonRequest("/api/auth/verify", { email: "receiver@example.com", code: "123456" }),
      { verifySignInCode: () => Promise.resolve(grant) },
    );

    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual({ user: { handle: null } });
    expect(JSON.stringify(body)).not.toContain(grant.token);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`pomi_session=${grant.token}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toContain(grant.expiresAt.toUTCString());
  });

  it("gives the mobile app its token in the body, and sets no cookie", async () => {
    const response = await handleVerifySignInCode(
      jsonRequest("/api/auth/verify", {
        email: "receiver@example.com",
        code: "123456",
        client: "mobile",
      }),
      { verifySignInCode: () => Promise.resolve(grant) },
    );

    expect(await response.json()).toEqual({
      user: { handle: null },
      session: { token: grant.token, expiresAt: grant.expiresAt.toISOString() },
    });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("answers 400 for a wrong code, without a cookie", async () => {
    const response = await handleVerifySignInCode(
      jsonRequest("/api/auth/verify", { email: "receiver@example.com", code: "000000" }),
      { verifySignInCode: () => Promise.reject(new InvalidSignInCodeError()) },
    );

    expect(response.status).toBe(400);
    expect(await errorCodeOf(response)).toMatchObject({ code: "invalid_code" });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("refuses a body without a code", async () => {
    const response = await handleVerifySignInCode(
      jsonRequest("/api/auth/verify", { email: "receiver@example.com" }),
      { verifySignInCode: () => Promise.reject(new Error("not called")) },
    );

    expect(response.status).toBe(400);
    expect(await errorCodeOf(response)).toMatchObject({ code: "invalid_request" });
  });
});

describe("handleSignOut", () => {
  it("revokes the session and clears the cookie", async () => {
    const signedOut: string[] = [];
    const request = new NextRequest("http://localhost:3000/api/auth/sign-out", {
      method: "POST",
      headers: { cookie: "pomi_session=session_token_value" },
    });

    const response = await handleSignOut(request, {
      signOut: (token) => {
        signedOut.push(token);
        return Promise.resolve();
      },
    });

    expect(response.status).toBe(204);
    expect(signedOut).toEqual(["session_token_value"]);
    expect(response.headers.get("set-cookie")).toMatch(/pomi_session=;.*Expires=Thu, 01 Jan 1970/);
  });

  it("revokes the mobile app's bearer token", async () => {
    const signedOut: string[] = [];
    const request = new NextRequest("http://localhost:3000/api/auth/sign-out", {
      method: "POST",
      headers: { authorization: "Bearer mobile_token" },
    });

    await handleSignOut(request, {
      signOut: (token) => {
        signedOut.push(token);
        return Promise.resolve();
      },
    });

    expect(signedOut).toEqual(["mobile_token"]);
  });

  it("clears the cookie even without a session", async () => {
    const request = new NextRequest("http://localhost:3000/api/auth/sign-out", { method: "POST" });

    const response = await handleSignOut(request, {
      signOut: () => Promise.reject(new Error("not called")),
    });

    expect(response.status).toBe(204);
  });
});
