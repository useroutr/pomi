import { existsSync } from "node:fs";

// Database tests read DATABASE_URL. CI sets it; locally it comes from
// apps/web/.env, which Vitest does not load on its own. A variable already set
// is left as it is.
const envFile = new URL("../../.env", import.meta.url);

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
