//! Integration tests for production SnapshotWriter with real SQLite persistence.
//!
//! These tests verify the complete recording lifecycle:
//!   initialize → commit_checkpoint(s) → finalize → publish
//! and ensure the published snapshot is readable and verifiable.

use std::fs;
use std::path::PathBuf;

use capitus_struxis_debugger::{
    checkpoint::ReplayCheckpointProjection,
    effective_config::EffectiveStruxisConfig,
    replay::LoadedInput,
    run::{RunState, RunStatus},
    snapshot_writer::SnapshotWriter,
    worker::CheckpointSink,
    StruxisConfig, StruxisStateKey,
};
use nautilus_model::data::Bar;
use nautilus_model::identifiers::InstrumentId;
use nautilus_model::types::price::Price;
use nautilus_model::types::quantity::Quantity;

fn test_instrument_id() -> InstrumentId {
    InstrumentId::from("BTCUSDT-PERP.BINANCE")
}

fn test_state_key() -> StruxisStateKey {
    StruxisStateKey {
        instrument_id: test_instrument_id(),
        timeframe: std::time::Duration::from_secs(300),
    }
}

fn create_test_bars(count: usize) -> Vec<Bar> {
    let instrument = test_instrument_id();
    let bar_type = format!("{instrument}-5-MINUTE-LAST-EXTERNAL");
    let base_ts: i64 = 1_700_000_000_000_000_000;

    (0..count)
        .map(|i| {
            let ts_event = base_ts + (i as i64 * 300_000_000_000);
            Bar {
                bar_type: bar_type.clone().into(),
                instrument_id: instrument.clone(),
                ts_event: ts_event.into(),
                ts_init: ts_event.into(),
                open: Price::from(100.0 + (i as f64) * 0.1),
                high: Price::from(101.0 + (i as f64) * 0.1),
                low: Price::from(99.0 + (i as f64) * 0.1),
                close: Price::from(100.5 + (i as f64) * 0.1),
                volume: Quantity::from(10.0 + (i as f64)),
            }
        })
        .collect()
}

fn create_test_input(bars: Vec<Bar>) -> LoadedInput {
    LoadedInput {
        test_dataset_id: "test-integration-001".to_string(),
        state_key: test_state_key(),
        bar_type: "BTCUSDT-PERP.BINANCE-5-MINUTE-LAST-EXTERNAL".to_string(),
        bars,
        sbar_sequence_fingerprint: "sha256-test-fingerprint-for-integration".to_string(),
    }
}

fn create_initial_run_state(input: &LoadedInput) -> RunState {
    RunState::new(
        "run-integration-001".to_string(),
        input.test_dataset_id.clone(),
        input.sbar_sequence_fingerprint.clone(),
        input.bars.len(),
    )
}

fn create_effective_config() -> EffectiveStruxisConfig {
    let config = StruxisConfig::builder().build();
    EffectiveStruxisConfig::from_struxis_config(&config)
}

fn create_minimal_checkpoint(index: usize, sbar_id: &str) -> ReplayCheckpointProjection {
    ReplayCheckpointProjection {
        state_key: format!("{:?}", test_state_key()),
        last_ts_event: Some(sbar_id.to_string()),
        sbar_count: index + 1,
        sbars: Vec::new(),
        structure: None,
    }
}

#[test]
fn snapshot_writer_full_lifecycle_with_three_checkpoints() {
    let temp_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/snapshot_integration");
    fs::create_dir_all(&temp_dir).expect("Create temporary snapshot directory");

    let bars = create_test_bars(3);
    let input = create_test_input(bars);
    let initial_state = create_initial_run_state(&input);
    let config = create_effective_config();

    // 1. Create SnapshotWriter
    let mut writer = SnapshotWriter::new(&temp_dir, &input, &test_instrument_id().to_string())
        .expect("SnapshotWriter creation should succeed");

    assert!(!writer.published_path().exists());

    // 2. Initialize
    writer
        .initialize(&initial_state, &config)
        .expect("Initialization should succeed");

    // 3. Commit three checkpoints
    for i in 0..3 {
        let sbar_id = input.bars[i].ts_event.to_string();
        let projection = create_minimal_checkpoint(i, &sbar_id);

        writer
            .commit_checkpoint(i, &sbar_id, &projection)
            .expect(&format!("Checkpoint {i} should commit successfully"));
    }

    // 4. Finalize with completed state
    let completed_state = RunState {
        status: RunStatus::Completed,
        processed_count: 3,
        ..initial_state.clone()
    };

    writer
        .finalize(&completed_state)
        .expect("Finalization should succeed");

    // 5. Verify published file exists
    assert!(
        writer.published_path().exists(),
        "Published snapshot file should exist"
    );

    // 6. Read back and verify
    let (manifest, records) =
        capitus_struxis_debugger::snapshot_store::read_complete_snapshot(
            writer.published_path(),
        )
        .expect("Published snapshot should be readable");

    assert_eq!(manifest.status, "Complete");
    assert_eq!(manifest.checkpoint_count, 3);
    assert_eq!(records.len(), 3);
    assert!(!manifest.content_checksum.is_empty());

    // Cleanup
    if writer.published_path().exists() {
        fs::remove_file(writer.published_path()).ok();
    }
}

