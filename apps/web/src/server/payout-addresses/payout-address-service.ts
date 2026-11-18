import "server-only";
import {
  type AddressKind,
  parseAddress,
  parseStellarAccount,
  shortenStellarAccount,
} from "@pomi/shared";
import { type StellarNetwork } from "../config";
import { type Database } from "../database";
import { newId } from "../ids";
import {
  type StellarAccountReader,
  type StellarAccountState,
} from "../stellar/horizon-account-reader";
import { type CatalogAsset } from "../useroutr/useroutr-gateway";
import {
  PayoutAccountMissingError,
  PayoutAccountNeedsMemoError,
  PayoutAddressRequiredError,
  PayoutAssetNotTrustedError,
} from "./payout-address-errors";
import {
  activePayoutAddress,
  activePayoutAddresses,
  deactivatePayoutAddress,
  insertActivePayoutAddress,
  lockPayoutAddresses,
} from "./payout-address-repository";

export interface PayoutAddress {
  id: string;
  // Useroutr's network id: "stellar", "base" and so on.
  network: string;
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
  async function payoutAddress(
    userId: string,
    onNetwork = "stellar",
  ): Promise<PayoutAddress | null> {
    const active = await activePayoutAddress(database, userId, onNetwork);
    return active === null ? null : toPayoutAddress(active);
  }

  async function payoutAddresses(userId: string): Promise<PayoutAddress[]> {
    return (await activePayoutAddresses(database, userId)).map(toPayoutAddress);
  }

  // The address is checked the way its network needs before it is saved.
  // A Stellar account must exist and take payments without a memo: Useroutr
  // refuses either itself, but only when a payer opens the link, and checking
  // here spares the receiver a broken request. Whether it trusts an asset is
  // checked when a request for that asset is created. Any other address is
  // checked for its form and, where its network writes one, its checksum
  // (EVM in mixed case, Tron); there is no account to read.
  async function setPayoutAddress(
    userId: string,
    input: string,
    target: { network: string; addressKind: AddressKind },
  ): Promise<PayoutAddress> {
    const address =
      target.addressKind === "stellar"
        ? await checkedStellarAccount(input)
        : parseAddress(target.addressKind, input);
    const saved = await database.$transaction(async (transaction) => {
      await lockPayoutAddresses(transaction, userId);
      const current = await activePayoutAddress(transaction, userId, target.network);
      if (current?.address === address) {
        return current;
      }
      await deactivatePayoutAddress(transaction, userId, target.network);
      return insertActivePayoutAddress(transaction, {
        id: newId("addr"),
        userId,
        network: target.network,
        address,
        createdAt: now(),
      });
    });
    return toPayoutAddress(saved);
  }

  async function checkedStellarAccount(input: string): Promise<string> {
    const address = parseStellarAccount(input);
    const account = await accountReader.readAccount(address);
    if (account === null) {
      throw new PayoutAccountMissingError(network);
    }
    if (account.memoRequired) {
      throw new PayoutAccountNeedsMemoError();
    }
    return address;
  }

  // Read again at the moment of use: the receiver may have changed the
  // account in their wallet since it was saved. Only a Stellar account can
  // be checked this way.
  async function assertCanReceive(address: string, asset: CatalogAsset): Promise<void> {
    if (asset.stellar === null) {
      return;
    }
    const problem = receivingProblem(await accountReader.readAccount(address), asset, network);
    if (problem !== null) {
      throw problem;
    }
  }

  // What the app shows before the receiver asks for anything: for each
  // asset, whether a request for it would be accepted, and if not, why.
  // The same rule as request creation, with one read of the Stellar account.
  async function readiness(userId: string, assets: CatalogAsset[]): Promise<PayoutReadiness> {
    const addresses = (await activePayoutAddresses(database, userId)).map(toPayoutAddress);
    const byNetwork = new Map(addresses.map((address) => [address.network, address]));
    const stellarAddress = byNetwork.get("stellar");
    const account =
      stellarAddress === undefined ? null : await accountReader.readAccount(stellarAddress.address);
    return {
      payoutAddress: stellarAddress ?? null,
      payoutAddresses: addresses,
      assets: assets.map((asset) => {
        const problem =
          byNetwork.get(asset.network) === undefined
            ? new PayoutAddressRequiredError(asset.network)
            : asset.stellar === null
              ? null
              : receivingProblem(account, asset, network);
        return {
          id: asset.id,
          symbol: asset.symbol,
          network: asset.network,
          ready: problem === null,
          problem: problem?.message ?? null,
        };
      }),
    };
  }

  return { payoutAddress, payoutAddresses, setPayoutAddress, assertCanReceive, readiness };
}

export interface PayoutReadiness {
  // The Stellar address, for clients that predate other networks.
  payoutAddress: PayoutAddress | null;
  payoutAddresses: PayoutAddress[];
  assets: {
    id: string;
    symbol: string;
    network: string;
    ready: boolean;
    problem: string | null;
  }[];
}

function receivingProblem(
  account: StellarAccountState | null,
  asset: CatalogAsset,
  network: StellarNetwork,
): Error | null {
  if (account === null) {
    return new PayoutAccountMissingError(network);
  }
  if (account.memoRequired) {
    return new PayoutAccountNeedsMemoError();
  }
  const issuer = asset.stellar?.issuer ?? null;
  const code = asset.stellar?.code;
  if (issuer === null) {
    return null;
  }
  const trusted = account.trustlines.some(
    (trustline) => trustline.code === code && trustline.issuer === issuer && trustline.authorized,
  );
  return trusted
    ? null
    : new PayoutAssetNotTrustedError(asset.symbol, shortenStellarAccount(issuer));
}

function toPayoutAddress(row: {
  id: string;
  network: string;
  address: string;
  verifiedAt: Date | null;
}): PayoutAddress {
  return {
    id: row.id,
    network: row.network,
    address: row.address,
    verified: row.verifiedAt !== null,
  };
}
