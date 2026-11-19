import { defineConfig, devices } from "@playwright/test";
import { API_PORT, API_URL, WEB_PORT, WEB_URL } from "./tests/e2e/env";

// E2E tests run the real app (production build) against the API mock (mock-api/server.mjs).
// Both servers are started by Playwright on their own ports, so they don't clash with a
// `npm run dev:mock` you may have running on :3000/:8080 (ports: tests/e2e/env.ts).

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  expect: { timeout: 10_000 },
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      // Fresh in-memory data on every run. WEB_URL makes the QR Code point at the test app.
      command: "node mock-api/server.mjs",
      url: `${API_URL}/health`,
      env: { MOCK_PORT: String(API_PORT), WEB_URL, MOCK_DELAY: "0" },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // NEXT_PUBLIC_API_URL is inlined at build time, so build for the mock's port. The build
      // goes to .next-e2e (see distDir in next.config.ts) to leave `next dev`'s .next alone.
      command: `npx next build && npx next start --port ${WEB_PORT}`,
      url: `${WEB_URL}/auth/login`,
      env: {
        NEXT_PUBLIC_API_URL: API_URL,
        NEXT_DIST_DIR: ".next-e2e",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
