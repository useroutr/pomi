import {
  type StellarAccountReader,
  type StellarAccountState,
} from "@/server/stellar/horizon-account-reader";

export class FakeStellar implements StellarAccountReader {
  readonly accounts = new Map<string, StellarAccountState>();

  readAccount(address: string): Promise<StellarAccountState | null> {
    return Promise.resolve(this.accounts.get(address) ?? null);
  }
}
