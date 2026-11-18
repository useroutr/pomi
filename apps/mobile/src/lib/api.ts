import { z } from "zod";
import { APP_URL } from "./config";

const errorBodySchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

export type ApiResult<T> = { ok: true; value: T } | { ok: false; status: number; message: string };

export class ApiClient {
  constructor(private readonly token: string | null) {}

  get<T>(path: string, schema: z.ZodType<T>): Promise<ApiResult<T>> {
    return this.call("GET", path, undefined, schema);
  }

  post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<ApiResult<T>> {
    return this.call("POST", path, body, schema);
  }

  put<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<ApiResult<T>> {
    return this.call("PUT", path, body, schema);
  }

  // For endpoints that answer 204 with no body.
  postNoContent(path: string, body: unknown): Promise<ApiResult<null>> {
    return this.call("POST", path, body, z.null());
  }

  patch(path: string, body: unknown): Promise<ApiResult<null>> {
    return this.call("PATCH", path, body, z.null());
  }

  delete(path: string, body?: unknown): Promise<ApiResult<null>> {
    return this.call("DELETE", path, body, z.null());
  }

  private async call<T>(
    method: string,
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
  ): Promise<ApiResult<T>> {
    let response: Response;
    try {
      response = await fetch(`${APP_URL}${path}`, {
        method,
        headers: {
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(this.token === null ? {} : { authorization: `Bearer ${this.token}` }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      return { ok: false, status: 0, message: "Pomi could not be reached. Check your connection." };
    }
    const json: unknown = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = errorBodySchema.safeParse(json);
      return {
        ok: false,
        status: response.status,
        message: parsed.success ? parsed.data.error.message : "Something went wrong. Try again.",
      };
    }
    const parsed = schema.safeParse(json);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : {
          ok: false,
          status: response.status,
          message: "Pomi answered in a way this app does not understand. Update the app.",
        };
  }
}

export const meSchema = z.object({
  user: z.object({
    email: z.string(),
    handle: z.string().nullable(),
    displayName: z.string().nullable(),
  }),
});

// Older servers knew only Stellar, so a missing network means Stellar.
const savedPayoutAddressSchema = z.object({
  network: z.string().default("stellar"),
  address: z.string(),
  verified: z.boolean(),
});

export type SavedPayoutAddress = z.infer<typeof savedPayoutAddressSchema>;

export const payoutAddressSchema = z.object({
  payoutAddress: savedPayoutAddressSchema.nullable(),
});

// Every network the receiver has an address on, one each.
export const payoutAddressesSchema = z.object({
  payoutAddresses: z.array(savedPayoutAddressSchema),
});

export const assetsSchema = z.object({
  // What a request can ask for, each on the network the receiver is paid on.
  assets: z.array(
    z.object({
      id: z.string(),
      symbol: z.string(),
      network: z.string().default("stellar"),
      decimals: z.number().int().min(0).default(7),
    }),
  ),
  network: z.enum(["testnet", "mainnet"]),
  // Where payers can pay from, as Useroutr lists it: networks and the tokens
  // each takes, whatever the receiver is paid in.
  payWith: z.array(z.object({ network: z.string(), symbols: z.array(z.string()) })).default([]),
});

export type PaymentNetwork = z.infer<typeof assetsSchema>["payWith"][number];

export type RequestableAsset = z.infer<typeof assetsSchema>["assets"][number];

export const handleAvailabilitySchema = z.object({
  handle: z.string(),
  available: z.boolean(),
  problem: z.string().nullable(),
});

export const readinessSchema = z.object({
  payoutAddresses: z.array(savedPayoutAddressSchema).default([]),
  assets: z.array(
    z.object({
      id: z.string(),
      symbol: z.string(),
      network: z.string().default("stellar"),
      ready: z.boolean(),
      problem: z.string().nullable(),
    }),
  ),
});

export type Readiness = z.infer<typeof readinessSchema>;

export const payBoxSchema = z.object({
  payBox: z
    .object({
      open: z.boolean(),
      assetId: z.string(),
      assetSymbol: z.string(),
      assetNetwork: z.string().default("stellar"),
      amount: z.string().nullable(),
      minimumAmount: z.string().nullable(),
      payoutAddress: z.string(),
    })
    .nullable(),
});

export type PayBox = NonNullable<z.infer<typeof payBoxSchema>["payBox"]>;

const requestSchema = z.object({
  id: z.string(),
  kind: z.enum(["SINGLE", "REUSABLE"]),
  amount: z.string().nullable(),
  assetSymbol: z.string(),
  assetNetwork: z.string().default("stellar"),
  note: z.string().nullable(),
  listed: z.boolean(),
  status: z.enum(["OPEN", "PAID", "CLOSED"]),
  endsAt: z.string().nullable(),
  createdAt: z.string(),
  payments: z.array(
    z.object({
      amount: z.string(),
      creditedAt: z.string(),
      settlementTransactionHash: z.string().nullable(),
    }),
  ),
});

export type ReceiverRequest = z.infer<typeof requestSchema>;

export const requestsSchema = z.object({ requests: z.array(requestSchema) });

export const createdRequestSchema = z.object({
  request: z.object({ id: z.string(), url: z.string() }),
});

export const sessionSchema = z.object({
  user: z.object({ handle: z.string().nullable() }),
  session: z.object({ token: z.string(), expiresAt: z.string() }),
});

export const profileSchema = z.object({
  profile: z.object({ handle: z.string().nullable(), displayName: z.string().nullable() }),
});
