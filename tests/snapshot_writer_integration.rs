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
};
use capitus_struxis::{StruxisConfig, StruxisStateKey};
use nautilus_model::{
    data::{Bar, BarType},
    identifiers::InstrumentId,
    types::{Price, Quantity},
};
use std::str::FromStr;
use std::time::{SystemTime, UNIX_EPOCH};

fn test_instrument_id() -> InstrumentId {
    InstrumentId::from("BTCUSDT-PERP.BINANCE")
}

fn test_state_key() -> StruxisStateKey {
    let bar_type = BarType::from_str("BTCUSDT-PERP.BINANCE-5-MINUTE-LAST-EXTERNAL")
        .expect("fixture BarType should parse");
    StruxisStateKey::from_bar_type(&bar_type)
}

fn create_test_bars(count: usize) -> Vec<Bar> {
    let bar_type = BarType::from_str("BTCUSDT-PERP.BINANCE-5-MINUTE-LAST-EXTERNAL")
        .expect("fixture BarType should parse");
    let base_ts: u64 = 1_700_000_000_000_000_000;

    (0..count)
        .map(|i| {
            let offset = i as u64 * 300_000_000_000;
            let open = format!("{:.1}", 100.0 + i as f64 * 0.1);
            let high = format!("{:.1}", 101.0 + i as f64 * 0.1);
            let low = format!("{:.1}", 99.0 + i as f64 * 0.1);
            let close = format!("{:.1}", 100.5 + i as f64 * 0.1);
            let volume = (10 + i).to_string();
            Bar::new(
                bar_type,
                Price::from(open),
                Price::from(high),
                Price::from(low),
                Price::from(close),
                Quantity::from(volume),
                (base_ts + offset).into(),
                (base_ts + offset).into(),
            )
        })
        .collect()
}

fn create_test_input(bars: Vec<Bar>) -> LoadedInput {
    let state_key = test_state_key();
    let sbar_sequence_fingerprint =
        capitus_struxis_debugger::dataset::sequence_fingerprint(state_key, &bars)
            .expect("fixture SBar sequence fingerprint should compute");

    LoadedInput {
        test_dataset_id: "test-integration-001".to_string(),
        state_key,
        bar_type: "BTCUSDT-PERP.BINANCE-5-MINUTE-LAST-EXTERNAL".to_string(),
        bars,
        sbar_sequence_fingerprint,
    }
}

fn create_initial_run_state(input: &LoadedInput) -> RunState {
    RunState::ready(
        "run-integration-001".to_string(),
        input.test_dataset_id.clone(),
        input.sbar_sequence_fingerprint.clone(),
        input.bars.len(),
    ).expect("test input should produce a valid Ready Run")
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
        diagnostics: Vec::new(),
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
            .for_each(|entry| { let _ = fs::remove_file(entry.path()); });
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
            .for_each(|entry| { let _ = fs::remove_file(entry.path()); });
    }
}

#[test]
fn snapshot_writer_atomic_publish_renames_temp_to_final() {
    let unique_suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("System clock should be after Unix epoch")
        .as_nanos();
    let temp_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/snapshot_publish_test")
        .join(format!("run-{unique_suffix}"));
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
    drop(writer);
    fs::remove_dir_all(&temp_dir).expect("Remove isolated Snapshot publication test directory");
}

