import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // Run sequentially to avoid SQLite test.db concurrency issues
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["html", { open: "never" }],
    ["list"],
  ],
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      // Always start a fresh server for E2E so test env vars are guaranteed active.
      command: "node index.js",
      cwd: "../server",
      url: "http://localhost:4000/api/health",
      reuseExistingServer: false,
      timeout: 30000,
      env: {
        DB_PATH: "./test.db",
        PORT: "4000",
        JWT_SECRET: "test-jwt-secret-key-e2e",
        NODE_ENV: "test",
        // Raise general limit: 48 tests × ~30 API calls = ~1440 req/60s burst
        RATE_LIMIT_GENERAL_MAX: "5000",
        // Auth limit: 20 is too tight for multi-user tests; 100 keeps it meaningful
        RATE_LIMIT_MAX: "100",
        // Extend auth window slightly for the full suite duration
        RATE_LIMIT_WINDOW_MS: "900000",
      },
    },
    {
      command: "npm run dev",
      cwd: ".",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
