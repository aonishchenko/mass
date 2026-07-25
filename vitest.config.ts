import { defineConfig } from "vitest/config";

// Core is pure TypeScript with no Workers runtime dependency, so it runs on the
// plain node pool. DO integration tests move to @cloudflare/vitest-pool-workers
// once src/session-do.ts lands.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
