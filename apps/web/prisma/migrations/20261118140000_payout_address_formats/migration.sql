-- Solana, Tron and Starknet write account addresses their own way. Each
-- network named here keeps to its own format; every other network is an EVM
-- chain, and Stellar and EVM addresses are held to the same rule as before.
-- The same table is ownAddressKind in packages/shared/src/address-kinds.ts.
ALTER TABLE "payout_addresses" DROP CONSTRAINT "payout_addresses_address_format";
ALTER TABLE "payout_addresses" ADD CONSTRAINT "payout_addresses_address_format" CHECK (
  ("network" = 'stellar' AND "address" ~ '^G[A-Z2-7]{55}$')
  OR ("network" = 'solana' AND "address" ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$')
  OR ("network" = 'tron' AND "address" ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$')
  OR ("network" = 'starknet' AND "address" ~ '^0x[0-9a-f]{64}$')
  OR (
    "network" NOT IN ('stellar', 'solana', 'tron', 'starknet')
    AND "address" ~ '^0x[0-9a-fA-F]{40}$'
  )
);
