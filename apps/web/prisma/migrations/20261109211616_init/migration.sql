-- CreateEnum
CREATE TYPE "RequestKind" AS ENUM ('SINGLE', 'REUSABLE');

-- CreateEnum
CREATE TYPE "AmountKind" AS ENUM ('FIXED', 'OPEN');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'PAID', 'CLOSED');

-- CreateEnum
CREATE TYPE "IntentState" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "handle" TEXT,
    "display_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "RequestKind" NOT NULL,
    "amount_kind" "AmountKind" NOT NULL,
    "amount" DECIMAL(19,7),
    "minimum_amount" DECIMAL(19,7),
    "asset_id" TEXT NOT NULL,
    "note" TEXT,
    "listed" BOOLEAN NOT NULL DEFAULT false,
    "pay_box" BOOLEAN NOT NULL DEFAULT false,
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_intents" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "funding_intent_id" TEXT NOT NULL,
    "funding_token" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "amount" DECIMAL(19,7) NOT NULL,
    "exclusive" BOOLEAN NOT NULL,
    "state" "IntentState" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "request_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_payments" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "funding_intent_id" TEXT NOT NULL,
    "amount" DECIMAL(19,7) NOT NULL,
    "asset_id" TEXT NOT NULL,
    "credited_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "funding_intent_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "destination_required_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");

-- CreateIndex
CREATE INDEX "payout_addresses_user_id_idx" ON "payout_addresses"("user_id");

-- CreateIndex
CREATE INDEX "requests_user_id_status_idx" ON "requests"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "request_intents_funding_intent_id_key" ON "request_intents"("funding_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "request_intents_request_id_visit_id_key" ON "request_intents"("request_id", "visit_id");

-- CreateIndex
CREATE UNIQUE INDEX "request_payments_funding_intent_id_key" ON "request_payments"("funding_intent_id");

-- CreateIndex
CREATE INDEX "request_payments_request_id_idx" ON "request_payments"("request_id");

-- CreateIndex
CREATE INDEX "refunds_funding_intent_id_idx" ON "refunds"("funding_intent_id");

-- AddForeignKey
ALTER TABLE "payout_addresses" ADD CONSTRAINT "payout_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_intents" ADD CONSTRAINT "request_intents_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_payments" ADD CONSTRAINT "request_payments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Constraints Prisma's schema cannot express; schema.prisma names each one.

-- The handle format parseHandle enforces in packages/shared.
ALTER TABLE "users" ADD CONSTRAINT "users_handle_format"
  CHECK ("handle" ~ '^[a-z][a-z0-9-]{1,28}[a-z0-9]$' AND strpos("handle", '--') = 0);

-- Emails are stored lowercase, so one address cannot hold two accounts by case.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));

-- A Stellar account address: G and 55 base32 characters. Useroutr pays a classic account.
ALTER TABLE "payout_addresses" ADD CONSTRAINT "payout_addresses_stellar_account"
  CHECK ("address" ~ '^G[A-Z2-7]{55}$');

-- One address receives at a time; earlier ones are kept, inactive.
CREATE UNIQUE INDEX "payout_addresses_one_active_per_user"
  ON "payout_addresses"("user_id") WHERE "active";

ALTER TABLE "requests" ADD CONSTRAINT "requests_amount_matches_kind" CHECK (
  ("amount_kind" = 'FIXED' AND "amount" IS NOT NULL AND "minimum_amount" IS NULL)
  OR ("amount_kind" = 'OPEN' AND "amount" IS NULL)
);

ALTER TABLE "requests" ADD CONSTRAINT "requests_amounts_positive" CHECK (
  ("amount" IS NULL OR "amount" > 0) AND ("minimum_amount" IS NULL OR "minimum_amount" > 0)
);

-- An invoice is for one known amount.
ALTER TABLE "requests" ADD CONSTRAINT "requests_single_is_fixed"
  CHECK ("kind" <> 'SINGLE' OR "amount_kind" = 'FIXED');

ALTER TABLE "requests" ADD CONSTRAINT "requests_pay_box_is_reusable"
  CHECK (NOT "pay_box" OR "kind" = 'REUSABLE');

ALTER TABLE "requests" ADD CONSTRAINT "requests_note_length"
  CHECK ("note" IS NULL OR char_length("note") <= 280);

CREATE UNIQUE INDEX "requests_one_pay_box_per_user" ON "requests"("user_id") WHERE "pay_box";

-- Every visitor to a single-use request shares one open funding intent, so two
-- visitors arriving together cannot start two checkouts for one invoice.
CREATE UNIQUE INDEX "request_intents_one_open_exclusive"
  ON "request_intents"("request_id") WHERE "exclusive" AND "state" = 'OPEN';

ALTER TABLE "request_intents" ADD CONSTRAINT "request_intents_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "request_payments" ADD CONSTRAINT "request_payments_amount_positive" CHECK ("amount" > 0);