#[test]
fn snapshot_writer_does_not_overwrite_existing_publish_destination() {
    let unique_suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("System clock should be after Unix epoch")
        .as_nanos();
    let temp_dir = std::env::temp_dir()
        .join(format!("capitus-snapshot-publish-collision-{unique_suffix}"));
    fs::create_dir_all(&temp_dir).expect("Create isolated Snapshot directory");

    let bars = create_test_bars(1);
    let input = create_test_input(bars);
    let initial_state = create_initial_run_state(&input);
    let config = create_effective_config();
    let mut writer = SnapshotWriter::new(
        &temp_dir,
        &input,
        &test_instrument_id().to_string(),
    )
    .expect("SnapshotWriter should be created");
    writer
        .initialize(&initial_state, &config)
        .expect("SnapshotWriter should initialize");

    let sbar_id = input.bars[0].ts_event.to_string();
    let projection = create_minimal_checkpoint(0, &sbar_id);
    writer
        .commit_checkpoint(0, &sbar_id, &projection)
        .expect("Checkpoint should commit");

    // Simulate another artifact occupying the generated destination after
    // initialize(). Publication must fail without replacing these bytes.
    let existing_bytes = b"pre-existing snapshot artifact";
    fs::write(writer.published_path(), existing_bytes)
        .expect("Create pre-existing publish destination");

    let completed_state = RunState {
        status: RunStatus::Completed,
        processed_count: 1,
        ..initial_state
    };
    let result = writer.finalize(&completed_state);

    assert!(
        result.is_err(),
        "Finalization must reject an occupied publish destination"
    );
    assert_eq!(
        fs::read(writer.published_path()).expect("Read existing destination"),
        existing_bytes,
        "Finalization must not overwrite an existing artifact"
    );

    // The caller's failure path must downgrade the completed-but-unpublished
    // temporary database so discovery cannot mistake it for a successful run.
    writer
        .fail("Simulated publish collision")
        .expect("Failed finalization should persist Failed status");
    let temporary_path = fs::read_dir(&temp_dir)
        .expect("Read Snapshot directory")
        .flatten()
        .map(|entry| entry.path())
        .find(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with('.') && name.ends_with(".snapshot.tmp"))
        })
        .expect("Failed unpublished Snapshot should remain as a temporary artifact");
    let connection = rusqlite::Connection::open(&temporary_path)
        .expect("Open retained temporary Snapshot");
    let payload: String = connection
        .query_row(
            "SELECT payload FROM snapshot_manifest WHERE singleton=1",
            [],
            |row| row.get(0),
        )
        .expect("Read retained Snapshot Manifest");
    let manifest: serde_json::Value =
        serde_json::from_str(&payload).expect("Decode retained Snapshot Manifest");
    assert_eq!(
        manifest["status"].as_str(),
        Some("Failed"),
        "A failed publish must not leave a Complete temporary Manifest"
    );

    let artifacts = capitus_struxis_debugger::snapshot_store::discover_snapshot_artifacts(&temp_dir)
        .expect("Snapshot discovery should classify the retained failed artifact");
    let failed_artifact = artifacts
        .iter()
        .find(|artifact| artifact.path == temporary_path)
        .expect("Failed temporary artifact should remain discoverable");
    assert_eq!(
        failed_artifact.kind,
        capitus_struxis_debugger::snapshot_store::SnapshotArtifactKind::FailedTemporary,
        "Store discovery must classify the Writer's failed residual as FailedTemporary"
    );

    assert_eq!(
        fs::read(writer.published_path()).expect("Re-read existing destination"),
        existing_bytes,
        "Failure handling must preserve the pre-existing destination"
    );

    drop(writer);
    fs::remove_dir_all(&temp_dir).expect("Remove isolated Snapshot directory");
}

#[test]
fn snapshot_writer_rejects_finalization_when_checkpoints_are_incomplete() {
    let unique_suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("System clock should be after Unix epoch")
        .as_nanos();
    let temp_dir = std::env::temp_dir()
        .join(format!("capitus-snapshot-incomplete-finalize-{unique_suffix}"));
    fs::create_dir_all(&temp_dir).expect("Create isolated Snapshot directory");

    let bars = create_test_bars(2);
    let input = create_test_input(bars);
    let initial_state = create_initial_run_state(&input);
    let config = create_effective_config();
    let mut writer = SnapshotWriter::new(
        &temp_dir,
        &input,
        &test_instrument_id().to_string(),
    )
    .expect("SnapshotWriter should be created");
    writer
        .initialize(&initial_state, &config)
        .expect("SnapshotWriter should initialize");

    // Commit only the first of two required checkpoints.
    let sbar_id = input.bars[0].ts_event.to_string();
    let projection = create_minimal_checkpoint(0, &sbar_id);
    writer
        .commit_checkpoint(0, &sbar_id, &projection)
        .expect("First checkpoint should commit");

    // A caller-supplied Completed status must not bypass completeness checks.
    let incomplete_completed_state = RunState {
        status: RunStatus::Completed,
        processed_count: 1,
        ..initial_state
    };
    let result = writer.finalize(&incomplete_completed_state);

    assert!(
        result.is_err(),
        "Finalization must reject fewer checkpoints than the fixed input count"
    );
    assert!(
        !writer.published_path().exists(),
        "An incomplete Snapshot must never be published as Complete"
    );

    drop(writer);
    fs::remove_dir_all(&temp_dir).expect("Remove isolated Snapshot directory");
}
