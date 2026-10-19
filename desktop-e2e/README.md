# Struxis Debugger — Native Desktop E2E

This harness tests the real Tauri application and WebKitGTK WebView. It is separate from the Playwright suite, which runs the Vue frontend in Chromium.

## Prerequisites

- Bun 1.4.3 and Node.js 18.20 or later.
- Rust toolchain and Tauri CLI 2.x (\`cargo tauri --version\`).
- Ubuntu WebKitWebDriver:

  \`\`\`bash
  sudo apt-get install webkit2gtk-driver
  \`\`\`

- The repository's configured test Catalog at \`test_data/catalog\`.

The harness uses WebdriverIO with \`@wdio/tauri-service\` and the external driver provider. It does not add a testing plugin to the production Tauri app. The service may install \`tauri-driver\` through Cargo on the first run.

## Run

From \`crates/struxis-debugger\`:

\`\`\`bash
cd desktop-e2e
bun install
cd ..
bun run test:e2e:desktop
\`\`\`

The root command builds the Tauri binary with \`cargo tauri build --debug --no-bundle\`, runs WebdriverIO, and verifies that the test-launched application process exits. Close any existing instance of the same Debugger binary before running it.

## Initial acceptance scope

- Start and locate the actual Tauri window.
- Verify that startup Catalog discovery completes through the real \`list_catalog_datasets\` IPC command and renders either dataset rows or the valid empty state; an IPC error fails the test.
- Switch between Test & Replay and Snapshot Inventory in the real window.
- Confirm that WebdriverIO teardown leaves no process from this test run.

This is a feasibility smoke suite, not full desktop acceptance. Window resizing, Space-key focus rules, IPC failure paths, and the complete Load → Run → Snapshot workflow remain future coverage.
