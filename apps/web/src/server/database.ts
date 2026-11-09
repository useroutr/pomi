import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export type Database = PrismaClient;

export function createDatabase(databaseUrl: string): Database {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}
