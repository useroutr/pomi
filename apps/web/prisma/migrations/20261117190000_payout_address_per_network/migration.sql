-- A receiver keeps one active payout address per network: their Stellar
-- account, and an address on each other network Useroutr pays out to.
-- Every existing address is a Stellar account.
ALTER TABLE "payout_addresses" ADD COLUMN "network" TEXT NOT NULL DEFAULT 'stellar';

ALTER TABLE "payout_addresses" ADD CONSTRAINT "payout_addresses_network_id"
  CHECK ("network" ~ '^[a-z0-9-]+$');

ALTER TABLE "payout_addresses" DROP CONSTRAINT "payout_addresses_stellar_account";
ALTER TABLE "payout_addresses" ADD CONSTRAINT "payout_addresses_address_format" CHECK (
  ("network" = 'stellar' AND "address" ~ '^G[A-Z2-7]{55}$')
  OR ("network" <> 'stellar' AND "address" ~ '^0x[0-9a-fA-F]{40}$')
);

-- One address receives per network at a time; earlier ones are kept, inactive.
DROP INDEX "payout_addresses_one_active_per_user";
CREATE UNIQUE INDEX "payout_addresses_one_active_per_network"
  ON "payout_addresses"("user_id", "network") WHERE "active";
