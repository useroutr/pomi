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
import { ProfileNotFoundError } from "../profiles/profile-errors";
import {
  InvalidEndDateError,
  InvalidMinimumError,
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
      kind: "SINGLE",
      amount: "25",
      minimumAmount: null,
      assetSymbol: "USDC",
      note: "Logo design",
      status: "OPEN",
      ended: false,
      receiverName: null,
      receiverHandle: null,
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

describe("reusable and listed requests", () => {
  it("creates a reusable request, listed on the receiver's page, with an end date", async () => {
    const { requests } = services();

    const created = await requests.createRequest("usr_1", {
      amount: "10",
      assetId: "asset_xlm_stellar",
      reusable: true,
      listed: true,
      endsAt: "2099-01-01T00:00:00Z",
    });

    await expect(
      database.request.findUniqueOrThrow({ where: { id: created.id } }),
    ).resolves.toMatchObject({
      kind: "REUSABLE",
      amountKind: "FIXED",
      listed: true,
      endsAt: new Date("2099-01-01T00:00:00Z"),
    });
  });

  it.each(["2020-01-01", "not a date"])("refuses the end date %j", async (endsAt) => {
    await expect(
      services().requests.createRequest("usr_1", {
        amount: "10",
        assetId: "asset_xlm_stellar",
        endsAt,
      }),
    ).rejects.toThrow(InvalidEndDateError);
  });

  it("lists and unlists the receiver's own request only", async () => {
    const { requests } = services();
    const created = await requests.createRequest("usr_1", {
      amount: "5",
      assetId: "asset_xlm_stellar",
    });

    await requests.updateRequest("usr_1", created.id, { listed: true });

    await expect(
      database.request.findUniqueOrThrow({ where: { id: created.id } }),
    ).resolves.toMatchObject({ listed: true });
    await expect(requests.updateRequest("usr_2", created.id, { listed: false })).rejects.toThrow(
      RequestNotFoundError,
    );
  });
});

describe("the pay box", () => {
  it("lets the payer choose the amount, above an optional minimum", async () => {
    const { requests } = services();

    const saved = await requests.setPayBox("usr_1", {
      assetId: "asset_usdc_stellar",
      minimumAmount: "5",
    });

    expect(saved).toEqual({
      open: true,
      assetId: "asset_usdc_stellar",
      assetSymbol: "USDC",
      amount: null,
      minimumAmount: "5",
      payoutAddress: RECEIVER_ACCOUNT,
    });
    await expect(
      database.request.findFirstOrThrow({ where: { payBox: true } }),
    ).resolves.toMatchObject({
      kind: "REUSABLE",
      amountKind: "OPEN",
    });
  });

  it("changes the one pay box in place, and can close and reopen it", async () => {
    const { requests } = services();
    await requests.setPayBox("usr_1", { assetId: "asset_usdc_stellar" });

    await requests.setPayBox("usr_1", { assetId: "asset_xlm_stellar", amount: "3" });
    await requests.closePayBox("usr_1");

    await expect(requests.payBox("usr_1")).resolves.toMatchObject({
      open: false,
      assetSymbol: "XLM",
      amount: "3",
    });
    await requests.setPayBox("usr_1", { assetId: "asset_xlm_stellar", amount: "4" });
    await expect(requests.payBox("usr_1")).resolves.toMatchObject({ open: true, amount: "4" });
    expect(await database.request.count({ where: { payBox: true } })).toBe(1);
  });

  it("keeps one pay box when two saves arrive together", async () => {
    const { requests } = services();

    await Promise.all([
      requests.setPayBox("usr_1", { assetId: "asset_usdc_stellar" }),
      requests.setPayBox("usr_1", { assetId: "asset_xlm_stellar", amount: "1" }),
    ]);

    expect(await database.request.count({ where: { payBox: true } })).toBe(1);
  });

  it("refuses a minimum beside a fixed amount", async () => {
    await expect(
      services().requests.setPayBox("usr_1", {
        assetId: "asset_usdc_stellar",
        amount: "10",
        minimumAmount: "5",
      }),
    ).rejects.toThrow(InvalidMinimumError);
  });

  it("is not one of the receiver's listed requests", async () => {
    const { requests } = services();
    await requests.setPayBox("usr_1", { assetId: "asset_usdc_stellar" });

    await expect(requests.listRequests("usr_1")).resolves.toEqual([]);
  });
});

describe("handle pages", () => {
  async function withHandle(handle: string) {
    await database.user.update({
      where: { id: "usr_1" },
      data: { handle, displayName: "Ada Lovelace" },
    });
  }

  it("shows the receiver's name, open pay box and listed open requests only", async () => {
    await withHandle("ada");
    const { requests } = services();
    await requests.setPayBox("usr_1", { assetId: "asset_usdc_stellar", minimumAmount: "1" });
    const listed = await requests.createRequest("usr_1", {
      amount: "5",
      assetId: "asset_xlm_stellar",
      listed: true,
    });
    await requests.createRequest("usr_1", { amount: "6", assetId: "asset_xlm_stellar" });
    const closed = await requests.createRequest("usr_1", {
      amount: "7",
      assetId: "asset_xlm_stellar",
      listed: true,
    });
    await requests.closeRequest("usr_1", closed.id);

    const page = await requests.handlePage("Ada");

    expect(page.handle).toBe("ada");
    expect(page.displayName).toBe("Ada Lovelace");
    expect(page.payBox).toMatchObject({ kind: "REUSABLE", amount: null, minimumAmount: "1" });
    expect(page.listedRequests.map((request) => request.id)).toEqual([listed.id]);
    expect(JSON.stringify(page)).not.toContain("receiver@example.com");
  });

  it("shows no pay box once it is closed", async () => {
    await withHandle("ada");
    const { requests } = services();
    await requests.setPayBox("usr_1", { assetId: "asset_usdc_stellar" });
    await requests.closePayBox("usr_1");

    await expect(requests.handlePage("ada")).resolves.toMatchObject({ payBox: null });
  });

  it("has no page for a handle nobody holds", async () => {
    await expect(services().requests.handlePage("nobody")).rejects.toThrow(ProfileNotFoundError);
  });
});
