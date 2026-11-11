import { InvalidAmountError } from "@pomi/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { FakeStellar } from "@/test/fake-stellar";
import { FakeUseroutr, USDC_ISSUER } from "@/test/fake-useroutr";
import { emptyTables, RECEIVER_ACCOUNT, testDatabase } from "@/test/test-database";
import {
  PayoutAddressRequiredError,
  PayoutAssetNotTrustedError,
} from "../payout-addresses/payout-address-errors";
import { createPayoutAddressService } from "../payout-addresses/payout-address-service";
import {
  InvalidNoteError,
  RequestAlreadyPaidError,
  RequestNotFoundError,
  UnsupportedAssetError,
} from "./request-errors";
import { createRequestService } from "./request-service";

const database = testDatabase();
let stellar: FakeStellar;

function services() {
  const payoutAddresses = createPayoutAddressService({
    database,
    accountReader: stellar,
    network: "testnet",
  });
  const requests = createRequestService({
    database,
    useroutr: new FakeUseroutr(),
    payoutAddresses,
  });
  return { payoutAddresses, requests };
}

beforeEach(async () => {
  await emptyTables(database);
  await database.user.create({ data: { id: "usr_1", email: "receiver@example.com" } });
  await database.user.create({ data: { id: "usr_2", email: "other@example.com" } });
  stellar = new FakeStellar();
  stellar.accounts.set(RECEIVER_ACCOUNT, {
    trustlines: [{ code: "USDC", issuer: USDC_ISSUER, authorized: true }],
    memoRequired: false,
  });
  await services().payoutAddresses.setPayoutAddress("usr_1", RECEIVER_ACCOUNT);
});

afterAll(async () => {
  await database.$disconnect();
});

describe("creating a request", () => {
  it("creates a single-use request paying the receiver's current address", async () => {
    const { requests } = services();

    const created = await requests.createRequest("usr_1", {
      amount: "25.50",
      assetId: "asset_usdc_stellar",
      note: "  Logo design  ",
    });

    const stored = await database.request.findUniqueOrThrow({
      where: { id: created.id },
      include: { payoutAddress: true },
    });
    expect(created.id).toMatch(/^req_[\w-]{22}$/);
    expect(stored).toMatchObject({
      kind: "SINGLE",
      amountKind: "FIXED",
      assetId: "asset_usdc_stellar",
      note: "Logo design",
      status: "OPEN",
    });
    expect(stored.amount?.toString()).toBe("25.5");
    expect(stored.payoutAddress.address).toBe(RECEIVER_ACCOUNT);
  });

  it("offers USDC and XLM from Useroutr's list, and nothing else", async () => {
    const assets = await services().requests.requestableAssets();

    expect(assets.map((asset) => asset.symbol)).toEqual(["USDC", "XLM"]);
  });

  it.each([
    ["an amount with eight decimals", { amount: "1.12345678" }, InvalidAmountError],
    ["a zero amount", { amount: "0" }, InvalidAmountError],
    ["an asset Pomi does not offer", { assetId: "asset_eurc_stellar" }, UnsupportedAssetError],
    ["an unknown asset", { assetId: "asset_doge" }, UnsupportedAssetError],
    ["a note over 280 characters", { note: "x".repeat(281) }, InvalidNoteError],
  ])("refuses %s", async (_case, override, errorType) => {
    await expect(
      services().requests.createRequest("usr_1", {
        amount: "25",
        assetId: "asset_usdc_stellar",
        ...override,
      }),
    ).rejects.toThrow(errorType);
    expect(await database.request.count()).toBe(0);
  });

  it("asks for a payout address first", async () => {
    await expect(
      services().requests.createRequest("usr_2", { amount: "25", assetId: "asset_xlm_stellar" }),
    ).rejects.toThrow(PayoutAddressRequiredError);
  });

  it("refuses USDC when the payout account does not trust it", async () => {
    stellar.accounts.set(RECEIVER_ACCOUNT, { trustlines: [], memoRequired: false });

    await expect(
      services().requests.createRequest("usr_1", { amount: "25", assetId: "asset_usdc_stellar" }),
    ).rejects.toThrow(PayoutAssetNotTrustedError);
    await expect(
      services().requests.createRequest("usr_1", { amount: "25", assetId: "asset_xlm_stellar" }),
    ).resolves.toHaveProperty("id");
  });
});

describe("listing and showing requests", () => {
  it("lists the receiver's own requests, newest first, with their symbols", async () => {
    const { requests } = services();
    const first = await requests.createRequest("usr_1", {
      amount: "5",
      assetId: "asset_xlm_stellar",
    });
    const second = await requests.createRequest("usr_1", {
      amount: "25",
      assetId: "asset_usdc_stellar",
    });

    const listed = await requests.listRequests("usr_1");

    expect(listed.map((request) => [request.id, request.assetSymbol])).toEqual([
      [second.id, "USDC"],
      [first.id, "XLM"],
    ]);
    await expect(requests.listRequests("usr_2")).resolves.toEqual([]);
  });

  it("shows a payer the amount, note and address, never the receiver's email", async () => {
    const { requests } = services();
    const created = await requests.createRequest("usr_1", {
      amount: "25",
      assetId: "asset_usdc_stellar",
      note: "Logo design",
    });

    const shown = await requests.payerRequest(created.id);

    expect(shown).toEqual({
      id: created.id,
      amount: "25",
      assetSymbol: "USDC",
      note: "Logo design",
      status: "OPEN",
      receiverName: null,
      payoutAddress: RECEIVER_ACCOUNT,
      payoutAddressVerified: false,
    });
    expect(JSON.stringify(shown)).not.toContain("receiver@example.com");
    await expect(requests.payerRequest("req_missing")).resolves.toBeNull();
  });
});

describe("closing a request", () => {
  it("closes the receiver's open request, and again changes nothing", async () => {
    const { requests } = services();
    const created = await requests.createRequest("usr_1", {
      amount: "5",
      assetId: "asset_xlm_stellar",
    });

    await requests.closeRequest("usr_1", created.id);
    await requests.closeRequest("usr_1", created.id);

    await expect(
      database.request.findUniqueOrThrow({ where: { id: created.id } }),
    ).resolves.toMatchObject({
      status: "CLOSED",
    });
  });

  it("does not let another receiver close it", async () => {
    const { requests } = services();
    const created = await requests.createRequest("usr_1", {
      amount: "5",
      assetId: "asset_xlm_stellar",
    });

    await expect(requests.closeRequest("usr_2", created.id)).rejects.toThrow(RequestNotFoundError);
  });

  it("refuses to close a paid request", async () => {
    const { requests } = services();
    const created = await requests.createRequest("usr_1", {
      amount: "5",
      assetId: "asset_xlm_stellar",
    });
    await database.request.update({ where: { id: created.id }, data: { status: "PAID" } });

    await expect(requests.closeRequest("usr_1", created.id)).rejects.toThrow(
      RequestAlreadyPaidError,
    );
  });
});
