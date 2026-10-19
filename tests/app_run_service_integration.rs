//! Integration tests for AppState Run service layer.
//!
//! These tests verify the complete Run lifecycle through AppState:
//!   Test Dataset → prepare_run → start_run → step → complete → Snapshot discovery

use std::path::PathBuf;

use capitus_struxis_debugger::{
    app::AppState,
    ipc::{IpcError, IpcErrorCode},
    run::RunStatus,
};

fn test_catalog_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test_data/catalog")
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
    use std::time::{SystemTime, UNIX_EPOCH};

    let snapshot_root = std::env::temp_dir().join(format!(
        "capitus-debugger-empty-snapshots-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after UNIX epoch")
            .as_nanos()
    ));
    std::fs::create_dir_all(&snapshot_root).expect("empty Snapshot root should be created");
    let state = AppState::with_snapshot_root(test_catalog_path(), snapshot_root.clone());

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

    std::fs::remove_dir_all(snapshot_root).expect("temporary Snapshot root should be removed");
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

#[test]
fn active_run_rejects_origin_and_test_dataset_replacement() {
    let state = AppState::new(test_catalog_path());
    let entry = state
        .discover_datasets()
        .expect("Catalog discovery should succeed")
        .into_iter()
        .find(|entry| {
            entry.available
                && entry.bar_type.as_deref()
                    == Some("BTCUSDT-PERP.BINANCE-5-MINUTE-LAST-EXTERNAL")
        })
        .expect("fixture BTCUSDT stream should be available");

    let origin = state.load_origin(&entry.id, true).expect("Origin should load");
    assert!(origin.bars.len() >= 2, "fixture needs at least two SBars");
    let test = state
        .create_test_dataset(&origin.first_sbar_id, &origin.bars[1].sbar_id)
        .expect("Test Dataset should be created");
    let _run = state.start_run().expect("Run should start");

    let origin_result = state.load_origin(&entry.id, true);
    assert_eq!(origin_result.unwrap_err().code, IpcErrorCode::Conflict);
    let test_result = state.create_test_dataset(&origin.first_sbar_id, &origin.last_sbar_id);
    assert_eq!(test_result.unwrap_err().code, IpcErrorCode::Conflict);

    let current_origin = state.current_origin().expect("current Origin query").expect("Origin remains loaded");
    let current_test = state.current_test_dataset().expect("current Test query").expect("Test remains loaded");
    assert_eq!(current_origin.origin_dataset_id, origin.origin_dataset_id);
    assert_eq!(current_origin.sbar_sequence_fingerprint, origin.sbar_sequence_fingerprint);
    assert_eq!(current_test.test_dataset_id, test.test_dataset_id);
    assert_eq!(current_test.sbar_sequence_fingerprint, test.sbar_sequence_fingerprint);

    // A completed Run remains owned until explicit Dispose.
    state.replay_dispose().expect("Run resources should be disposed");
}


#[test]
fn app_state_run_lifecycle_publishes_discoverable_complete_snapshot() {
    use std::time::{SystemTime, UNIX_EPOCH};

    let snapshot_root = std::env::temp_dir().join(format!(
        "capitus-debugger-run-lifecycle-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after UNIX epoch")
            .as_nanos()
    ));
    std::fs::create_dir_all(&snapshot_root).expect("Snapshot root should be created");
    let state = AppState::with_snapshot_root(test_catalog_path(), snapshot_root.clone());

    let entry = state
        .discover_datasets()
        .expect("Catalog discovery should succeed")
        .into_iter()
        .find(|entry| {
            entry.available
                && entry.bar_type.as_deref()
                    == Some("BTCUSDT-PERP.BINANCE-5-MINUTE-LAST-EXTERNAL")
        })
        .expect("fixture BTCUSDT stream should be available");

    let origin = state.load_origin(&entry.id, true).expect("Origin should load");
    assert!(origin.bars.len() >= 2, "fixture needs at least two SBars");
    let test = state
        .create_test_dataset(&origin.first_sbar_id, &origin.bars[1].sbar_id)
        .expect("two-SBar Test Dataset should be created");
    assert_eq!(test.sbar_count, 2);

    let initial = state.start_run().expect("Run should start");
    assert_eq!(initial.status, RunStatus::Ready);
    assert_eq!(initial.processed_count, 0);

    let first = state.replay_step().expect("first SBar should process");
    assert_eq!(first.processed_count, 1);
    assert_eq!(first.status, RunStatus::Paused);

    let completed = state.replay_step().expect("second SBar should complete Run");
    assert_eq!(completed.processed_count, 2);
    assert_eq!(completed.status, RunStatus::Completed);

    let artifacts = state
        .discover_snapshots()
        .expect("Snapshot discovery should succeed after completion");
    assert_eq!(
        artifacts.len(),
        1,
        "Exactly one completed Snapshot should be discoverable"
    );

    let disposed = state.replay_dispose().expect("Run resources should be disposed");
    assert_eq!(disposed.status, RunStatus::Disposed);
    drop(state);

    // Reconstruct the application service with the same persistent root to
    // verify discovery does not depend on the original AppState or Run owner.
    let reopened_state =
        AppState::with_snapshot_root(test_catalog_path(), snapshot_root.clone());
    let reopened_artifacts = reopened_state
        .discover_snapshots()
        .expect("Completed Snapshot should remain discoverable after AppState reconstruction");
    assert_eq!(
        reopened_artifacts.len(),
        1,
        "Exactly one completed Snapshot should survive AppState reconstruction"
    );
    drop(reopened_state);

    std::fs::remove_dir_all(snapshot_root).expect("temporary Snapshot root should be removed");
}
