import { defineConfig, devices } from "@playwright/test";

// Each run looks like its own client (TEST-NET-3 address) so the API's per-IP rate limits never mix runs with each other or with you.
const RUN_IP = (process.env.E2E_CLIENT_IP ??= `203.0.113.${1 + Math.floor(Math.random() * 254)}`);

/**
 * Browser end-to-end tests against the real stack: this web app + the API (`pnpm dev` in ../mgr_backend, with its database).
 * One throwaway user is signed up per run (global-setup) and deleted at the end (global-teardown).
 *   npm run e2e            (starts the web dev server if it isn't running; the API must already be up)
 *   E2E_BASE_URL=… npm run e2e   to point at another deployment
 */
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // the API limits sign-ups per IP; one worker keeps the suite well under it
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", storageState: "e2e/.auth/state.json", extraHTTPHeaders: { "x-forwarded-for": RUN_IP }, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm run dev", url: "http://localhost:3000/login", reuseExistingServer: true, timeout: 120_000 },
});
