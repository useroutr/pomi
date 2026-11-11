-- CreateEnum
CREATE TYPE "EmailKind" AS ENUM ('PAYMENT_RECEIVED');

-- AlterTable
ALTER TABLE "request_intents" ADD COLUMN     "expires_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "visit_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "request_payments" ADD COLUMN     "payment_transaction_hash" TEXT,
ADD COLUMN     "settlement_transaction_hash" TEXT;

-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "payout_address_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "outbox_emails" (
    "id" TEXT NOT NULL,
    "kind" "EmailKind" NOT NULL,
    "request_payment_id" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claimed_until" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbox_emails_kind_request_payment_id_key" ON "outbox_emails"("kind", "request_payment_id");

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_payout_address_id_fkey" FOREIGN KEY ("payout_address_id") REFERENCES "payout_addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_emails" ADD CONSTRAINT "outbox_emails_request_payment_id_fkey" FOREIGN KEY ("request_payment_id") REFERENCES "request_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Constraints Prisma's schema cannot express; schema.prisma names each one.

ALTER TABLE "request_intents" ADD CONSTRAINT "request_intents_visit_matches_kind" CHECK (
  ("exclusive" AND "visit_id" IS NULL) OR (NOT "exclusive" AND "visit_id" IS NOT NULL)
);

CREATE INDEX "outbox_emails_unsent" ON "outbox_emails"("created_at") WHERE "sent_at" IS NULL;
