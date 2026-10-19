//! End-to-end Snapshot Compare coverage using independently published SQLite artifacts.

use std::{
    fs,
    path::{Path, PathBuf},
    str::FromStr,
    time::{SystemTime, UNIX_EPOCH},
};

use capitus_struxis::{StruxisConfig, StruxisStateKey};
use crate::{
    checkpoint::{CBarCheckpoint, ReplayCheckpointProjection, StructureCheckpoint},
    compare::{CompareRejectCategory, compare_snapshot_paths},
    dataset::sequence_fingerprint,
    effective_config::EffectiveStruxisConfig,
    replay::LoadedInput,
    run::{RunState, RunStatus},
    snapshot_store::discover_snapshot_artifacts,
    snapshot_writer::SnapshotWriter,
    worker::CheckpointSink,
};
use nautilus_model::{
    data::{Bar, BarType},
    identifiers::InstrumentId,
    types::{Price, Quantity},
};

fn test_state_key() -> StruxisStateKey {
    let bar_type = BarType::from_str("BTCUSDT-PERP.BINANCE-5-MINUTE-LAST-EXTERNAL").unwrap();
    StruxisStateKey::from_bar_type(&bar_type)
}

fn test_bars() -> Vec<Bar> {
    let bar_type = BarType::from_str("BTCUSDT-PERP.BINANCE-5-MINUTE-LAST-EXTERNAL").unwrap();
    let base_ts = 1_700_000_000_000_000_000_u64;
    (0..2).map(|i| {
        let ts = base_ts + i as u64 * 300_000_000_000;
        Bar::new(
            bar_type,
            Price::from(format!("{:.1}", 100.0 + i as f64 * 0.1)),
            Price::from(format!("{:.1}", 101.0 + i as f64 * 0.1)),
            Price::from(format!("{:.1}", 99.0 + i as f64 * 0.1)),
            Price::from(format!("{:.1}", 100.5 + i as f64 * 0.1)),
            Quantity::from((10 + i).to_string()),
            ts.into(),
            ts.into(),
        )
    }).collect()
}

fn test_input() -> LoadedInput {
    let bars = test_bars();
    let state_key = test_state_key();
    let fingerprint = sequence_fingerprint(state_key, &bars).unwrap();
    LoadedInput {
        test_dataset_id: "compare-integration-dataset".into(),
        state_key,
        bar_type: "BTCUSDT-PERP.BINANCE-5-MINUTE-LAST-EXTERNAL".into(),
        bars,
        sbar_sequence_fingerprint: fingerprint,
    }
}

fn checkpoint(input: &LoadedInput, index: usize, high: &str, include_diagnostic: bool) -> ReplayCheckpointProjection {
    let first_id = input.bars[0].ts_event.to_string();
    let current_id = input.bars[index].ts_event.to_string();
    ReplayCheckpointProjection {
        state_key: format!("{:?}", test_state_key()),
        last_ts_event: Some(current_id),
        sbar_count: index + 1,
        sbars: Vec::new(),
        structure: Some(StructureCheckpoint {
            cbar_count: 1,
            cbars: vec![CBarCheckpoint {
                cbar_id: first_id.clone(),
                high: high.to_owned(),
                low: "99.0".into(),
                sbar_start_id: first_id.clone(),
                sbar_end_id: first_id,
                span_sbars: 1,
                fractal_type: None,
                created_at: "1".into(),
            }],
            swing_count: 0,
            swings: Vec::new(),
        }),
        diagnostics: if include_diagnostic {
            vec![crate::diagnostics::Diagnostic {
                source: "replay".into(),
                severity: "warning".into(),
                category: "TestDiagnostic".into(),
                object_type: None,
                object_id: None,
                sbar_ids: vec![current_id],
                checkpoint_index: Some(index),
                message: "Integration-test diagnostic".into(),
            }]
        } else {
            Vec::new()
        },
    }
}