#[test]
fn snapshot_writer_rejects_checkpoint_index_out_of_order() {
    let temp_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/snapshot_order_test");
    fs::create_dir_all(&temp_dir).unwrap();

    let bars = create_test_bars(2);
    let input = create_test_input(bars);
    let initial_state = create_initial_run_state(&input);
    let config = create_effective_config();

    let mut writer = SnapshotWriter::new(&temp_dir, &input, &test_instrument_id().to_string()).unwrap();
    writer.initialize(&initial_state, &config).unwrap();

    // First checkpoint succeeds
    let proj0 = create_minimal_checkpoint(0, &input.bars[0].ts_event.to_string());
    writer.commit_checkpoint(0, &input.bars[0].ts_event.to_string(), &proj0).unwrap();

    // Second checkpoint with wrong index should fail
    let proj1 = create_minimal_checkpoint(1, &input.bars[1].ts_event.to_string());
    let result = writer.commit_checkpoint(99, &input.bars[1].ts_event.to_string(), &proj1);

    assert!(result.is_err(), "Out-of-order checkpoint index should be rejected");
    assert!(
        result.unwrap_err().contains("Expected checkpoint index 1"),
        "Error message should indicate expected index"
    );

    // Cleanup
    if temp_dir.exists() {
        fs::read_dir(&temp_dir)
            .unwrap()
            .flatten()
            .filter(|entry| entry.path().extension().map(|e| e == "tmp").unwrap_or(false))
            .for_each(|entry| fs::remove_file(entry.path()).ok());
    }
}

#[test]
fn snapshot_writer_fail_marks_status_without_progression() {
    let temp_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/snapshot_fail_test");
    fs::create_dir_all(&temp_dir).unwrap();

    let bars = create_test_bars(5);
    let input = create_test_input(bars);
    let initial_state = create_initial_run_state(&input);
    let config = create_effective_config();

    let mut writer = SnapshotWriter::new(&temp_dir, &input, &test_instrument_id().to_string()).unwrap();
    writer.initialize(&initial_state, &config).unwrap();

    // Commit one successful checkpoint
    let proj0 = create_minimal_checkpoint(0, &input.bars[0].ts_event.to_string());
    writer.commit_checkpoint(0, &input.bars[0].ts_event.to_string(), &proj0).unwrap();

    // Fail before completing all checkpoints
    writer
        .fail("Simulated processing error at checkpoint 1")
        .unwrap();

    // Verify the failure is recorded (file exists but not published as Complete)
    assert!(
        !writer.published_path().exists(),
        "Failed snapshot should not be published"
    );

    // Cleanup
    if temp_dir.exists() {
        fs::read_dir(&temp_dir)
            .unwrap()
            .flatten()
            .for_each(|entry| fs::remove_file(entry.path()).ok());
    }
}

#[test]
fn snapshot_writer_atomic_publish_renames_temp_to_final() {
    let temp_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/snapshot_publish_test");
    fs::create_dir_all(&temp_dir).unwrap();

    let bars = create_test_bars(1);
    let input = create_test_input(bars);
    let initial_state = create_initial_run_state(&input);
    let config = create_effective_config();

    let mut writer = SnapshotWriter::new(&temp_dir, &input, &test_instrument_id().to_string()).unwrap();
    writer.initialize(&initial_state, &config).unwrap();

    let proj0 = create_minimal_checkpoint(0, &input.bars[0].ts_event.to_string());
    writer
        .commit_checkpoint(0, &input.bars[0].ts_event.to_string(), &proj0)
        .unwrap();

    let completed_state = RunState {
        status: RunStatus::Completed,
        processed_count: 1,
        ..initial_state.clone()
    };

    writer.finalize(&completed_state).unwrap();

    // Verify atomic rename occurred
    let tmp_count = fs::read_dir(&temp_dir)
        .unwrap()
        .flatten()
        .filter(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .ends_with(".snapshot.tmp")
        })
        .count();

    assert_eq!(
        tmp_count, 0,
        "No temporary files should remain after publication"
    );

    let sqlite_count = fs::read_dir(&temp_dir)
        .unwrap()
        .flatten()
        .filter(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .ends_with(".snapshot.sqlite")
        })
        .count();

    assert_eq!(
        sqlite_count, 1,
        "Exactly one published snapshot should exist"
    );

    // Cleanup
    if writer.published_path().exists() {
        fs::remove_file(writer.published_path()).ok();
    }
}