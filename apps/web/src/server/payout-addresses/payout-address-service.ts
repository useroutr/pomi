import "server-only";
import { parseStellarAccount, shortenStellarAccount } from "@pomi/shared";
import { type StellarNetwork } from "../config";
import { type Database } from "../database";
import { newId } from "../ids";
import { type StellarAccountReader } from "../stellar/horizon-account-reader";
import { type StellarAsset } from "../useroutr/useroutr-gateway";
import {
  PayoutAccountMissingError,
  PayoutAccountNeedsMemoError,
  PayoutAssetNotTrustedError,
} from "./payout-address-errors";
import {
  activePayoutAddress,
  deactivatePayoutAddresses,
  insertActivePayoutAddress,
  lockPayoutAddresses,
} from "./payout-address-repository";

export interface PayoutAddress {
  id: string;
  address: string;
  verified: boolean;
}

export interface PayoutAddressServiceDependencies {
  database: Database;
  accountReader: StellarAccountReader;
  network: StellarNetwork;
  now?: () => Date;
}

export type PayoutAddressService = ReturnType<typeof createPayoutAddressService>;

export function createPayoutAddressService({
  database,
  accountReader,
  network,
  now = () => new Date(),
}: PayoutAddressServiceDependencies) {
  async function payoutAddress(userId: string): Promise<PayoutAddress | null> {
    const active = await activePayoutAddress(database, userId);
    return active === null ? null : toPayoutAddress(active);
  }

  // Useroutr refuses a missing account or trustline itself, but only when a
  // payer opens the link. Checking here spares the receiver a broken request.
  // Whether the account trusts an asset is checked when a request for that
  // asset is created, since the receiver may ask for several.
  async function setPayoutAddress(userId: string, input: string): Promise<PayoutAddress> {
    const address = parseStellarAccount(input);
    const account = await accountReader.readAccount(address);
    if (account === null) {
      throw new PayoutAccountMissingError(network);
    }
    if (account.memoRequired) {
      throw new PayoutAccountNeedsMemoError();
    }
    const saved = await database.$transaction(async (transaction) => {
      await lockPayoutAddresses(transaction, userId);
      const current = await activePayoutAddress(transaction, userId);
      if (current?.address === address) {
        return current;
      }
      await deactivatePayoutAddresses(transaction, userId);
      return insertActivePayoutAddress(transaction, {
        id: newId("addr"),
        userId,
        address,
        createdAt: now(),
      });
    });
    return toPayoutAddress(saved);
  }

  // Read again at the moment of use: the receiver may have changed the
  // account in their wallet since it was saved.
  async function assertCanReceive(address: string, asset: StellarAsset): Promise<void> {
    const account = await accountReader.readAccount(address);
    if (account === null) {
      throw new PayoutAccountMissingError(network);
    }
    if (account.memoRequired) {
      throw new PayoutAccountNeedsMemoError();
    }
    if (asset.issuer === null) {
      return;
    }
    const issuer = asset.issuer;
    const trusted = account.trustlines.some(
      (trustline) =>
        trustline.code === asset.code && trustline.issuer === issuer && trustline.authorized,
    );
    if (!trusted) {
      throw new PayoutAssetNotTrustedError(asset.symbol, shortenStellarAccount(issuer));
    }
  }

  return { payoutAddress, setPayoutAddress, assertCanReceive };
}

function toPayoutAddress(row: { id: string; address: string; verifiedAt: Date | null }) {
  return { id: row.id, address: row.address, verified: row.verifiedAt !== null };
}
