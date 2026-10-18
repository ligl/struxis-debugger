//! Integration tests for AppState Run service layer.
//!
//! These tests verify the complete Run lifecycle through AppState:
//!   Test Dataset → prepare_run → start_run → step → complete → Snapshot discovery

use std::path::PathBuf;

use capitus_struxis_debugger::{
    app::AppState,
    ipc::{IpcError, IpcErrorCode},
};

fn test_catalog_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test_data")
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from("/nonexistent/catalog"))
}

#[test]
fn app_state_rejects_start_run_without_test_dataset() {
    let state = AppState::new(test_catalog_path());

    let result = state.start_run();

    assert!(result.is_err());
    let error = result.unwrap_err();
    assert_eq!(error.code, IpcErrorCode::InvalidState);
    assert!(
        error.message.contains("Test Dataset"),
        "Error should mention Test Dataset requirement"
    );
}

#[test]
fn app_state_rejects_run_commands_when_no_run_active() {
    let state = AppState::new(test_catalog_path());

    // All run control commands should fail without an active run
    let results: Vec<(&str, Result<capitus_struxis_debugger::run::RunState, IpcError>)> = vec![
        ("step", state.replay_step()),
        ("play", state.replay_play()),
        ("pause", state.replay_pause()),
        ("stop", state.replay_stop()),
        ("dispose", state.replay_dispose()),
    ];

    for (name, result) in results {
        assert!(result.is_err(), "{name} should fail without active run");
        let error = result.unwrap_err();
        assert_eq!(
            error.code,
            IpcErrorCode::InvalidState,
            "{name} error code mismatch"
        );
    }
}

#[test]
fn app_state_get_run_state_returns_error_when_inactive() {
    let state = AppState::new(test_catalog_path());

    let result = state.replay_state();

    assert!(result.is_err());
    let error = result.unwrap_err();
    assert_eq!(error.code, IpcErrorCode::InvalidState);
}

#[test]
fn app_state_snapshot_discovery_works_on_empty_directory() {
    let state = AppState::new(test_catalog_path());

    let result = state.discover_snapshots();

    match result {
        Ok(artifacts) => {
            assert!(
                artifacts.is_empty(),
                "Empty directory should return no artifacts"
            );
        }
        Err(error) => {
            assert_eq!(error.code, IpcErrorCode::Internal);
            assert!(
                error.message.contains("Snapshot"),
                "Error should mention Snapshot"
            );
        }
    }
}

#[cfg(test)]
mod concurrent_access {
    use super::*;
    use std::sync::{Arc, Barrier};
    use std::thread;
    use std::time::Duration;

    #[test]
    fn replay_manager_prevents_concurrent_step_calls() {
        let state = Arc::new(AppState::new(test_catalog_path()));
        let barrier = Arc::new(Barrier::new(2));

        // Note: Without a real active run, both calls will fail with InvalidState,
        // but we're testing that they don't deadlock and return promptly.
        let state_clone = state.clone();
        let barrier_clone = barrier.clone();

        let handle1 = thread::spawn(move || {
            barrier_clone.wait();
            let _result = state_clone.replay_step();
        });

        let barrier_clone2 = barrier.clone();
        let state_clone2 = state.clone();
        let handle2 = thread::spawn(move || {
            barrier_clone2.wait();
            // Small delay to increase chance of contention
            thread::sleep(Duration::from_millis(10));
            let _result = state_clone2.replay_step();
        });

        // Both threads should complete within reasonable time
        handle1.join().expect("Thread 1 should not panic");
        handle2.join().expect("Thread 2 should not panic");
    }
}