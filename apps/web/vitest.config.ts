import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.db.test.ts"],
        },
      },
      {
        // Runs against a migrated Postgres (pnpm test:db), one file at a time
        // because every test starts from empty tables.
        resolve: { alias },
        test: {
          name: "db",
          environment: "node",
          include: ["src/**/*.db.test.ts"],
          setupFiles: ["./src/test/load-env.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
