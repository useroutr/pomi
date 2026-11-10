import { describe, expect, it } from "vitest";
import { InvalidConfigurationError, parseServerConfig } from "./config";

const valid = {
  DATABASE_URL: "postgresql://pomi:pomi@localhost:5432/pomi",
  APP_URL: "http://localhost:3000",
  AUTH_SECRET: "a".repeat(32),
  USEROUTR_API_KEY: "ur_test_0123456789abcdef",
  USEROUTR_WEBHOOK_SECRET: "whsec_example",
};

describe("parseServerConfig", () => {
  it("points a ur_test_ key at the sandbox", () => {
    const config = parseServerConfig(valid);

    expect(config.useroutr.environment).toBe("sandbox");
    expect(config.useroutr.publicApiUrl).toBe("https://api.sandbox.useroutr.com/v1/public");
    expect(config.stellar).toEqual({
      network: "testnet",
      horizonUrl: "https://horizon-testnet.stellar.org",
    });
    expect(config.databaseUrl).toBe(valid.DATABASE_URL);
    expect(config.walletConnectProjectId).toBeNull();
    expect(config.cronSecret).toBeNull();
  });

  it("points a ur_live_ key at production", () => {
    const config = parseServerConfig({ ...valid, USEROUTR_API_KEY: "ur_live_0123456789abcdef" });

    expect(config.useroutr.environment).toBe("production");
    expect(config.useroutr.publicApiUrl).toBe("https://api.useroutr.com/v1/public");
    expect(config.stellar).toEqual({
      network: "mainnet",
      horizonUrl: "https://horizon.stellar.org",
    });
  });

  it.each([
    ["a missing key", { USEROUTR_API_KEY: undefined }, "USEROUTR_API_KEY"],
    ["a key of another kind", { USEROUTR_API_KEY: "sk_live_123" }, "USEROUTR_API_KEY"],
    ["a bare key prefix", { USEROUTR_API_KEY: "ur_test_" }, "USEROUTR_API_KEY"],
    ["a missing webhook secret", { USEROUTR_WEBHOOK_SECRET: undefined }, "USEROUTR_WEBHOOK_SECRET"],
    ["an empty webhook secret", { USEROUTR_WEBHOOK_SECRET: "" }, "USEROUTR_WEBHOOK_SECRET"],
    ["a database that is not Postgres", { DATABASE_URL: "mysql://localhost/pomi" }, "DATABASE_URL"],
    ["a missing app URL", { APP_URL: undefined }, "APP_URL"],
    ["an app URL that is not http", { APP_URL: "ftp://pomi.app" }, "APP_URL"],
    ["a short cron secret", { CRON_SECRET: "short" }, "CRON_SECRET"],
    ["a missing auth secret", { AUTH_SECRET: undefined }, "AUTH_SECRET"],
    ["a short auth secret", { AUTH_SECRET: "a".repeat(31) }, "AUTH_SECRET"],
    ["an unknown email delivery", { EMAIL_DELIVERY: "smtp" }, "EMAIL_DELIVERY"],
  ])("refuses %s", (_case, override, variable) => {
    expect(() => parseServerConfig({ ...valid, ...override })).toThrow(
      new RegExp(`^Invalid server configuration: .*${variable}`),
    );
  });

  it("never repeats a secret in its error", () => {
    const secretKey = "sk_live_do_not_echo_this";

    expect(() => parseServerConfig({ ...valid, USEROUTR_API_KEY: secretKey })).toThrow(
      InvalidConfigurationError,
    );
    expect(() => parseServerConfig({ ...valid, USEROUTR_API_KEY: secretKey })).not.toThrow(
      secretKey,
    );
  });

  it("sends email to the console by default, for local development", () => {
    expect(parseServerConfig(valid).email).toEqual({ provider: "console" });
  });

  it("sends email through Resend when configured", () => {
    const config = parseServerConfig({
      ...valid,
      EMAIL_DELIVERY: "resend",
      RESEND_API_KEY: "re_example",
      EMAIL_FROM: "Pomi <hello@pomi.app>",
    });

    expect(config.email).toEqual({
      provider: "resend",
      apiKey: "re_example",
      from: "Pomi <hello@pomi.app>",
    });
  });

  it.each([
    ["an API key", { EMAIL_FROM: "Pomi <hello@pomi.app>" }, "RESEND_API_KEY"],
    ["a sender", { RESEND_API_KEY: "re_example" }, "EMAIL_FROM"],
  ])("refuses Resend without %s", (_case, override, variable) => {
    expect(() => parseServerConfig({ ...valid, EMAIL_DELIVERY: "resend", ...override })).toThrow(
      new RegExp(`^Invalid server configuration: .*${variable}`),
    );
  });

  it("refuses console email in a production build, where codes would reach the logs", () => {
    expect(() => parseServerConfig({ ...valid, NODE_ENV: "production" })).toThrow(
      /EMAIL_DELIVERY: console delivery is for local development/,
    );
    expect(() =>
      parseServerConfig({ ...valid, NODE_ENV: "production", EMAIL_DELIVERY: "console" }),
    ).toThrow(/EMAIL_DELIVERY/);
  });

  it("uses a Horizon server of the operator's choice, without a trailing slash", () => {
    const config = parseServerConfig({ ...valid, STELLAR_HORIZON_URL: "https://horizon.example/" });

    expect(config.stellar.horizonUrl).toBe("https://horizon.example");
  });

  it("drops a trailing slash from the app URL", () => {
    expect(parseServerConfig({ ...valid, APP_URL: "https://pomi.app/" }).appUrl).toBe(
      "https://pomi.app",
    );
  });

  it("requires HTTPS for the app in a production build", () => {
    const production = {
      ...valid,
      NODE_ENV: "production",
      EMAIL_DELIVERY: "resend",
      RESEND_API_KEY: "re_example",
      EMAIL_FROM: "Pomi <hello@pomi.app>",
    };

    expect(() => parseServerConfig(production)).toThrow(/APP_URL: must be https/);
    expect(parseServerConfig({ ...production, APP_URL: "https://pomi.app" }).appUrl).toBe(
      "https://pomi.app",
    );
  });

  it("keeps the optional WalletConnect project and cron secret", () => {
    const config = parseServerConfig({
      ...valid,
      WALLETCONNECT_PROJECT_ID: "project_1",
      CRON_SECRET: "c".repeat(32),
    });

    expect(config.walletConnectProjectId).toBe("project_1");
    expect(config.cronSecret).toBe("c".repeat(32));
  });

  it("points at a local Useroutr when one is given", () => {
    const config = parseServerConfig({ ...valid, USEROUTR_API_URL: "http://localhost:4000/" });

    expect(config.useroutr.apiUrl).toBe("http://localhost:4000");
    expect(config.useroutr.publicApiUrl).toBe("http://localhost:4000/v1/public");
    expect(config.stellar.network).toBe("testnet");
  });
});
