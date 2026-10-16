# Struxis Debugger

Struxis Debugger is an independent engineering application for developing, replaying, debugging, and verifying Struxis market-structure behavior. It is not a Terminal page, mode, workspace, or sub-application.

The application directly composes Nautilus and Struxis. Its own Tauri runtime owns the replay session lifecycle, IPC commands, and read-only snapshot DTOs. It does not depend on `capitus-terminal` or `capitus-node`.

## Prerequisites

- Rust toolchain compatible with the workspace.
- Bun 1.4.3.
- Tauri 2 system dependencies and Tauri CLI 2.x.

## Development

```bash
cd crates/struxis-debugger/frontend
bun install
bun install --frozen-lockfile
cd ..
cargo tauri dev
```

The Vite development server uses port 1421, separate from Terminal's port 1420.

## Validation

From the repository root:

```bash
cargo check -p capitus-struxis-debugger
cargo test -p capitus-struxis-debugger
bun --cwd crates/struxis-debugger/frontend run check
```

## Architecture

The [Struxis Debugger system design](../../docs/architecture/struxis/debugger.md) is the single design entry point, with linked topic documents covering workspace, data contracts, replay lifecycle, snapshots, comparison, and validation. The current implementation is a disposable prototype; after the design set is completed and approved, the existing Debugger implementation will be removed and rebuilt against these documents. Application lifecycle, UI composition, state, IPC, and release decisions remain independent from Terminal.
