# Struxis Debugger

Struxis Debugger is an independent Tauri desktop application for inspecting and replaying Nautilus / Strategy / Struxis market-structure processing. It owns its application state, IPC, Replay Worker lifecycle, Snapshot storage, and Vue frontend. It does not depend on `capitus-terminal` or `capitus-node`.

## Prerequisites

- Rust toolchain compatible with the workspace.
- Bun 1.4.3.
- Tauri 2 system dependencies and Tauri CLI 2.x.

## Development

Install frontend dependencies:

```bash
cd crates/struxis-debugger/frontend
bun install --frozen-lockfile
```

Start the frontend:

```bash
cd crates/struxis-debugger
bun run dev
```

In another terminal:

```bash
cd crates/struxis-debugger
cargo tauri dev
```

Vite uses port 1421, separate from Terminal's port 1420. The crate-level package scripts forward to `frontend/package.json`.

## Validation

From the repository root:

```bash
cargo check -p capitus-struxis-debugger
cargo test -p capitus-struxis-debugger
```

From `crates/struxis-debugger`:

```bash
bun run check
bun run test:e2e
bun run test:e2e:desktop
```

`check` runs Vitest, type checking, and the frontend build. Browser E2E and Tauri desktop E2E are separate scopes. Record actual local command results.

## Architecture

[Struxis Debugger architecture](../../docs/architecture/struxis/debugger.md) is the single maintained architecture document and describes the current implementation. When it conflicts with source, current source wins.

The [frozen UI prototype](../../docs/architecture/struxis/debugger/struxis-debugger-ui-prototype.html) is retained only as a visual reference, not as the authority for current component structure or implemented behavior.

For UI diagnostics, right-click in the Debugger window and choose **复制文档 HTML** to copy the current rendered document markup. The copied HTML excludes the context menu itself.
