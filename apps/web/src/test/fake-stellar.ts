import {
  type StellarAccountReader,
  type StellarAccountState,
} from "@/server/stellar/horizon-account-reader";

export class FakeStellar implements StellarAccountReader {
  readonly accounts = new Map<string, StellarAccountState>();
  reads = 0;

  readAccount(address: string): Promise<StellarAccountState | null> {
    this.reads += 1;
    return Promise.resolve(this.accounts.get(address) ?? null);
  }
}
