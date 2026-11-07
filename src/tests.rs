//! Regression tests for the standalone Struxis Debugger binary.
//!
//! These tests live inside the binary crate because the Debugger does not expose
//! a public Rust library API. The former integration-test files are compiled as
//! child modules so they can exercise private application modules directly.

#[path = "tests/keyzone_observation_commands.rs"]
mod keyzone_observation_commands;

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

#[test]
fn ipc_dto_contract_preserves_wire_names_and_semantic_json_types() {
    use crate::{
        compare::{
            CompareRejectCategory, CompareRejection, DifferenceKind, ObjectDifference,
            PropertyDifference,
        },
        discovery::CatalogDatasetEntry,
        run::RunState,
        snapshot_store::{SnapshotArtifact, SnapshotArtifactKind},
    };
    use std::path::PathBuf;

    let catalog = CatalogDatasetEntry {
        id: "stream".into(),
        bar_type: None,
        instrument_id: None,
        timeframe: None,
        available: false,
        diagnostic: Some("unavailable".into()),
    };
    let catalog_json = serde_json::to_value(catalog).unwrap();
    assert_eq!(catalog_json["barType"], serde_json::Value::Null);
    assert_eq!(catalog_json["instrumentId"], serde_json::Value::Null);
    assert_eq!(catalog_json["available"], false);
    assert_eq!(catalog_json["diagnostic"], "unavailable");
    assert!(catalog_json.get("bar_type").is_none());

    let run = RunState::ready("run-1".into(), "test-1".into(), "fingerprint".into(), 2)
        .expect("fixture Run should be valid");
    let run_json = serde_json::to_value(run).unwrap();
    assert_eq!(run_json["runId"], "run-1");
    assert_eq!(run_json["inputCount"], 2);
    assert!(run_json["inputCount"].is_number());
    assert_eq!(run_json["processedCount"], 0);
    assert_eq!(run_json["status"], "ready");
    assert_eq!(run_json["cursorSbarId"], serde_json::Value::Null);
    assert_eq!(run_json["failureDiagnostic"], serde_json::Value::Null);
    assert!(run_json.get("input_count").is_none());

    let artifact = SnapshotArtifact {
        file_name: "snapshot-1.snapshot.sqlite".into(),
        path: PathBuf::from("/snapshots/snapshot-1.snapshot.sqlite"),
        kind: SnapshotArtifactKind::CompleteButUnpublished,
        snapshot_id: Some("snapshot-1".into()),
        run_id: Some("run-1".into()),
        state_key: Some("state".into()),
        instrument_id: Some("TEST.SIM".into()),
        bar_type: Some("TEST.SIM-1-MINUTE-LAST-EXTERNAL".into()),
        input_start_ts_event: Some("100".into()),
        input_end_ts_event: Some("200".into()),
        generated_at: Some("1700000000000000000".into()),
        checkpoint_count: Some(2),
        diagnostic: None,
    };
    let artifact_json = serde_json::to_value(artifact).unwrap();
    assert_eq!(artifact_json["fileName"], "snapshot-1.snapshot.sqlite");
    assert_eq!(artifact_json["kind"], "completeButUnpublished");
    assert_eq!(artifact_json["generatedAt"], "1700000000000000000");
    assert_eq!(artifact_json["checkpointCount"], 2);
    assert!(artifact_json["checkpointCount"].is_number());
    assert_eq!(artifact_json["diagnostic"], serde_json::Value::Null);
    assert!(artifact_json.get("file_name").is_none());

    let rejection = CompareRejection {
        category: CompareRejectCategory::InputMismatch,
        message: "different input".into(),
    };
    let rejection_json = serde_json::to_value(rejection).unwrap();
    assert_eq!(rejection_json["category"], "inputMismatch");
    assert_eq!(rejection_json["message"], "different input");

    let difference = ObjectDifference {
        checkpoint_index: 3,
        sbar_id: "1700000000000000000".into(),
        object_type: "CBar".into(),
        kind: DifferenceKind::Modified,
        object_id: "1700000000000000000".into(),
        properties: vec![PropertyDifference {
            field: "high".into(),
            baseline_value: Some(serde_json::json!("10.0")),
            candidate_value: None,
        }],
    };
    let difference_json = serde_json::to_value(difference).unwrap();
    assert_eq!(difference_json["checkpointIndex"], 3);
    assert!(difference_json["checkpointIndex"].is_number());
    assert_eq!(difference_json["sbarId"], "1700000000000000000");
    assert_eq!(difference_json["kind"], "modified");
    assert_eq!(difference_json["properties"][0]["baselineValue"], "10.0");
    assert_eq!(difference_json["properties"][0]["candidateValue"], serde_json::Value::Null);
    assert!(difference_json.get("checkpoint_index").is_none());
}
