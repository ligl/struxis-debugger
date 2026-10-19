import path from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const appBinaryPath = path.resolve(
  configDirectory,
  "../../../target/debug/capitus-struxis-debugger",
);

export const config = {
  runner: "local",
  specs: ["./e2e/**/*.spec.mjs"],
  maxInstances: 1,
  capabilities: [
    {
      browserName: "tauri",
      // Ubuntu 24.04 WebKitWebDriver / tauri-driver does not support WDIO 9's
      // automatically negotiated BiDi session. Force classic WebDriver to avoid
      // session creation followed by repeated `invalid session id` failures.
      "wdio:enforceWebDriverClassic": true,
      "tauri:options": {
        application: appBinaryPath,
      },
    },
  ],
  services: [
    [
      "@wdio/tauri-service",
      {
        appBinaryPath,
        driverProvider: "external",
        autoInstallTauriDriver: true,
      },
    ],
  ],
  framework: "mocha",
  reporters: ["spec"],
  // Keep native-driver failures actionable; INFO logs dump injected scripts on every command.
  logLevel: "warn",
  waitforTimeout: 15_000,
  connectionRetryTimeout: 90_000,
  connectionRetryCount: 0,
  mochaOpts: {
    ui: "bdd",
    timeout: 60_000,
  },
};
