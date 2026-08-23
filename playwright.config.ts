import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const useLocalServer = !process.env.E2E_BASE_URL;
const authenticatedRun = Boolean(process.env.E2E_USERNAME && process.env.E2E_PASSWORD);
if (process.env.E2E_REQUIRE_AUTH === "1" && !authenticatedRun) {
  throw new Error("E2E_USERNAME and E2E_PASSWORD are required for production validation.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: authenticatedRun ? 1 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer:
    useLocalServer && !process.env.PLAYWRIGHT_MANAGED_SERVER
      ? {
          command: "node scripts/serve-pages.mjs",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        }
      : undefined,
});
