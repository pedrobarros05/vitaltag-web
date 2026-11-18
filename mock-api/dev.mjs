// Starts the API mock and `next dev` together (works on Windows, macOS and Linux).
// Ctrl+C stops both.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Run the Next binary directly (no npx/shell) so it is stopped together with this process
const nextBin = require.resolve("next/dist/bin/next");

const port = process.env.MOCK_PORT ?? "8080";
const env = {
  ...process.env,
  // Point the frontend at the mock (takes precedence over .env.local). Can be overridden
  // via the environment, e.g. to test from a phone using the machine's IP.
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${port}`,
};

const children = [
  spawn(process.execPath, ["mock-api/server.mjs"], { stdio: "inherit", env }),
  spawn(process.execPath, [nextBin, "dev"], { stdio: "inherit", env }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill();
  process.exit(code);
}

for (const c of children) c.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
