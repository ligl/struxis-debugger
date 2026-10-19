//! Strict comparison of two complete, published Snapshot files.
//!
//! Compare never repairs artifacts or reads the original Catalog/Test dataset.
//! Both files are independently verified before their checkpoints are aligned.

use std::{collections::BTreeMap, path::Path};

use serde::Serialize;
use serde_json::Value;

use crate::{
    snapshot::{SnapshotCheckpointRecord, SnapshotManifest},
    snapshot_store::{read_complete_snapshot_typed, SnapshotReadError},
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CompareRejectCategory {
    InputMismatch,
    SnapshotUnreadable,
    SnapshotIncomplete,
    SnapshotIntegrityFailure,
    CheckpointTrajectoryConflict,
    StateReconstructionFailure,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CompareRejection {
    pub(crate) category: CompareRejectCategory,
    pub(crate) message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum DifferenceKind {
    Added,
    Removed,
    Modified,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PropertyDifference {
    pub(crate) field: String,
    pub(crate) baseline_value: Option<Value>,
    pub(crate) candidate_value: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ObjectDifference {
    pub(crate) checkpoint_index: usize,
    pub(crate) sbar_id: String,
    pub(crate) object_type: String,
    pub(crate) kind: DifferenceKind,
    pub(crate) object_id: String,
    pub(crate) properties: Vec<PropertyDifference>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CheckpointCompareSummary {
    pub(crate) checkpoint_index: usize,
    pub(crate) sbar_id: String,
    pub(crate) ts_event: String,
    pub(crate) difference_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SnapshotCompareMetadata {
    pub(crate) snapshot_id: String,
    pub(crate) run_id: String,
    pub(crate) state_key: String,
    pub(crate) instrument_id: String,
    pub(crate) bar_type: String,
    pub(crate) snapshot_generated_at: String,
    pub(crate) input_bar_count: usize,
    pub(crate) sbar_sequence_fingerprint: String,
    pub(crate) config_fingerprint: String,
    pub(crate) effective_config: String,
}

impl From<&SnapshotManifest> for SnapshotCompareMetadata {
    fn from(value: &SnapshotManifest) -> Self {
        Self {
            snapshot_id: value.snapshot_id.clone(),
            run_id: value.run_id.clone(),
            state_key: value.state_key.clone(),
            instrument_id: value.instrument_id.clone(),
            bar_type: value.bar_type.clone(),
            snapshot_generated_at: value.snapshot_generated_at.clone(),
            input_bar_count: value.input_bar_count,
            sbar_sequence_fingerprint: value.sbar_sequence_fingerprint.clone(),
            config_fingerprint: value.config_fingerprint.clone(),
            effective_config: value.effective_config.clone(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DiagnosticsDifference {
    pub(crate) checkpoint_index: usize,
    pub(crate) sbar_id: String,
    pub(crate) baseline: Value,
    pub(crate) candidate: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SnapshotCompareResult {
    pub(crate) baseline: SnapshotCompareMetadata,
    pub(crate) candidate: SnapshotCompareMetadata,
    pub(crate) checkpoint_count: usize,
    pub(crate) checkpoints: Vec<CheckpointCompareSummary>,
    pub(crate) differences: Vec<ObjectDifference>,
    pub(crate) first_structural_divergence: Option<CheckpointCompareSummary>,
    pub(crate) diagnostics_differences: Vec<DiagnosticsDifference>,
    pub(crate) first_diagnostics_divergence: Option<usize>,
}

/// Strictly compares two complete Snapshots. Every error rejects the entire
/// operation; no partial result is returned for invalid inputs.
pub(crate) fn compare_snapshot_paths(
    baseline_path: impl AsRef<Path>,
    candidate_path: impl AsRef<Path>,
) -> Result<SnapshotCompareResult, CompareRejection> {
    let (baseline_manifest, baseline_records) =
        read_complete_snapshot_typed(baseline_path).map_err(classify_snapshot_read_error)?;
    let (candidate_manifest, candidate_records) =
        read_complete_snapshot_typed(candidate_path).map_err(classify_snapshot_read_error)?;

    if baseline_manifest.sbar_sequence_fingerprint != candidate_manifest.sbar_sequence_fingerprint {
        return Err(reject(
            CompareRejectCategory::InputMismatch,
            "Snapshots have different complete SBar sequence fingerprints",
        ));
    }

    validate_trajectory(&baseline_manifest, &baseline_records)?;
    validate_trajectory(&candidate_manifest, &candidate_records)?;
    if baseline_records.len() != candidate_records.len() {
        return Err(reject(
            CompareRejectCategory::CheckpointTrajectoryConflict,
            "Matching input fingerprints have different checkpoint counts",
        ));
    }

    let mut checkpoints = Vec::with_capacity(baseline_records.len());
    let mut differences = Vec::new();
    let mut diagnostics_differences = Vec::new();
    let mut first_structural_divergence = None;
    let mut first_diagnostics_divergence = None;

    for (baseline, candidate) in baseline_records.iter().zip(&candidate_records) {
        if baseline.checkpoint_index != candidate.checkpoint_index
            || baseline.sbar_id != candidate.sbar_id
            || baseline.ts_event != candidate.ts_event
        {
            return Err(reject(
                CompareRejectCategory::CheckpointTrajectoryConflict,
                format!(
                    "Checkpoint trajectory mismatch at index {}",
                    baseline.checkpoint_index
                ),
            ));
        }

        let before = differences.len();
        compare_structure_record(baseline, candidate, &mut differences)?;
        let summary = CheckpointCompareSummary {
            checkpoint_index: baseline.checkpoint_index,
            sbar_id: baseline.sbar_id.clone(),
            ts_event: baseline.ts_event.clone(),
            difference_count: differences.len() - before,
        };
        if summary.difference_count > 0 && first_structural_divergence.is_none() {
            first_structural_divergence = Some(summary.clone());
        }
        checkpoints.push(summary);

        let baseline_diagnostics = parse_json(&baseline.diagnostics, "baseline diagnostics")?;
        let candidate_diagnostics = parse_json(&candidate.diagnostics, "candidate diagnostics")?;
        if baseline_diagnostics != candidate_diagnostics {
            first_diagnostics_divergence.get_or_insert(baseline.checkpoint_index);
            diagnostics_differences.push(DiagnosticsDifference {
                checkpoint_index: baseline.checkpoint_index,
                sbar_id: baseline.sbar_id.clone(),
                baseline: baseline_diagnostics,
                candidate: candidate_diagnostics,
            });
        }
    }

    Ok(SnapshotCompareResult {
        baseline: SnapshotCompareMetadata::from(&baseline_manifest),
        candidate: SnapshotCompareMetadata::from(&candidate_manifest),
        checkpoint_count: checkpoints.len(),
        checkpoints,
        differences,
        first_structural_divergence,
        diagnostics_differences,
        first_diagnostics_divergence,
    })
}

fn validate_trajectory(
    manifest: &SnapshotManifest,
    records: &[SnapshotCheckpointRecord],
) -> Result<(), CompareRejection> {
    if records.len() != manifest.input_bar_count
        || records.len() != manifest.checkpoint_count
    {
        return Err(reject(
            CompareRejectCategory::SnapshotIncomplete,
            "Snapshot checkpoint count does not cover its complete input",
        ));
    }
    for (expected_index, record) in records.iter().enumerate() {
        if record.checkpoint_index != expected_index
            || record.sbar_id != record.ts_event
            || (expected_index > 0 && records[expected_index - 1].ts_event >= record.ts_event)
        {
            return Err(reject(
                CompareRejectCategory::CheckpointTrajectoryConflict,
                format!("Invalid checkpoint trajectory at index {expected_index}"),
            ));
        }
    }
    if let (Some(first), Some(last)) = (records.first(), records.last()) {
        if first.sbar_id != manifest.input_start_sbar_id
            || first.ts_event != manifest.input_start_ts_event
            || last.sbar_id != manifest.input_end_sbar_id
            || last.ts_event != manifest.input_end_ts_event
        {
            return Err(reject(
                CompareRejectCategory::CheckpointTrajectoryConflict,
                "Checkpoint trajectory does not match Snapshot input boundaries",
            ));
        }
    }
    Ok(())
}

fn compare_structure_record(
    baseline: &SnapshotCheckpointRecord,
    candidate: &SnapshotCheckpointRecord,
    output: &mut Vec<ObjectDifference>,
) -> Result<(), CompareRejection> {
    if baseline.record_kind != "Full" || candidate.record_kind != "Full" {
        return Err(reject(
            CompareRejectCategory::StateReconstructionFailure,
            "Only Full checkpoint records are supported until Delta reconstruction is implemented",
        ));
    }
    let baseline_state = parse_json(&baseline.state_data, "baseline state_data")?;
    let candidate_state = parse_json(&candidate.state_data, "candidate state_data")?;
    let before = output.len();
    compare_object_collection(
        baseline.checkpoint_index, &baseline.sbar_id, "CBar",
        baseline_state.get("cbars"), candidate_state.get("cbars"), "cbarId", output,
    )?;
    compare_object_collection(
        baseline.checkpoint_index, &baseline.sbar_id, "Swing",
        baseline_state.get("swings"), candidate_state.get("swings"), "swingId", output,
    )?;

    // A valid Snapshot schema currently has exactly these state fields.
    // Reject schema drift and internally inconsistent counts rather than
    // silently producing a partial comparison from malformed state_data.
    for (label, state) in [("baseline", &baseline_state), ("candidate", &candidate_state)] {
        let fields = state.as_object().ok_or_else(|| reject(
            CompareRejectCategory::SnapshotIntegrityFailure,
            format!("{label} state_data must be an object"),
        ))?;
        for key in ["cbarCount", "cbars", "swingCount", "swings"] {
            if !fields.contains_key(key) {
                return Err(reject(
                    CompareRejectCategory::SnapshotIntegrityFailure,
                    format!("{label} state_data is missing required field: {key}"),
                ));
            }
        }
        if let Some(key) = fields.keys().find(|key| {
            !["cbarCount", "cbars", "swingCount", "swings"].contains(&key.as_str())
        }) {
            return Err(reject(
                CompareRejectCategory::SnapshotIntegrityFailure,
                format!("{label} state_data contains unsupported field: {key}"),
            ));
        }
        for (count_key, collection_key, label_name) in [
            ("cbarCount", "cbars", "CBar"),
            ("swingCount", "swings", "Swing"),
        ] {
            let declared_count = fields[count_key].as_u64().ok_or_else(|| reject(
                CompareRejectCategory::SnapshotIntegrityFailure,
                format!("{label} {count_key} must be a non-negative integer"),
            ))?;
            let actual_count = fields[collection_key].as_array().ok_or_else(|| reject(
                CompareRejectCategory::SnapshotIntegrityFailure,
                format!("{label} {collection_key} must be an array"),
            ))?.len() as u64;
            if declared_count != actual_count {
                return Err(reject(
                    CompareRejectCategory::SnapshotIntegrityFailure,
                    format!("{label} {label_name} count does not match its collection"),
                ));
            }
        }
    }
    let _ = before;
    Ok(())
}

fn compare_object_collection(
    checkpoint_index: usize,
    sbar_id: &str,
    object_type: &str,
    baseline_values: Option<&Value>,
    candidate_values: Option<&Value>,
    id_field: &str,
    output: &mut Vec<ObjectDifference>,
) -> Result<(), CompareRejection> {
    let baseline = indexed_objects(baseline_values, object_type, id_field)?;
    let candidate = indexed_objects(candidate_values, object_type, id_field)?;
    let ids: std::collections::BTreeSet<_> =
        baseline.keys().chain(candidate.keys()).cloned().collect();

    for id in ids {
        match (baseline.get(&id), candidate.get(&id)) {
            (None, Some(value)) => output.push(ObjectDifference {
                checkpoint_index, sbar_id: sbar_id.to_owned(), object_type: object_type.to_owned(),
                kind: DifferenceKind::Added, object_id: id,
                properties: value.iter().map(|(field, value)| PropertyDifference {
                    field: field.clone(), baseline_value: None, candidate_value: Some(value.clone()),
                }).collect(),
            }),
            (Some(value), None) => output.push(ObjectDifference {
                checkpoint_index, sbar_id: sbar_id.to_owned(), object_type: object_type.to_owned(),
                kind: DifferenceKind::Removed, object_id: id,
                properties: value.iter().map(|(field, value)| PropertyDifference {
                    field: field.clone(), baseline_value: Some(value.clone()), candidate_value: None,
                }).collect(),
            }),
            (Some(before), Some(after)) => {
                let properties = compare_properties(before, after, id_field);
                if !properties.is_empty() {
                    output.push(ObjectDifference {
                        checkpoint_index, sbar_id: sbar_id.to_owned(), object_type: object_type.to_owned(),
                        kind: DifferenceKind::Modified, object_id: id, properties,
                    });
                }
            }
            (None, None) => unreachable!("ID union must be present on one side"),
        }
    }
    Ok(())
}

fn indexed_objects(
    value: Option<&Value>,
    object_type: &str,
    id_field: &str,
) -> Result<BTreeMap<String, BTreeMap<String, Value>>, CompareRejection> {
    let values = value.and_then(Value::as_array).ok_or_else(|| reject(
        CompareRejectCategory::SnapshotIntegrityFailure,
        format!("{object_type} state must be an array"),
    ))?;
    let mut indexed = BTreeMap::new();
    for object in values {
        let fields = object.as_object().ok_or_else(|| reject(
            CompareRejectCategory::SnapshotIntegrityFailure,
            format!("{object_type} entry must be an object"),
        ))?;
        let id = fields.get(id_field).and_then(Value::as_str).ok_or_else(|| reject(
            CompareRejectCategory::SnapshotIntegrityFailure,
            format!("{object_type} entry is missing canonical identity {id_field}"),
        ))?.to_owned();
        if indexed.insert(id, fields.iter().map(|(k,v)| (k.clone(), v.clone())).collect()).is_some() {
            return Err(reject(
                CompareRejectCategory::SnapshotIntegrityFailure,
                format!("{object_type} contains duplicate domain IDs"),
            ));
        }
    }
    Ok(indexed)
}

fn compare_properties(
    baseline: &BTreeMap<String, Value>,
    candidate: &BTreeMap<String, Value>,
    id_field: &str,
) -> Vec<PropertyDifference> {
    let fields: std::collections::BTreeSet<_> =
        baseline.keys().chain(candidate.keys()).filter(|field| {
            field.as_str() != id_field
                && field.as_str() != "createdAt"
                && field.as_str() != "updatedAt"
        }).cloned().collect();
    fields.into_iter().filter_map(|field| {
        let before = baseline.get(&field);
        let after = candidate.get(&field);
        (before != after).then(|| PropertyDifference {
            field,
            baseline_value: before.cloned(),
            candidate_value: after.cloned(),
        })
    }).collect()
}

fn parse_json(value: &str, label: &str) -> Result<Value, CompareRejection> {
    serde_json::from_str(value).map_err(|error| reject(
        CompareRejectCategory::SnapshotIntegrityFailure,
        format!("Cannot decode {label}: {error}"),
    ))
}

fn classify_snapshot_read_error(error: SnapshotReadError) -> CompareRejection {
    let (category, message) = match error {
        SnapshotReadError::Unpublished(message) | SnapshotReadError::Incomplete(message) => {
            (CompareRejectCategory::SnapshotIncomplete, message)
        }
        SnapshotReadError::Unreadable(message) => {
            (CompareRejectCategory::SnapshotUnreadable, message)
        }
        SnapshotReadError::IntegrityFailure(message) => {
            (CompareRejectCategory::SnapshotIntegrityFailure, message)
        }
    };
    reject(category, message)
}

fn reject(category: CompareRejectCategory, message: impl Into<String>) -> CompareRejection {
    CompareRejection { category, message: message.into() }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record(index: usize, sbar_id: &str, cbars: &str, swings: &str) -> SnapshotCheckpointRecord {
        SnapshotCheckpointRecord {
            checkpoint_index: index,
            sbar_id: sbar_id.into(),
            ts_event: sbar_id.into(),
            record_kind: "Full".into(),
            state_data: format!(
                r#"{{"cbarCount":{},"cbars":{},"swingCount":{},"swings":{}}}"#,
                serde_json::from_str::<Value>(cbars).unwrap().as_array().unwrap().len(),
                cbars,
                serde_json::from_str::<Value>(swings).unwrap().as_array().unwrap().len(),
                swings
            ),
            diagnostics: "[]".into(),
        }
    }

    #[test]
    fn compares_cbar_by_domain_id_and_reports_first_divergence() {
        let before = record(0, "100", r#"[{"cbarId":"10","high":"12","low":"9","sbarStartId":"100","sbarEndId":"100","spanSbars":1,"fractalType":null,"createdAt":"1"}]"#, "[]");
        let after = record(0, "100", r#"[{"cbarId":"10","high":"13","low":"9","sbarStartId":"100","sbarEndId":"100","spanSbars":1,"fractalType":null,"createdAt":"1"}]"#, "[]");
        let mut differences = Vec::new();
        compare_structure_record(&before, &after, &mut differences).unwrap();
        assert_eq!(differences.len(), 1);
        assert_eq!(differences[0].kind, DifferenceKind::Modified);
        assert_eq!(differences[0].object_id, "10");
        assert_eq!(differences[0].properties[0].field, "high");
    }

    #[test]
    fn wall_clock_lifecycle_timestamps_do_not_create_structural_differences() {
        let before = record(
            0,
            "100",
            r#"[{"cbarId":"10","high":"12","low":"9","sbarStartId":"100","sbarEndId":"100","spanSbars":1,"fractalType":null,"createdAt":"1000"}]"#,
            r#"[{"swingId":"20","high":"12","low":"9","createdAt":"1000","updatedAt":"1001"}]"#,
        );
        let after = record(
            0,
            "100",
            r#"[{"cbarId":"10","high":"12","low":"9","sbarStartId":"100","sbarEndId":"100","spanSbars":1,"fractalType":null,"createdAt":"2000"}]"#,
            r#"[{"swingId":"20","high":"12","low":"9","createdAt":"2000","updatedAt":"2001"}]"#,
        );
        let mut differences = Vec::new();
        compare_structure_record(&before, &after, &mut differences).unwrap();
        assert!(
            differences.is_empty(),
            "wall-clock lifecycle timestamps are operational metadata, not structural state",
        );
    }

    #[test]
    fn collection_order_does_not_create_differences() {
        let before = record(0, "100", r#"[{"cbarId":"10","high":"12"},{"cbarId":"11","high":"13"}]"#, "[]");
        let after = record(0, "100", r#"[{"cbarId":"11","high":"13"},{"cbarId":"10","high":"12"}]"#, "[]");
        let mut differences = Vec::new();
        compare_structure_record(&before, &after, &mut differences).unwrap();
        assert!(differences.is_empty());
    }

    #[test]
    fn reports_added_and_removed_objects_by_id() {
        let before = record(0, "100", r#"[{"cbarId":"10"}]"#, "[]");
        let after = record(0, "100", r#"[{"cbarId":"11"}]"#, "[]");
        let mut differences = Vec::new();
        compare_structure_record(&before, &after, &mut differences).unwrap();
        assert_eq!(differences.len(), 2);
        assert_eq!(differences[0].kind, DifferenceKind::Removed);
        assert_eq!(differences[1].kind, DifferenceKind::Added);
    }

    #[test]
    fn snapshot_read_error_categories_do_not_depend_on_message_text() {
        let cases = [
            (
                SnapshotReadError::Unreadable("checksum mismatch wording".into()),
                CompareRejectCategory::SnapshotUnreadable,
            ),
            (
                SnapshotReadError::IntegrityFailure("I/O failure wording".into()),
                CompareRejectCategory::SnapshotIntegrityFailure,
            ),
            (
                SnapshotReadError::Incomplete("invalid JSON wording".into()),
                CompareRejectCategory::SnapshotIncomplete,
            ),
            (
                SnapshotReadError::Unpublished("database schema failure wording".into()),
                CompareRejectCategory::SnapshotIncomplete,
            ),
        ];
        for (error, expected) in cases {
            assert_eq!(
                classify_snapshot_read_error(error).category,
                expected,
                "classification must follow the typed variant, not the message text",
            );
        }
    }

    #[test]
    fn rejects_state_data_when_declared_count_disagrees_with_collection() {
        let mut before = record(0, "100", r#"[{"cbarId":"10"}]"#, "[]");
        let after = record(0, "100", r#"[{"cbarId":"10"}]"#, "[]");
        before.state_data = before.state_data.replace("\\"cbarCount\\":1", "\\"cbarCount\\":0");

        let rejection = compare_structure_record(&before, &after, &mut Vec::new()).unwrap_err();
        assert_eq!(rejection.category, CompareRejectCategory::SnapshotIntegrityFailure);
        assert!(rejection.message.contains("CBar count"));
    }

    #[test]
    fn rejects_unrecognized_top_level_state_data_fields() {
        let mut before = record(0, "100", "[]", "[]");
        let after = record(0, "100", "[]", "[]");
        before.state_data = before.state_data.replace("\\\"swings\\\":[]", "\\\"swings\\\":[],\\\"futureField\\\":true");

        let rejection = compare_structure_record(&before, &after, &mut Vec::new()).unwrap_err();
        assert_eq!(rejection.category, CompareRejectCategory::SnapshotIntegrityFailure);
        assert!(rejection.message.contains("unsupported field"));
    }

    #[test]
    fn rejects_non_full_checkpoint_state() {
        let mut before = record(0, "100", "[]", "[]");
        let after = record(0, "100", "[]", "[]");
        before.record_kind = "Delta".into();
        assert_eq!(
            compare_structure_record(&before, &after, &mut Vec::new()).unwrap_err().category,
            CompareRejectCategory::StateReconstructionFailure
        );
    }
}
