import { describe, expect, it } from "vitest";
import {
  createHorizonAccountReader,
  StellarNetworkUnavailableError,
} from "./horizon-account-reader";

const ACCOUNT = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

function readerAnswering(answer: Response | Error) {
  const urls: string[] = [];
  const reader = createHorizonAccountReader({
    horizonUrl: "https://horizon.example",
    fetch: (input) => {
      urls.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
  });
  return { reader, urls };
}

describe("createHorizonAccountReader", () => {
  it("reads the account's trustlines and memo flag", async () => {
    const { reader, urls } = readerAnswering(
      Response.json({
        balances: [
          {
            asset_type: "credit_alphanum4",
            asset_code: "USDC",
            asset_issuer: ISSUER,
            is_authorized: true,
          },
          {
            asset_type: "credit_alphanum12",
            asset_code: "LONGASSET",
            asset_issuer: ISSUER,
            is_authorized: false,
          },
          { asset_type: "liquidity_pool_shares", liquidity_pool_id: "pool" },
          { asset_type: "native", balance: "10.0000000" },
        ],
        data: { "config.memo_required": "MQ==" },
      }),
    );

    await expect(reader.readAccount(ACCOUNT)).resolves.toEqual({
      trustlines: [
        { code: "USDC", issuer: ISSUER, authorized: true },
        { code: "LONGASSET", issuer: ISSUER, authorized: false },
      ],
      memoRequired: true,
    });
    expect(urls).toEqual([`https://horizon.example/accounts/${ACCOUNT}`]);
  });

  it.each([
    ["no data entries", {}],
    ["a memo flag set to something else", { "config.memo_required": "MA==" }],
  ])("finds no memo requirement with %s", async (_case, data) => {
    const { reader } = readerAnswering(Response.json({ balances: [], data }));

    await expect(reader.readAccount(ACCOUNT)).resolves.toMatchObject({ memoRequired: false });
  });

  it("answers null for an account that does not exist", async () => {
    const { reader } = readerAnswering(Response.json({ status: 404 }, { status: 404 }));

    await expect(reader.readAccount(ACCOUNT)).resolves.toBeNull();
  });

  it.each([
    ["Horizon cannot be reached", new TypeError("fetch failed")],
    ["Horizon fails", new Response("busy", { status: 503 })],
    ["Horizon answers with another shape", Response.json({ id: ACCOUNT })],
  ])("fails when %s", async (_case, answer) => {
    const { reader } = readerAnswering(answer);

    await expect(reader.readAccount(ACCOUNT)).rejects.toThrow(StellarNetworkUnavailableError);
  });
});
