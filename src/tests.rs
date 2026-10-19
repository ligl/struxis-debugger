//! Regression tests for the standalone Struxis Debugger binary.
//!
//! These tests live inside the binary crate because the Debugger does not expose
//! a public Rust library API. The former integration-test files are compiled as
//! child modules so they can exercise private application modules directly.

#[path = "tests/app_run_service_integration.rs"]
mod app_run_service_integration;
#[path = "tests/snapshot_compare_integration.rs"]
mod snapshot_compare_integration;
#[path = "tests/snapshot_process_restart.rs"]
mod snapshot_process_restart;
#[path = "tests/snapshot_writer_integration.rs"]
mod snapshot_writer_integration;
#[path = "tests/streaming_step_contract.rs"]
mod streaming_step_contract;
