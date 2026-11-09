import { describe, expect, it } from "vitest";
import { InvalidConfigurationError, parseServerConfig } from "./config";

const valid = {
  DATABASE_URL: "postgresql://pomi:pomi@localhost:5432/pomi",
  USEROUTR_API_KEY: "ur_test_0123456789abcdef",
  USEROUTR_WEBHOOK_SECRET: "whsec_example",
};

describe("parseServerConfig", () => {
  it("points a ur_test_ key at the sandbox", () => {
    const config = parseServerConfig(valid);

    expect(config.useroutr.environment).toBe("sandbox");
    expect(config.useroutr.publicApiUrl).toBe("https://api.sandbox.useroutr.com/v1/public");
    expect(config.databaseUrl).toBe(valid.DATABASE_URL);
  });

  it("points a ur_live_ key at production", () => {
    const config = parseServerConfig({ ...valid, USEROUTR_API_KEY: "ur_live_0123456789abcdef" });

    expect(config.useroutr.environment).toBe("production");
    expect(config.useroutr.publicApiUrl).toBe("https://api.useroutr.com/v1/public");
  });

  it.each([
    ["a missing key", { USEROUTR_API_KEY: undefined }, "USEROUTR_API_KEY"],
    ["a key of another kind", { USEROUTR_API_KEY: "sk_live_123" }, "USEROUTR_API_KEY"],
    ["a bare key prefix", { USEROUTR_API_KEY: "ur_test_" }, "USEROUTR_API_KEY"],
    ["a missing webhook secret", { USEROUTR_WEBHOOK_SECRET: undefined }, "USEROUTR_WEBHOOK_SECRET"],
    ["an empty webhook secret", { USEROUTR_WEBHOOK_SECRET: "" }, "USEROUTR_WEBHOOK_SECRET"],
    ["a database that is not Postgres", { DATABASE_URL: "mysql://localhost/pomi" }, "DATABASE_URL"],
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
});
