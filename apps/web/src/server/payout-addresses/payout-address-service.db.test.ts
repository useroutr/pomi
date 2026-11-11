import { InvalidStellarAccountError } from "@pomi/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { FakeStellar } from "@/test/fake-stellar";
import { STELLAR_ASSETS, USDC_ISSUER } from "@/test/fake-useroutr";
import { emptyTables, OTHER_ACCOUNT, RECEIVER_ACCOUNT, testDatabase } from "@/test/test-database";
import {
  PayoutAccountMissingError,
  PayoutAccountNeedsMemoError,
  PayoutAssetNotTrustedError,
} from "./payout-address-errors";
import { createPayoutAddressService } from "./payout-address-service";

const database = testDatabase();
const [USDC, XLM] = STELLAR_ASSETS;
if (USDC === undefined || XLM === undefined) {
  throw new Error("the fake asset list changed");
}

let stellar: FakeStellar;

function service() {
  return createPayoutAddressService({ database, accountReader: stellar, network: "testnet" });
}

beforeEach(async () => {
  await emptyTables(database);
  await database.user.create({ data: { id: "usr_1", email: "receiver@example.com" } });
  stellar = new FakeStellar();
  stellar.accounts.set(RECEIVER_ACCOUNT, { trustlines: [], memoRequired: false });
  stellar.accounts.set(OTHER_ACCOUNT, { trustlines: [], memoRequired: false });
});

afterAll(async () => {
  await database.$disconnect();
});

describe("setting a payout address", () => {
  it("saves an account that exists and takes payments without a memo", async () => {
    const saved = await service().setPayoutAddress("usr_1", ` ${RECEIVER_ACCOUNT} `);

    expect(saved).toMatchObject({ address: RECEIVER_ACCOUNT, verified: false });
    await expect(service().payoutAddress("usr_1")).resolves.toEqual(saved);
  });

  it("refuses an address with a typo before reading the network", async () => {
    await expect(
      service().setPayoutAddress("usr_1", `${RECEIVER_ACCOUNT.slice(0, 55)}A`),
    ).rejects.toThrow(InvalidStellarAccountError);
  });

  it("refuses an account that does not exist yet, and says how to open it", async () => {
    stellar.accounts.delete(RECEIVER_ACCOUNT);

    await expect(service().setPayoutAddress("usr_1", RECEIVER_ACCOUNT)).rejects.toThrow(
      new PayoutAccountMissingError("testnet"),
    );
    expect(await database.payoutAddress.count()).toBe(0);
  });

  it("refuses an exchange account that requires a memo", async () => {
    stellar.accounts.set(RECEIVER_ACCOUNT, { trustlines: [], memoRequired: true });

    await expect(service().setPayoutAddress("usr_1", RECEIVER_ACCOUNT)).rejects.toThrow(
      PayoutAccountNeedsMemoError,
    );
  });

  it("keeps the earlier address, inactive, when a new one is saved", async () => {
    await service().setPayoutAddress("usr_1", RECEIVER_ACCOUNT);

    await service().setPayoutAddress("usr_1", OTHER_ACCOUNT);

    await expect(service().payoutAddress("usr_1")).resolves.toMatchObject({
      address: OTHER_ACCOUNT,
    });
    expect(await database.payoutAddress.count()).toBe(2);
  });

  it("changes nothing when the same address is saved again", async () => {
    const first = await service().setPayoutAddress("usr_1", RECEIVER_ACCOUNT);

    await expect(service().setPayoutAddress("usr_1", RECEIVER_ACCOUNT)).resolves.toEqual(first);
    expect(await database.payoutAddress.count()).toBe(1);
  });

  it("leaves one active address when two saves arrive together", async () => {
    await Promise.all([
      service().setPayoutAddress("usr_1", RECEIVER_ACCOUNT),
      service().setPayoutAddress("usr_1", OTHER_ACCOUNT),
    ]);

    expect(await database.payoutAddress.count({ where: { active: true } })).toBe(1);
  });
});

describe("checking an account can receive an asset", () => {
  it("accepts XLM on any open account", async () => {
    await expect(service().assertCanReceive(RECEIVER_ACCOUNT, XLM)).resolves.toBeUndefined();
  });

  it("accepts USDC on an account that trusts Circle's USDC", async () => {
    stellar.accounts.set(RECEIVER_ACCOUNT, {
      trustlines: [{ code: "USDC", issuer: USDC_ISSUER, authorized: true }],
      memoRequired: false,
    });

    await expect(service().assertCanReceive(RECEIVER_ACCOUNT, USDC)).resolves.toBeUndefined();
  });

  it.each([
    ["no trustline", []],
    ["a USDC from another issuer", [{ code: "USDC", issuer: OTHER_ACCOUNT, authorized: true }]],
    ["an unauthorized trustline", [{ code: "USDC", issuer: USDC_ISSUER, authorized: false }]],
  ])("refuses USDC with %s", async (_case, trustlines) => {
    stellar.accounts.set(RECEIVER_ACCOUNT, { trustlines, memoRequired: false });

    await expect(service().assertCanReceive(RECEIVER_ACCOUNT, USDC)).rejects.toThrow(
      PayoutAssetNotTrustedError,
    );
  });

  it("refuses an account that has since been closed", async () => {
    stellar.accounts.delete(RECEIVER_ACCOUNT);

    await expect(service().assertCanReceive(RECEIVER_ACCOUNT, XLM)).rejects.toThrow(
      PayoutAccountMissingError,
    );
  });
});
