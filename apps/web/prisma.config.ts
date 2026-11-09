import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

const envFile = new URL(".env", import.meta.url);

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
