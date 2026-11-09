import "server-only";
import { DEFAULT_BASE_URL, SANDBOX_BASE_URL } from "@useroutr/sdk";
import { z } from "zod";

export type UseroutrEnvironment = "sandbox" | "production";

export interface ServerConfig {
  databaseUrl: string;
  useroutr: {
    apiKey: string;
    environment: UseroutrEnvironment;
    // Where the embedded checkout, running in the payer's browser, calls
    // Useroutr's public endpoints. It needs no key.
    publicApiUrl: string;
    webhookSecret: string;
  };
}

export class InvalidConfigurationError extends Error {
  constructor(problems: string[]) {
    super(`Invalid server configuration: ${problems.join("; ")}`);
    this.name = "InvalidConfigurationError";
  }
}

const environmentSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  USEROUTR_API_KEY: z
    .string()
    .regex(/^ur_(test|live)_./, "must be a Useroutr application key (ur_test_ or ur_live_)"),
  USEROUTR_WEBHOOK_SECRET: z.string().min(1),
});

// The key decides the Useroutr environment: ur_test_ keys work only against the
// sandbox (testnet) and ur_live_ keys only against production (mainnet). The
// checkout's address is derived from the key rather than configured, so the two
// cannot disagree.
export function parseServerConfig(environment: Record<string, string | undefined>): ServerConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    // Messages name the variable and the rule, never the value, which may be a secret.
    throw new InvalidConfigurationError(
      result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    );
  }
  const variables = result.data;
  const useroutrEnvironment: UseroutrEnvironment = variables.USEROUTR_API_KEY.startsWith("ur_live_")
    ? "production"
    : "sandbox";
  const apiBaseUrl = useroutrEnvironment === "production" ? DEFAULT_BASE_URL : SANDBOX_BASE_URL;
  return {
    databaseUrl: variables.DATABASE_URL,
    useroutr: {
      apiKey: variables.USEROUTR_API_KEY,
      environment: useroutrEnvironment,
      publicApiUrl: `${apiBaseUrl}/v1/public`,
      webhookSecret: variables.USEROUTR_WEBHOOK_SECRET,
    },
  };
}

let cachedConfig: ServerConfig | undefined;

export function serverConfig(): ServerConfig {
  cachedConfig ??= parseServerConfig(process.env);
  return cachedConfig;
}
