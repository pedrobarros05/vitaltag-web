// Ports/URLs of the servers Playwright starts for the E2E run (see playwright.config.ts).
// Override with E2E_WEB_PORT / E2E_API_PORT if the defaults are taken on your machine.
export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3100);
export const API_PORT = Number(process.env.E2E_API_PORT ?? 8090);
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const API_URL = `http://localhost:${API_PORT}`;
