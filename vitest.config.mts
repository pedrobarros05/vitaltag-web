import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Unit / component tests (Vitest + Testing Library). E2E tests live in tests/e2e and run with
// Playwright; the mock's own tests (mock-api/*.test.mjs) run with `node --test`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/unit/setup.ts"],
    // userEvent-driven form tests take ~1-2 s; leave headroom for slow CI machines
    testTimeout: 15_000,
    // Fresh vi.fn() state for every test (call history + queued return values)
    mockReset: true,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
});
