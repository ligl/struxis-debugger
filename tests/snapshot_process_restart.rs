//! Cross-process Snapshot durability and readback acceptance.
//!
//! The parent process writes and publishes a real SQLite Snapshot, closes all
//! writer handles, then launches this test binary as a separate OS process.
//! The child independently discovers and verifies the published artifact.

use std::{
    fs,
    path::PathBuf,
    process::Command,
    str::FromStr,
    time::{SystemTime, UNIX_EPOCH},
};

use capitus_struxis::{StruxisConfig, StruxisStateKey};
use capitus_struxis_debugger::{
    checkpoint::ReplayCheckpointProjection,
    effective_config::EffectiveStruxisConfig,
    replay::LoadedInput,
    run::{RunState, RunStatus},
    snapshot_store::{discover_snapshot_artifacts, read_complete_snapshot, SnapshotArtifactKind},
    snapshot_writer::SnapshotWriter,
    worker::CheckpointSink,
};
use nautilus_model::{
    data::{Bar, BarType},
    identifiers::InstrumentId,
    types::{Price, Quantity},
};

const CHILD_ROOT_ENV: &str = "CAPITUS_SNAPSHOT_RESTART_TEST_ROOT";

fn unique_root() -> PathBuf {
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("System clock should be after Unix epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("capitus-snapshot-process-restart-{suffix}"))
}

fn fixture() -> (LoadedInput, RunState, EffectiveStruxisConfig) {
    let bar_type = BarType::from_str("BTCUSDT-PERP.BINANCE-5-MINUTE-LAST-EXTERNAL")
        .expect("Fixture BarType should parse");
    let ts_event: u64 = 1_700_000_000_000_000_000;
    let bar = Bar::new(
        bar_type,
        Price::from("100.0"),
        Price::from("101.0"),
        Price::from("99.0"),
        Price::from("100.5"),
        Quantity::from("10"),
        ts_event.into(),
        ts_event.into(),
    );
    let state_key = StruxisStateKey::from_bar_type(&bar_type);
    let bars = vec![bar];
    let fingerprint = capitus_struxis_debugger::dataset::sequence_fingerprint(state_key, &bars)
        .expect("Fixture SBar sequence fingerprint should compute");
    let input = LoadedInput {
        test_dataset_id: "process-restart-dataset".to_owned(),
        state_key,
        bar_type: "BTCUSDT-PERP.BINANCE-5-MINUTE-LAST-EXTERNAL".to_owned(),
        bars,
        sbar_sequence_fingerprint: fingerprint,
    };
    let run = RunState::ready(
        "process-restart-run".to_owned(),
        input.test_dataset_id.clone(),
        input.sbar_sequence_fingerprint.clone(),
        input.bars.len(),
    )
    .expect("Fixture Run should be Ready");
    let config = EffectiveStruxisConfig::from_struxis_config(
        &StruxisConfig::builder().build(),
    );
    (input, run, config)
}

#[test]
fn snapshot_reader_child_process() {
    let Ok(root) = std::env::var(CHILD_ROOT_ENV) else {
        // The parent invokes this exact test with the environment variable set.
        return;
    };
    let root = PathBuf::from(root);

    let artifacts = discover_snapshot_artifacts(&root)
        .expect("Fresh process should discover the Snapshot directory");
    let complete: Vec<_> = artifacts
        .iter()
        .filter(|artifact| artifact.kind == SnapshotArtifactKind::Complete)
        .collect();
    assert_eq!(complete.len(), 1, "Fresh process should discover exactly one Complete Snapshot");

    let (manifest, records) = read_complete_snapshot(&complete[0].path)
        .expect("Fresh process should read and verify the published Snapshot");
    assert_eq!(manifest.status, "Complete");
    assert_eq!(manifest.run_id, "process-restart-run");
    assert_eq!(manifest.checkpoint_count, 1);
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].checkpoint_index, 0);
    assert_eq!(records[0].sbar_id, records[0].ts_event);
}

#[test]
fn published_snapshot_is_discoverable_and_verifiable_after_os_process_restart() {
    let root = unique_root();
    fs::create_dir_all(&root).expect("Create isolated Snapshot root");

    let (input, initial_state, config) = fixture();
    let instrument_id = InstrumentId::from("BTCUSDT-PERP.BINANCE");
    let mut writer = SnapshotWriter::new(&root, &input, &instrument_id.to_string())
        .expect("Create SnapshotWriter");
    writer.initialize(&initial_state, &config).expect("Initialize SnapshotWriter");

    let sbar_id = input.bars[0].ts_event.to_string();
    let projection = ReplayCheckpointProjection {
        state_key: format!("{:?}", input.state_key),
        last_ts_event: Some(sbar_id.clone()),
        sbar_count: 1,
        sbars: Vec::new(),
        structure: None,
    };
    writer
        .commit_checkpoint(0, &sbar_id, &projection)
        .expect("Commit the only checkpoint");
    let completed_state = RunState {
        status: RunStatus::Completed,
        processed_count: 1,
        ..initial_state
    };
    writer.finalize(&completed_state).expect("Finalize Snapshot");

    let published_path = writer.published_path().to_path_buf();
    assert!(published_path.is_file(), "Published Snapshot should exist");
    drop(writer); // Ensure the parent process closes all Writer handles before spawning.

    let status = Command::new(std::env::current_exe().expect("Resolve current test binary"))
        .args(["--exact", "snapshot_reader_child_process", "--nocapture"])
        .env(CHILD_ROOT_ENV, &root)
        .status()
        .expect("Launch a separate OS process to read the Snapshot");
    assert!(status.success(), "Fresh-process Snapshot readback must succeed");

    fs::remove_dir_all(&root).expect("Remove isolated Snapshot root");
}
