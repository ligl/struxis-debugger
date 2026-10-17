# Struxis Debugger

Struxis Debugger is an independent engineering application for developing, replaying, debugging, and verifying Struxis market-structure behavior. It is not a Terminal page, mode, workspace, or sub-application.

The application directly composes Nautilus and Struxis. Its own Tauri runtime owns the replay session lifecycle, IPC commands, and read-only snapshot DTOs. It does not depend on `capitus-terminal` or `capitus-node`.

## Prerequisites

- Rust toolchain compatible with the workspace.
- Bun 1.4.3.
- Tauri 2 system dependencies and Tauri CLI 2.x.

## Development

Install the frontend dependencies once, from the frontend directory:

```bash
cd crates/struxis-debugger/frontend
bun install --frozen-lockfile
```

Then use the Debugger directory as the Bun command entrypoint:

```bash
cd crates/struxis-debugger
bun run dev
```

In a separate terminal, start the Tauri application from the same Debugger directory:

```bash
cargo tauri dev
```

The Vite development server uses port 1421, separate from Terminal's port 1420. The root-level `package.json` forwards frontend scripts to `frontend/package.json`; the frontend remains the sole owner of frontend dependencies and script implementations.

## Validation

From the repository root:

```bash
cargo check -p capitus-struxis-debugger
cargo test -p capitus-struxis-debugger
cd crates/struxis-debugger
bun run check
```

The same root-level entrypoint also supports `bun run test`, `bun run typecheck`, `bun run build`, and `bun run test:watch`.

For UI diagnostics, right-click anywhere in the Debugger window and choose **复制文档 HTML** to copy the current rendered document markup to the clipboard. The copied HTML excludes the context menu itself; paste it into a support conversation when reporting a UI issue.

## Architecture

The [Struxis Debugger system design](../../docs/architecture/struxis/debugger.md) is the single design entry point, with linked topic documents covering workspace, data contracts, replay lifecycle, snapshots, comparison, and validation. The current implementation is a disposable prototype; after the design set is completed and approved, the existing Debugger implementation will be removed and rebuilt against these documents. Application lifecycle, UI composition, state, IPC, and release decisions remain independent from Terminal.
