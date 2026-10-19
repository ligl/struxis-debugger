# Struxis Debugger — Native Desktop E2E

This harness tests the real Tauri application and WebKitGTK WebView. It is separate from the Playwright suite, which runs the Vue frontend in Chromium.

## Prerequisites

- Bun 1.4.3 and Node.js 18.20 or later.
- Rust toolchain and Tauri CLI 2.x (`cargo tauri --version`).
- Ubuntu WebKitWebDriver:

  ```bash
  sudo apt-get install webkit2gtk-driver
  ```

- The repository's configured test Catalog at `test_data/catalog`.

The harness uses WebdriverIO with `@wdio/tauri-service` and the external driver provider. It does not add a testing plugin to the production Tauri app. The service may install `tauri-driver` through Cargo on the first run.

The initial smoke suite uses only standard WebDriver DOM operations. Before testing, it explicitly selects the already-open main window once; this disables the service's automatic focus-recovery hook, which otherwise queries window state through the optional `@wdio/tauri-plugin` on each element lookup. The warning about the missing plugin is expected when using basic WebDriver operations without that plugin; the suite must not rely on plugin-only APIs.

## Run

From `crates/struxis-debugger`:

```bash
bun run test:e2e:desktop
```

The root command automatically runs `bun install` inside `desktop-e2e/` and verifies that the project-local `node_modules/.bin/wdio` exists, then builds the Tauri binary with `cargo tauri build --debug --no-bundle`, runs WebdriverIO, and verifies that the test-launched application process exits. You do not need to install WebdriverIO globally or install its dependencies manually. Close any existing instance of the same Debugger binary before running it.

The WDIO capability forces classic WebDriver mode via `wdio:enforceWebDriverClassic: true`. Ubuntu 24.04's WebKitWebDriver / tauri-driver combination can reject WDIO 9's automatically negotiated BiDi session; that failure may surface later as repeated `invalid session id` errors. Global WDIO logging is set to `warn` so routine commands do not dump large injected scripts to the terminal.

## Initial acceptance scope

- Start and locate the actual Tauri window.
- Verify that startup Catalog discovery completes through the real `list_catalog_datasets` IPC command and renders either dataset rows or the valid empty state; an IPC error fails the test.
- Switch between Test & Replay and Snapshot Inventory in the real window.
- Collapse and restore Catalog, Inspector, and Diagnostics; check that the workbench remains inside the viewport without horizontal document overflow.
- Inject temporary oversized content into the real workspace scroll container and verify that scrolling advances that container's `scrollTop`; remove the fixture even if the assertion fails.
- Resize the native window to 1280×800 and 1920×1080, check viewport geometry and horizontal overflow, then restore the original window size.
- Confirm that WebdriverIO teardown leaves no process from this test run.

This remains an incremental desktop suite, not full desktop acceptance. The user reran `bun run test:e2e:desktop` after adding the collapse/restore and scroll-container checks; the spec passed and the test-launched native Debugger process exited successfully. Native window resizing has now been added to the suite but awaits local execution. Space-key focus rules, IPC failure paths, and the complete Load → Run → Snapshot workflow remain future coverage.
