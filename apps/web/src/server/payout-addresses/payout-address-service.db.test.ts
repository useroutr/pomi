import { InvalidEvmAddressError, InvalidStellarAccountError } from "@pomi/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { FakeStellar } from "@/test/fake-stellar";
import { CATALOG_ASSETS, USDC_ISSUER } from "@/test/fake-useroutr";
import { emptyTables, OTHER_ACCOUNT, RECEIVER_ACCOUNT, testDatabase } from "@/test/test-database";
import {
  PayoutAccountMissingError,
  PayoutAccountNeedsMemoError,
  PayoutAssetNotTrustedError,
} from "./payout-address-errors";
import { createPayoutAddressService } from "./payout-address-service";

const database = testDatabase();
const [USDC, XLM] = CATALOG_ASSETS;
const BASE_USDC = CATALOG_ASSETS.find((asset) => asset.id === "asset_usdc_base");
if (USDC === undefined || XLM === undefined || BASE_USDC === undefined) {
  throw new Error("the fake asset list changed");
}
const ON_STELLAR = { network: "stellar", addressKind: "stellar" } as const;
const ON_BASE = { network: "base", addressKind: "evm" } as const;
// EIP-55's own example, written checksummed and in lowercase.
const BASE_ADDRESS = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";

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
    const saved = await service().setPayoutAddress("usr_1", ` ${RECEIVER_ACCOUNT} `, ON_STELLAR);

    expect(saved).toMatchObject({ address: RECEIVER_ACCOUNT, verified: false });
    await expect(service().payoutAddress("usr_1")).resolves.toEqual(saved);
  });

  it("refuses an address with a typo before reading the network", async () => {
    await expect(
      service().setPayoutAddress("usr_1", `${RECEIVER_ACCOUNT.slice(0, 55)}A`, ON_STELLAR),
    ).rejects.toThrow(InvalidStellarAccountError);
  });

  it("refuses an account that does not exist yet, and says how to open it", async () => {
    stellar.accounts.delete(RECEIVER_ACCOUNT);

    await expect(service().setPayoutAddress("usr_1", RECEIVER_ACCOUNT, ON_STELLAR)).rejects.toThrow(
      new PayoutAccountMissingError("testnet"),
    );
    expect(await database.payoutAddress.count()).toBe(0);
  });

  it("refuses an exchange account that requires a memo", async () => {
    stellar.accounts.set(RECEIVER_ACCOUNT, { trustlines: [], memoRequired: true });

    await expect(service().setPayoutAddress("usr_1", RECEIVER_ACCOUNT, ON_STELLAR)).rejects.toThrow(
      PayoutAccountNeedsMemoError,
    );
  });

  it("keeps the earlier address, inactive, when a new one is saved", async () => {
    await service().setPayoutAddress("usr_1", RECEIVER_ACCOUNT, ON_STELLAR);

    await service().setPayoutAddress("usr_1", OTHER_ACCOUNT, ON_STELLAR);

    await expect(service().payoutAddress("usr_1")).resolves.toMatchObject({
      address: OTHER_ACCOUNT,
    });
    expect(await database.payoutAddress.count()).toBe(2);
  });

  it("changes nothing when the same address is saved again", async () => {
    const first = await service().setPayoutAddress("usr_1", RECEIVER_ACCOUNT, ON_STELLAR);

    await expect(
      service().setPayoutAddress("usr_1", RECEIVER_ACCOUNT, ON_STELLAR),
    ).resolves.toEqual(first);
    expect(await database.payoutAddress.count()).toBe(1);
  });

  it("keeps an address per network: a new Stellar account leaves the Base address active", async () => {
    await service().setPayoutAddress("usr_1", BASE_ADDRESS.toLowerCase(), ON_BASE);
    await service().setPayoutAddress("usr_1", RECEIVER_ACCOUNT, ON_STELLAR);
    await service().setPayoutAddress("usr_1", OTHER_ACCOUNT, ON_STELLAR);

    const addresses = await service().payoutAddresses("usr_1");
    expect(addresses.map((address) => [address.network, address.address])).toEqual([
      ["base", BASE_ADDRESS],
      ["stellar", OTHER_ACCOUNT],
    ]);
  });

  it("saves an EVM address checksummed, without reading any network", async () => {
    const saved = await service().setPayoutAddress("usr_1", BASE_ADDRESS.toLowerCase(), ON_BASE);

    expect(saved).toMatchObject({ network: "base", address: BASE_ADDRESS });
    expect(stellar.reads).toBe(0);
  });

  it("refuses an EVM address whose checksum does not match", async () => {
    const typo = `${BASE_ADDRESS.slice(0, 4)}a${BASE_ADDRESS.slice(5)}`;

    await expect(service().setPayoutAddress("usr_1", typo, ON_BASE)).rejects.toThrow(
      InvalidEvmAddressError,
    );
    expect(await database.payoutAddress.count()).toBe(0);
  });

  it("refuses, at the database, a Stellar account saved as an EVM network's address", async () => {
    await expect(
      database.payoutAddress.create({
        data: { id: "addr_x", userId: "usr_1", network: "base", address: RECEIVER_ACCOUNT },
      }),
    ).rejects.toThrow();
  });

  it("leaves one active address when two saves arrive together", async () => {
    await Promise.all([
      service().setPayoutAddress("usr_1", RECEIVER_ACCOUNT, ON_STELLAR),
      service().setPayoutAddress("usr_1", OTHER_ACCOUNT, ON_STELLAR),
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

describe("readiness for each asset", () => {
  it("says each asset needs an address on its network before one is saved", async () => {
    const readiness = await service().readiness("usr_1", [XLM, BASE_USDC]);

    expect(readiness.payoutAddress).toBeNull();
    expect(readiness.payoutAddresses).toEqual([]);
    expect(readiness.assets).toEqual([
      {
        id: XLM.id,
        symbol: "XLM",
        network: "stellar",
        ready: false,
        problem: "Add the Stellar address you want to be paid at first.",
      },
      {
        id: BASE_USDC.id,
        symbol: "USDC",
        network: "base",
        ready: false,
        problem: "Add the Base address you want to be paid at first.",
      },
    ]);
  });

  it("says USDC on Base is ready once a Base address is saved", async () => {
    await service().setPayoutAddress("usr_1", BASE_ADDRESS, ON_BASE);

    const readiness = await service().readiness("usr_1", [XLM, BASE_USDC]);

    expect(readiness.assets.map((asset) => [asset.network, asset.ready])).toEqual([
      ["stellar", false],
      ["base", true],
    ]);
  });

  it("says XLM is ready and USDC needs a trustline, and how to add it", async () => {
    await service().setPayoutAddress("usr_1", RECEIVER_ACCOUNT, ON_STELLAR);

    const readiness = await service().readiness("usr_1", [USDC, XLM]);

    expect(readiness.payoutAddress).toMatchObject({ address: RECEIVER_ACCOUNT });
    expect(readiness.assets).toEqual([
      {
        id: USDC.id,
        symbol: "USDC",
        network: "stellar",
        ready: false,
        problem: expect.stringContaining("add USDC") as unknown,
      },
      { id: XLM.id, symbol: "XLM", network: "stellar", ready: true, problem: null },
    ]);
  });

  it("says both are ready once the account trusts USDC", async () => {
    await service().setPayoutAddress("usr_1", RECEIVER_ACCOUNT, ON_STELLAR);
    stellar.accounts.set(RECEIVER_ACCOUNT, {
      trustlines: [{ code: "USDC", issuer: USDC_ISSUER, authorized: true }],
      memoRequired: false,
    });

    const readiness = await service().readiness("usr_1", [USDC, XLM]);

    expect(readiness.assets.map((asset) => asset.ready)).toEqual([true, true]);
  });

  it("says nothing is ready once the account starts asking for a memo", async () => {
    await service().setPayoutAddress("usr_1", RECEIVER_ACCOUNT, ON_STELLAR);
    stellar.accounts.set(RECEIVER_ACCOUNT, { trustlines: [], memoRequired: true });

    const readiness = await service().readiness("usr_1", [USDC, XLM]);

    expect(readiness.assets.every((asset) => !asset.ready)).toBe(true);
  });
});
