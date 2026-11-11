import "server-only";
import { z } from "zod";

export interface Trustline {
  code: string;
  issuer: string;
  // False when the asset's issuer requires authorization and has not given
  // it: the account cannot receive the asset.
  authorized: boolean;
}

export interface StellarAccountState {
  trustlines: Trustline[];
  // SEP-29: the account asks every sender for a memo, as an exchange's
  // shared deposit account does.
  memoRequired: boolean;
}

export interface StellarAccountReader {
  // Null when the account does not exist on the network.
  readAccount(address: string): Promise<StellarAccountState | null>;
}

export class StellarNetworkUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StellarNetworkUnavailableError";
  }
}

const READ_TIMEOUT_MS = 10_000;
const MEMO_REQUIRED_KEY = "config.memo_required";

const balanceSchema = z.union([
  z.object({
    asset_type: z.enum(["credit_alphanum4", "credit_alphanum12"]),
    asset_code: z.string(),
    asset_issuer: z.string(),
    is_authorized: z.boolean().optional(),
  }),
  z.object({ asset_type: z.enum(["native", "liquidity_pool_shares"]) }),
]);

const accountSchema = z.object({
  balances: z.array(balanceSchema),
  // Values are base64.
  data: z.record(z.string(), z.string()),
});

export function createHorizonAccountReader(options: {
  horizonUrl: string;
  fetch?: typeof fetch;
}): StellarAccountReader {
  const get = options.fetch ?? fetch;
  return {
    async readAccount(address: string) {
      let response: Response;
      try {
        response = await get(`${options.horizonUrl}/accounts/${encodeURIComponent(address)}`, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(READ_TIMEOUT_MS),
        });
      } catch (error) {
        throw new StellarNetworkUnavailableError("Horizon could not be reached", { cause: error });
      }
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new StellarNetworkUnavailableError(
          `Horizon answered ${String(response.status)} for an account`,
        );
      }
      const account = accountSchema.safeParse(await response.json());
      if (!account.success) {
        throw new StellarNetworkUnavailableError("Horizon answered with an unexpected account");
      }
      const memoFlag = account.data.data[MEMO_REQUIRED_KEY];
      return {
        trustlines: account.data.balances.flatMap((balance) =>
          "asset_code" in balance
            ? [
                {
                  code: balance.asset_code,
                  issuer: balance.asset_issuer,
                  authorized: balance.is_authorized ?? true,
                },
              ]
            : [],
        ),
        memoRequired:
          memoFlag !== undefined && Buffer.from(memoFlag, "base64").toString("utf8") === "1",
      };
    },
  };
}
