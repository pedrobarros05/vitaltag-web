// `test` for every E2E spec: Playwright's test plus an automatic guard that fails the test if
// the browser logs an error (React hydration mismatches, uncaught exceptions, failed chunks…).
// Such problems often leave the page looking fine, so no regular assertion would catch them.

import { test as base, expect, type ConsoleMessage } from "@playwright/test";
import { API_URL } from "./env";

/**
 * Chromium logs "Failed to load resource: … status of 401" for every non-2xx fetch. The specs
 * trigger those on purpose (wrong password, new user without a profile, duplicate email…),
 * so they're allowed — but only for calls to the API mock, never for the app's own files.
 */
function isExpectedApiError(msg: ConsoleMessage) {
  return (
    msg.text().startsWith("Failed to load resource: the server responded with a status of") &&
    msg.location().url.startsWith(API_URL)
  );
}

export const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && !isExpectedApiError(msg)) {
          problems.push(`console.error: ${msg.text()} (${msg.location().url})`);
        }
      });
      page.on("pageerror", (err) => problems.push(`uncaught: ${err.message}`));

      await use();

      expect(problems, "the browser logged errors during this test").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
