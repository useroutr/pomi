import { createDatabase, type Database } from "@/server/database";

export function testDatabase(): Database {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error(
      "DATABASE_URL is not set: start Postgres (docker compose up -d) and migrate (pnpm db:migrate)",
    );
  }
  return createDatabase(databaseUrl);
}

export async function emptyTables(database: Database) {
  await database.$executeRaw`TRUNCATE "users", "payout_addresses", "requests", "request_intents", "request_payments", "outbox_emails", "refunds", "webhook_events", "sign_in_codes", "sessions" CASCADE`;
}

export const RECEIVER_ACCOUNT = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
export const OTHER_ACCOUNT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
