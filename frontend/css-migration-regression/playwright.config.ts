import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const regressionDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(regressionDir, "..");
const regressionPort = Number(process.env.CSS_REGRESSION_PORT ?? "1421");
const baseURL = `http://127.0.0.1:${regressionPort}`;

export default defineConfig({
  testDir: regressionDir,
  testMatch: "**/*.spec.ts",
  outputDir: resolve(regressionDir, "artifacts/test-results"),
  snapshotPathTemplate: "{testDir}/baseline/{arg}{ext}",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: resolve(regressionDir, "artifacts/report"), open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    locale: "en-US",
    timezoneId: "UTC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "css-regression-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } }],
  webServer: {
    command: `bun run dev --port ${regressionPort}`,
    cwd: frontendDir,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
