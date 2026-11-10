import "server-only";
import { DEFAULT_BASE_URL, SANDBOX_BASE_URL } from "@useroutr/sdk";
import { z } from "zod";

export type UseroutrEnvironment = "sandbox" | "production";

export type EmailDeliveryConfig =
  { provider: "console" } | { provider: "resend"; apiKey: string; from: string };

export interface ServerConfig {
  databaseUrl: string;
  // Keys the HMAC over stored sign-in codes.
  authSecret: string;
  email: EmailDeliveryConfig;
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

const emailDeliverySchema = z.discriminatedUnion("EMAIL_DELIVERY", [
  z.object({ EMAIL_DELIVERY: z.literal("console").optional() }),
  z.object({
    EMAIL_DELIVERY: z.literal("resend"),
    // The sender as recipients see it, "Name <address>" or a bare address, on
    // a domain Resend has verified.
    EMAIL_FROM: z.string().trim().min(3),
    RESEND_API_KEY: z.string().min(1),
  }),
]);

const environmentSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    AUTH_SECRET: z.string().min(32, "must be at least 32 characters (openssl rand -base64 32)"),
    USEROUTR_API_KEY: z
      .string()
      .regex(/^ur_(test|live)_./, "must be a Useroutr application key (ur_test_ or ur_live_)"),
    USEROUTR_WEBHOOK_SECRET: z.string().min(1),
  })
  .and(emailDeliverySchema)
  .superRefine((variables, context) => {
    // Console delivery writes sign-in codes to the server's output, where
    // anyone who can read the logs could use them.
    if (variables.EMAIL_DELIVERY !== "resend" && variables.NODE_ENV === "production") {
      context.addIssue({
        code: "custom",
        path: ["EMAIL_DELIVERY"],
        message: "console delivery is for local development; a production build needs resend",
      });
    }
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
    authSecret: variables.AUTH_SECRET,
    email: emailDeliveryConfig(variables),
    useroutr: {
      apiKey: variables.USEROUTR_API_KEY,
      environment: useroutrEnvironment,
      publicApiUrl: `${apiBaseUrl}/v1/public`,
      webhookSecret: variables.USEROUTR_WEBHOOK_SECRET,
    },
  };
}

function emailDeliveryConfig(variables: z.infer<typeof environmentSchema>): EmailDeliveryConfig {
  return variables.EMAIL_DELIVERY === "resend"
    ? { provider: "resend", apiKey: variables.RESEND_API_KEY, from: variables.EMAIL_FROM }
    : { provider: "console" };
}

let cachedConfig: ServerConfig | undefined;

export function serverConfig(): ServerConfig {
  cachedConfig ??= parseServerConfig(process.env);
  return cachedConfig;
}
