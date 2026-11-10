import "server-only";
import { DEFAULT_BASE_URL, SANDBOX_BASE_URL } from "@useroutr/sdk";
import { z } from "zod";

export type UseroutrEnvironment = "sandbox" | "production";
export type StellarNetwork = "testnet" | "mainnet";

export type EmailDeliveryConfig =
  { provider: "console" } | { provider: "resend"; apiKey: string; from: string };

export interface ServerConfig {
  databaseUrl: string;
  // Where the app is served, for links in emails and shared requests.
  appUrl: string;
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
  stellar: {
    // Always the network of the Useroutr environment: Useroutr pays
    // receivers there, so their accounts are checked there.
    network: StellarNetwork;
    horizonUrl: string;
  };
  // Lets payers pair a phone wallet in the checkout. Without it, browser
  // wallets and paying by hand still work.
  walletConnectProjectId: string | null;
  // The bearer token scheduled jobs present. Without it, they refuse to run.
  cronSecret: string | null;
}

const DEFAULT_HORIZON_URLS: Record<StellarNetwork, string> = {
  testnet: "https://horizon-testnet.stellar.org",
  mainnet: "https://horizon.stellar.org",
};

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
    APP_URL: z.url({ protocol: /^https?$/ }),
    STELLAR_HORIZON_URL: z.url({ protocol: /^https?$/ }).optional(),
    WALLETCONNECT_PROJECT_ID: z.string().trim().min(1).optional(),
    CRON_SECRET: z.string().min(32, "must be at least 32 characters").optional(),
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
    // Session cookies are Secure in a production build, so the app must be
    // served over HTTPS for sign-in to work at all.
    if (variables.NODE_ENV === "production" && !variables.APP_URL.startsWith("https://")) {
      context.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "must be https in a production build",
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
  const stellarNetwork: StellarNetwork =
    useroutrEnvironment === "production" ? "mainnet" : "testnet";
  return {
    databaseUrl: variables.DATABASE_URL,
    appUrl: variables.APP_URL.replace(/\/+$/, ""),
    authSecret: variables.AUTH_SECRET,
    email: emailDeliveryConfig(variables),
    useroutr: {
      apiKey: variables.USEROUTR_API_KEY,
      environment: useroutrEnvironment,
      publicApiUrl: `${apiBaseUrl}/v1/public`,
      webhookSecret: variables.USEROUTR_WEBHOOK_SECRET,
    },
    stellar: {
      network: stellarNetwork,
      horizonUrl: (variables.STELLAR_HORIZON_URL ?? DEFAULT_HORIZON_URLS[stellarNetwork]).replace(
        /\/+$/,
        "",
      ),
    },
    walletConnectProjectId: variables.WALLETCONNECT_PROJECT_ID ?? null,
    cronSecret: variables.CRON_SECRET ?? null,
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
