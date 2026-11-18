-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID');

-- AlterEnum
ALTER TYPE "EmailKind" ADD VALUE 'REFUND_DESTINATION_REQUIRED';

-- AlterTable
ALTER TABLE "outbox_emails" ADD COLUMN     "refund_id" TEXT,
ALTER COLUMN "request_payment_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "request_intents" ADD COLUMN     "client_key" TEXT,
ADD COLUMN     "visitor_id" TEXT;

-- CreateTable
CREATE TABLE "outbox_pushes" (
    "id" TEXT NOT NULL,
    "request_payment_id" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claimed_until" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_pushes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "push_token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbox_pushes_request_payment_id_key" ON "outbox_pushes"("request_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_push_token_key" ON "devices"("push_token");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_emails_kind_refund_id_key" ON "outbox_emails"("kind", "refund_id");

-- CreateIndex
CREATE INDEX "request_intents_visitor_id_created_at_idx" ON "request_intents"("visitor_id", "created_at");

-- CreateIndex
CREATE INDEX "request_intents_client_key_created_at_idx" ON "request_intents"("client_key", "created_at");

-- AddForeignKey
ALTER TABLE "outbox_emails" ADD CONSTRAINT "outbox_emails_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_pushes" ADD CONSTRAINT "outbox_pushes_request_payment_id_fkey" FOREIGN KEY ("request_payment_id") REFERENCES "request_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Constraints Prisma's schema cannot express; schema.prisma names each one.

ALTER TABLE "users" ADD CONSTRAINT "users_display_name_length"
  CHECK ("display_name" IS NULL OR char_length("display_name") BETWEEN 1 AND 50);

-- Compared with the existing value only: Postgres refuses a value added by
-- ALTER TYPE in the transaction that added it.
ALTER TABLE "outbox_emails" ADD CONSTRAINT "outbox_emails_subject_matches_kind" CHECK (
  ("kind" = 'PAYMENT_RECEIVED' AND "request_payment_id" IS NOT NULL AND "refund_id" IS NULL)
  OR ("kind" <> 'PAYMENT_RECEIVED' AND "refund_id" IS NOT NULL AND "request_payment_id" IS NULL)
);

CREATE INDEX "outbox_pushes_unsent" ON "outbox_pushes"("created_at") WHERE "sent_at" IS NULL;
