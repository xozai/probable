import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    env: {
      AUTH_ALLOWED_EMAILS: "demo.engineer@example.test",
      AUTH_SECRET: "probable-playwright-secret-at-least-32-characters",
      AUTH_TEST_MODE: "true",
      AUTH_URL: "http://127.0.0.1:3000",
      NEXTAUTH_URL: "http://127.0.0.1:3000",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