fn publish_snapshot(
    root: &Path,
    input: &LoadedInput,
    changed_final_high: bool,
    include_diagnostic: bool,
) -> PathBuf {
    let mut writer = SnapshotWriter::new(
        root,
        input,
        &InstrumentId::from("BTCUSDT-PERP.BINANCE").to_string(),
    ).unwrap();
    let initial = RunState::ready(
        format!("run-{}", if changed_final_high { "candidate" } else { "baseline" }),
        input.test_dataset_id.clone(),
        input.sbar_sequence_fingerprint.clone(),
        input.bars.len(),
    ).unwrap();
    let config = EffectiveStruxisConfig::from_struxis_config(&StruxisConfig::builder().build());
    writer.initialize(&initial, &config).unwrap();

    for index in 0..input.bars.len() {
        let high = if changed_final_high && index == 1 { "102.0" } else { "101.0" };
        let sbar_id = input.bars[index].ts_event.to_string();
        writer.commit_checkpoint(index, &sbar_id, &checkpoint(input, index, high, include_diagnostic && index == 0)).unwrap();
    }

    let completed = RunState {
        status: RunStatus::Completed,
        processed_count: input.bars.len(),
        ..initial
    };
    writer.finalize(&completed).unwrap();
    let path = writer.published_path().to_path_buf();
    drop(writer);
    path
}

fn temp_root() -> PathBuf {
    let suffix = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    std::env::temp_dir().join(format!("capitus-snapshot-compare-{suffix}"))
}

#[test]
fn compares_two_verified_sqlite_snapshots_by_domain_identity() {
    let root = temp_root();
    let baseline_root = root.join("baseline");
    let candidate_root = root.join("candidate");
    fs::create_dir_all(&baseline_root).unwrap();
    fs::create_dir_all(&candidate_root).unwrap();

    let input = test_input();
    let baseline_path = publish_snapshot(&baseline_root, &input, false, false);
    let candidate_path = publish_snapshot(&candidate_root, &input, true, false);

    let result = compare_snapshot_paths(&baseline_path, &candidate_path)
        .expect("two independently published complete Snapshots should compare");
    assert_eq!(result.checkpoint_count, 2);
    assert_eq!(result.differences.len(), 1);
    assert_eq!(result.differences[0].checkpoint_index, 1);
    assert_eq!(result.differences[0].object_type, "CBar");
    assert_eq!(result.differences[0].object_id, "1700000000000000000");
    assert_eq!(result.differences[0].kind, crate::compare::DifferenceKind::Modified);
    assert_eq!(result.differences[0].properties.len(), 1);
    assert_eq!(result.differences[0].properties[0].field, "high");
    assert_eq!(
        result.first_structural_divergence.as_ref().map(|value| value.checkpoint_index),
        Some(1),
    );

    let artifacts = discover_snapshot_artifacts(&baseline_root).unwrap();
    assert_eq!(artifacts.len(), 1);
    assert_eq!(artifacts[0].kind, crate::snapshot_store::SnapshotArtifactKind::Complete);

    fs::remove_dir_all(root).unwrap();
}

#[test]
fn rejects_sqlite_snapshots_with_different_complete_input_fingerprints() {
    let root = temp_root();
    let baseline_root = root.join("baseline");
    let candidate_root = root.join("candidate");
    fs::create_dir_all(&baseline_root).unwrap();
    fs::create_dir_all(&candidate_root).unwrap();

    let baseline_input = test_input();
    let mut candidate_input = test_input();
    candidate_input.sbar_sequence_fingerprint = "a".repeat(64);

    let baseline_path = publish_snapshot(&baseline_root, &baseline_input, false, false);
    let candidate_path = publish_snapshot(&candidate_root, &candidate_input, false, false);

    let rejection = compare_snapshot_paths(&baseline_path, &candidate_path)
        .expect_err("different complete input fingerprints must reject comparison");
    assert_eq!(rejection.category, CompareRejectCategory::InputMismatch);

    fs::remove_dir_all(root).unwrap();
}

#[test]
fn diagnostic_divergence_does_not_create_structural_divergence() {
    let root = temp_root();
    let baseline_root = root.join("baseline");
    let candidate_root = root.join("candidate");
    fs::create_dir_all(&baseline_root).unwrap();
    fs::create_dir_all(&candidate_root).unwrap();

    let input = test_input();
    let baseline_path = publish_snapshot(&baseline_root, &input, false, false);
    let candidate_path = publish_snapshot(&candidate_root, &input, false, true);

    let result = compare_snapshot_paths(&baseline_path, &candidate_path)
        .expect("diagnostic differences must not reject otherwise valid Snapshots");

    assert!(result.differences.is_empty());
    assert!(result.first_structural_divergence.is_none());
    assert_eq!(result.diagnostics_differences.len(), 1);
    assert_eq!(result.diagnostics_differences[0].checkpoint_index, 0);
    assert_eq!(result.first_diagnostics_divergence, Some(0));

    fs::remove_dir_all(root).unwrap();
}
