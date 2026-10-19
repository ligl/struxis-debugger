//! Canonical Snapshot metadata and integrity primitives.
//!
//! This module fixes owned persistence DTOs and deterministic checksum inputs.
//! It does not claim to be the SQLite storage backend or publish Snapshots.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub(crate) const STATUS_RECORDING: &str = "Recording";
pub(crate) const STATUS_FINALIZING: &str = "Finalizing";
pub(crate) const STATUS_COMPLETE: &str = "Complete";
pub(crate) const STATUS_FAILED: &str = "Failed";

const SNAPSHOT_HASH_PREFIX: &[u8] = b"capitus.debug-chart.snapshot\0";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SnapshotManifest {
    pub(crate) snapshot_id: String,
    pub(crate) run_id: String,
    pub(crate) state_key: String,
    pub(crate) instrument_id: String,
    pub(crate) bar_type: String,
    pub(crate) input_start_sbar_id: String,
    pub(crate) input_end_sbar_id: String,
    pub(crate) input_start_ts_event: String,
    pub(crate) input_end_ts_event: String,
    pub(crate) snapshot_generated_at: String,
    pub(crate) input_bar_count: usize,
    pub(crate) sbar_sequence_fingerprint: String,
    pub(crate) config_fingerprint: String,
    /// Canonical JSON for the complete resolved effective-config DTO.
    pub(crate) effective_config: String,
    pub(crate) status: String,
    pub(crate) checkpoint_count: usize,
    pub(crate) content_checksum: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SnapshotCheckpointRecord {
    pub(crate) checkpoint_index: usize,
    pub(crate) sbar_id: String,
    pub(crate) ts_event: String,
    pub(crate) record_kind: String,
    /// Canonical owned structure state only; never contains the SBar sequence.
    pub(crate) state_data: String,
    /// Canonical JSON array; empty diagnostics are represented as [].
    pub(crate) diagnostics: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
struct SnapshotManifestChecksumView {
    snapshot_id: String,
    run_id: String,
    state_key: String,
    instrument_id: String,
    bar_type: String,
    input_start_sbar_id: String,
    input_end_sbar_id: String,
    input_start_ts_event: String,
    input_end_ts_event: String,
    snapshot_generated_at: String,
    input_bar_count: String,
    sbar_sequence_fingerprint: String,
    config_fingerprint: String,
    effective_config: serde_json::Value,
    status: String,
    checkpoint_count: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
struct SnapshotCheckpointChecksumView {
    checkpoint_index: String,
    sbar_id: String,
    ts_event: String,
    record_kind: String,
    state_data: serde_json::Value,
    diagnostics: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
struct SnapshotChecksumPayload {
    manifest: SnapshotManifestChecksumView,
    checkpoints: Vec<SnapshotCheckpointChecksumView>,
}

impl SnapshotManifest {
    /// Canonical checksum payload. Field order follows snapshot-compare.md;
    /// integer values are encoded as decimal strings and embedded JSON remains
    /// JSON values rather than being double-encoded strings.
    pub(crate) fn calculate_content_checksum(
        &self,
        checkpoints: &[SnapshotCheckpointRecord],
    ) -> Result<String, String> {
        let effective_config: serde_json::Value = serde_json::from_str(&self.effective_config)
            .map_err(|error| format!("Invalid effective_config JSON for checksum: {error}"))?;
        let mut canonical_checkpoints = Vec::with_capacity(checkpoints.len());
        for checkpoint in checkpoints {
            canonical_checkpoints.push(SnapshotCheckpointChecksumView {
                checkpoint_index: checkpoint.checkpoint_index.to_string(),
                sbar_id: checkpoint.sbar_id.clone(),
                ts_event: checkpoint.ts_event.clone(),
                record_kind: checkpoint.record_kind.clone(),
                state_data: serde_json::from_str(&checkpoint.state_data)
                    .map_err(|error| format!("Invalid state_data JSON for checksum: {error}"))?,
                diagnostics: serde_json::from_str(&checkpoint.diagnostics)
                    .map_err(|error| format!("Invalid diagnostics JSON for checksum: {error}"))?,
            });
        }
        let payload = SnapshotChecksumPayload {
            manifest: SnapshotManifestChecksumView {
                snapshot_id: self.snapshot_id.clone(),
                run_id: self.run_id.clone(),
                state_key: self.state_key.clone(),
                instrument_id: self.instrument_id.clone(),
                bar_type: self.bar_type.clone(),
                input_start_sbar_id: self.input_start_sbar_id.clone(),
                input_end_sbar_id: self.input_end_sbar_id.clone(),
                input_start_ts_event: self.input_start_ts_event.clone(),
                input_end_ts_event: self.input_end_ts_event.clone(),
                snapshot_generated_at: self.snapshot_generated_at.clone(),
                input_bar_count: self.input_bar_count.to_string(),
                sbar_sequence_fingerprint: self.sbar_sequence_fingerprint.clone(),
                config_fingerprint: self.config_fingerprint.clone(),
                effective_config,
                status: self.status.clone(),
                checkpoint_count: self.checkpoint_count.to_string(),
            },
            checkpoints: canonical_checkpoints,
        };
        let encoded = serde_json::to_vec(&payload)
            .map_err(|error| format!("Snapshot checksum encoding failed: {error}"))?;
        let mut input = Vec::with_capacity(SNAPSHOT_HASH_PREFIX.len() + encoded.len());
        input.extend_from_slice(SNAPSHOT_HASH_PREFIX);
        input.extend_from_slice(&encoded);
        Ok(sha256_hex(&input))
    }
}

/// Validates the record relationships and the checksum of a published Snapshot.
pub(crate) fn verify_complete_snapshot(
    manifest: &SnapshotManifest,
    checkpoints: &[SnapshotCheckpointRecord],
) -> Result<(), String> {
    validate_snapshot_records(manifest, checkpoints, true)?;
    let expected = manifest.calculate_content_checksum(checkpoints)?;
    if expected != manifest.content_checksum {
        return Err("Snapshot content_checksum mismatch".to_owned());
    }
    Ok(())
}

pub(crate) fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut output = String::with_capacity(64);
    for byte in digest {
        use std::fmt::Write as _;
        let _ = write!(output, "{byte:02x}");
    }
    output
}

/// Builds canonical Snapshot state_data from the owned structure projection.
///
/// SBar entities are intentionally excluded. Objects are ordered by their oldest
/// SBar anchor, then by numeric domain ID, so the encoding does not depend on the
/// collection's internal iteration implementation.
pub(crate) fn canonical_structure_state(
    structure: Option<&crate::checkpoint::StructureCheckpoint>,
) -> Result<String, String> {
    let mut state = match structure {
        Some(structure) => serde_json::to_value(structure)
            .map_err(|error| format!("Cannot encode structure checkpoint: {error}"))?,
        None => serde_json::json!({
            "cbarCount": 0,
            "cbars": [],
            "swingCount": 0,
            "swings": [],
        }),
    };

    let object = state.as_object_mut()
        .ok_or_else(|| "Structure state must be a JSON object".to_owned())?;
    let cbars = object.get_mut("cbars")
        .and_then(serde_json::Value::as_array_mut)
        .ok_or_else(|| "Structure state cbars must be an array".to_owned())?;
    sort_domain_objects(cbars, "sbarStartId", "cbarId", "CBar")?;
    let swings = object.get_mut("swings")
        .and_then(serde_json::Value::as_array_mut)
        .ok_or_else(|| "Structure state swings must be an array".to_owned())?;
    sort_domain_objects(swings, "sbarStartId", "swingId", "Swing")?;

    serde_json::to_string(&state)
        .map_err(|error| format!("Cannot encode canonical structure state: {error}"))
}

fn parse_canonical_u128(value: &str, field: &str) -> Result<u128, String> {
    let parsed = value.parse::<u128>()
        .map_err(|_| format!("{field} must be an unsigned decimal string"))?;
    if parsed.to_string() != value {
        return Err(format!("{field} must use canonical unsigned decimal encoding"));
    }
    Ok(parsed)
}

fn validate_canonical_structure_state(state: &serde_json::Value) -> Result<(), String> {
    let object = state.as_object()
        .ok_or_else(|| "state_data must be a JSON object".to_owned())?;
    let expected_fields = ["cbarCount", "cbars", "swingCount", "swings"];
    if object.len() != expected_fields.len() || expected_fields.iter().any(|key| !object.contains_key(*key)) {
        return Err("state_data must contain exactly cbarCount, cbars, swingCount, and swings".to_owned());
    }
    let cbars = object["cbars"].as_array()
        .ok_or_else(|| "state_data cbars must be an array".to_owned())?;
    let swings = object["swings"].as_array()
        .ok_or_else(|| "state_data swings must be an array".to_owned())?;
    let cbar_count = object["cbarCount"].as_u64()
        .ok_or_else(|| "state_data cbarCount must be a non-negative JSON integer".to_owned())?;
    let swing_count = object["swingCount"].as_u64()
        .ok_or_else(|| "state_data swingCount must be a non-negative JSON integer".to_owned())?;
    if cbar_count != cbars.len() as u64 {
        return Err("state_data cbarCount does not match cbars length".to_owned());
    }
    if swing_count != swings.len() as u64 {
        return Err("state_data swingCount does not match swings length".to_owned());
    }
    validate_object_fields(
        cbars,
        &["cbarId", "createdAt", "fractalType", "high", "low", "sbarEndId", "sbarStartId", "spanSbars"],
        &["fractalType"],
        &["spanSbars"],
        "CBar",
    )?;
    validate_object_fields(
        swings,
        &["cbarEndId", "cbarStartId", "createdAt", "direction", "endOi", "high", "low", "sbarEndId", "sbarStartId", "spanSbars", "startOi", "state", "swingId", "updatedAt", "volume"],
        &["endOi", "startOi"],
        &["spanSbars"],
        "Swing",
    )?;
    validate_enum_field(cbars, "fractalType", &["Top", "Bottom"], true, "CBar")?;
    validate_enum_field(swings, "direction", &["Up", "Down"], false, "Swing")?;
    validate_enum_field(
        swings,
        "state",
        &["Extending", "Tentative", "Confirmed"],
        false,
        "Swing",
    )?;
    validate_unsigned_string_fields(
        cbars,
        &["cbarId", "createdAt", "sbarEndId", "sbarStartId"],
        "CBar",
    )?;
    validate_unsigned_number_fields(cbars, &["spanSbars"], "CBar")?;
    validate_unsigned_string_fields(
        swings,
        &["cbarEndId", "cbarStartId", "createdAt", "sbarEndId", "sbarStartId", "swingId", "updatedAt"],
        "Swing",
    )?;
    validate_unsigned_number_fields(swings, &["spanSbars"], "Swing")?;
    validate_unique_domain_ids(cbars, "cbarId", "CBar")?;
    validate_unique_domain_ids(swings, "swingId", "Swing")?;
    validate_sorted_domain_objects(cbars, "sbarStartId", "cbarId", "CBar")?;
    validate_sorted_domain_objects(swings, "sbarStartId", "swingId", "Swing")?;
    Ok(())
}

fn validate_enum_field(
    objects: &[serde_json::Value],
    field: &str,
    allowed: &[&str],
    nullable: bool,
    kind: &str,
) -> Result<(), String> {
    for (index, object) in objects.iter().enumerate() {
        let value = object.get(field).ok_or_else(|| {
            format!("{kind} at index {index} is missing enum field {field}")
        })?;
        if nullable && value.is_null() {
            continue;
        }
        let label = value.as_str().ok_or_else(|| {
            format!("{kind}[{index}].{field} must be a string{}", if nullable { " or null" } else { "" })
        })?;
        if !allowed.contains(&label) {
            return Err(format!("{kind}[{index}].{field} has unsupported value {label}"));
        }
    }
    Ok(())
}

fn validate_unsigned_string_fields(
    objects: &[serde_json::Value],
    fields: &[&str],
    kind: &str,
) -> Result<(), String> {
    for (index, object) in objects.iter().enumerate() {
        for field in fields {
            let value = object.get(*field).and_then(serde_json::Value::as_str)
                .ok_or_else(|| format!("{kind} at index {index} is missing string field {field}"))?;
            parse_canonical_u128(value, &format!("{kind}[{index}].{field}"))?;
        }
    }
    Ok(())
}

fn validate_unsigned_number_fields(
    objects: &[serde_json::Value],
    fields: &[&str],
    kind: &str,
) -> Result<(), String> {
    for (index, object) in objects.iter().enumerate() {
        for field in fields {
            let value = object.get(*field).and_then(serde_json::Value::as_u64)
                .ok_or_else(|| format!("{kind} at index {index} is missing non-negative integer field {field}"))?;
            u32::try_from(value)
                .map_err(|_| format!("{kind}[{index}].{field} exceeds u32 range"))?;
        }
    }
    Ok(())
}

fn validate_object_fields(
    objects: &[serde_json::Value],
    expected_fields: &[&str],
    nullable_fields: &[&str],
    number_fields: &[&str],
    kind: &str,
) -> Result<(), String> {
    for (index, object) in objects.iter().enumerate() {
        let fields = object.as_object()
            .ok_or_else(|| format!("{kind} at index {index} must be a JSON object"))?;
        if fields.len() != expected_fields.len()
            || expected_fields.iter().any(|field| !fields.contains_key(*field))
        {
            return Err(format!("{kind} at index {index} has missing or unexpected fields"));
        }
        for field in expected_fields {
            let value = &fields[*field];
            let valid = if number_fields.contains(field) {
                value.as_u64().is_some()
            } else if nullable_fields.contains(field) {
                value.is_null() || value.is_string()
            } else {
                value.is_string()
            };
            if !valid {
                return Err(format!("{kind} field {field} has an invalid JSON type"));
            }
        }
    }
    Ok(())
}

fn validate_unique_domain_ids(
    objects: &[serde_json::Value],
    id_field: &str,
    kind: &str,
) -> Result<(), String> {
    let mut seen = std::collections::BTreeSet::new();
    for (index, object) in objects.iter().enumerate() {
        let id = object.get(id_field).and_then(serde_json::Value::as_str)
            .ok_or_else(|| format!("{kind} at index {index} is missing string field {id_field}"))?;
        if !seen.insert(id) {
            return Err(format!("{kind} contains duplicate domain ID {id}"));
        }
    }
    Ok(())
}

fn validate_sorted_domain_objects(
    objects: &[serde_json::Value],
    anchor_field: &str,
    id_field: &str,
    kind: &str,
) -> Result<(), String> {
    let mut previous: Option<(u128, u128)> = None;
    for object in objects {
        let anchor = object.get(anchor_field).and_then(serde_json::Value::as_str)
            .ok_or_else(|| format!("{kind} is missing string field {anchor_field}"))?
            .parse::<u128>()
            .map_err(|_| format!("{kind} has invalid numeric {anchor_field}"))?;
        let id = object.get(id_field).and_then(serde_json::Value::as_str)
            .ok_or_else(|| format!("{kind} is missing string field {id_field}"))?
            .parse::<u128>()
            .map_err(|_| format!("{kind} has invalid numeric {id_field}"))?;
        let key = (anchor, id);
        if previous.is_some_and(|value| key < value) {
            return Err(format!("state_data {kind} array is not sorted by {anchor_field} and {id_field}"));
        }
        previous = Some(key);
    }
    Ok(())
}

fn sort_domain_objects(
    objects: &mut [serde_json::Value],
    anchor_field: &str,
    id_field: &str,
    kind: &str,
) -> Result<(), String> {
    let mut keys = Vec::with_capacity(objects.len());
    for object in objects.iter() {
        let anchor = object.get(anchor_field).and_then(serde_json::Value::as_str)
            .ok_or_else(|| format!("{kind} is missing string field {anchor_field}"))?;
        let id = object.get(id_field).and_then(serde_json::Value::as_str)
            .ok_or_else(|| format!("{kind} is missing string field {id_field}"))?;
        let anchor = parse_canonical_u128(
            anchor,
            &format!("{kind}.{anchor_field}"),
        )?;
        let id = parse_canonical_u128(
            id,
            &format!("{kind}.{id_field}"),
        )?;
        keys.push((anchor, id));
    }
    let mut order: Vec<usize> = (0..objects.len()).collect();
    order.sort_by_key(|index| keys[*index]);
    let original = objects.to_vec();
    for (target, source) in order.into_iter().enumerate() {
        objects[target] = original[source].clone();
    }
    Ok(())
}

/// Validates persisted relationships without depending on a storage backend.
/// Until the Delta codec and reconstruction validator exist, this validator rejects Delta records.
pub(crate) fn validate_snapshot_records(
    manifest: &SnapshotManifest,
    checkpoints: &[SnapshotCheckpointRecord],
    require_complete: bool,
) -> Result<(), String> {
    let required = [
        ("snapshot_id", manifest.snapshot_id.as_str()),
        ("run_id", manifest.run_id.as_str()),
        ("state_key", manifest.state_key.as_str()),
        ("instrument_id", manifest.instrument_id.as_str()),
        ("bar_type", manifest.bar_type.as_str()),
        ("input_start_sbar_id", manifest.input_start_sbar_id.as_str()),
        ("input_end_sbar_id", manifest.input_end_sbar_id.as_str()),
        ("input_start_ts_event", manifest.input_start_ts_event.as_str()),
        ("input_end_ts_event", manifest.input_end_ts_event.as_str()),
        ("snapshot_generated_at", manifest.snapshot_generated_at.as_str()),
        ("sbar_sequence_fingerprint", manifest.sbar_sequence_fingerprint.as_str()),
        ("config_fingerprint", manifest.config_fingerprint.as_str()),
        ("effective_config", manifest.effective_config.as_str()),
    ];
    for (field, value) in required {
        if value.trim().is_empty() {
            return Err(format!("Snapshot Manifest field {field} is required"));
        }
    }

    if !matches!(
        manifest.status.as_str(),
        STATUS_RECORDING | STATUS_FINALIZING | STATUS_COMPLETE | STATUS_FAILED
    ) {
        return Err(format!("Unsupported Snapshot status {}", manifest.status));
    }

    if manifest.snapshot_generated_at.parse::<u128>().is_err()
        || manifest.snapshot_generated_at.starts_with('+')
        || (manifest.snapshot_generated_at.len() > 1 && manifest.snapshot_generated_at.starts_with('0'))
    {
        return Err("snapshot_generated_at must be a canonical unsigned nanosecond timestamp".to_owned());
    }
    if manifest.sbar_sequence_fingerprint.len() != 64
        || !manifest.sbar_sequence_fingerprint.bytes().all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    {
        return Err("sbar_sequence_fingerprint must be a 64-character lowercase SHA-256 hex digest".to_owned());
    }

    let config: crate::effective_config::EffectiveStruxisConfig =
        serde_json::from_str(&manifest.effective_config)
            .map_err(|error| format!("Invalid effective_config JSON: {error}"))?;
    let canonical_config = serde_json::to_string(&config)
        .map_err(|error| format!("Cannot canonicalize effective_config: {error}"))?;
    if canonical_config != manifest.effective_config {
        return Err("effective_config is not canonical JSON".to_owned());
    }
    let actual_fingerprint = crate::effective_config::fingerprint_canonical_config(&canonical_config)?;
    if actual_fingerprint != manifest.config_fingerprint {
        return Err("config_fingerprint does not match effective_config".to_owned());
    }

    if manifest.input_bar_count != checkpoints.len()
        || manifest.checkpoint_count != checkpoints.len()
    {
        return Err(format!(
            "Checkpoint count mismatch: input={}, manifest={}, actual={}",
            manifest.input_bar_count, manifest.checkpoint_count, checkpoints.len()
        ));
    }
    if checkpoints.is_empty() {
        return Err("Snapshot must contain at least one checkpoint".to_owned());
    }

    let mut previous_ts: Option<u128> = None;
    for (expected_index, checkpoint) in checkpoints.iter().enumerate() {
        if checkpoint.checkpoint_index != expected_index {
            return Err(format!(
                "Checkpoint index must be continuous: expected {expected_index}, got {}",
                checkpoint.checkpoint_index
            ));
        }
        if checkpoint.sbar_id != checkpoint.ts_event {
            return Err(format!(
                "Checkpoint {} violates SBarId == ts_event",
                checkpoint.checkpoint_index
            ));
        }
        let ts_event = parse_canonical_u128(
            &checkpoint.ts_event,
            &format!("checkpoint {} ts_event", checkpoint.checkpoint_index),
        )?;
        if previous_ts.is_some_and(|previous| ts_event <= previous) {
            return Err("Checkpoint ts_event must be strictly increasing".to_owned());
        }
        previous_ts = Some(ts_event);

        if checkpoint.record_kind != "Full" && checkpoint.record_kind != "Delta" {
            return Err(format!("Unsupported record_kind {}", checkpoint.record_kind));
        }
        if checkpoint.record_kind != "Full" {
            return Err(format!(
                "Checkpoint {} uses Delta, but Delta reconstruction is not implemented; only Full records can currently be verified",
                checkpoint.checkpoint_index
            ));
        }
        let state: serde_json::Value = serde_json::from_str(&checkpoint.state_data)
            .map_err(|error| format!("Invalid state_data JSON: {error}"))?;
        validate_canonical_structure_state(&state)?;
        if serde_json::to_string(&state).map_err(|error| error.to_string())? != checkpoint.state_data {
            return Err(format!("Checkpoint {} state_data is not canonical JSON", checkpoint.checkpoint_index));
        }
        crate::diagnostics::validate_canonical_diagnostics_json(&checkpoint.diagnostics)
            .map_err(|error| format!("Checkpoint {} diagnostics: {error}", checkpoint.checkpoint_index))?;
    }

    let first = checkpoints.first().expect("nonempty checked above");
    let last = checkpoints.last().expect("nonempty checked above");
    if manifest.input_start_sbar_id != first.sbar_id
        || manifest.input_start_ts_event != first.ts_event
        || manifest.input_end_sbar_id != last.sbar_id
        || manifest.input_end_ts_event != last.ts_event
    {
        return Err("Manifest input bounds do not match checkpoint bounds".to_owned());
    }
    if require_complete && manifest.status != STATUS_COMPLETE {
        return Err(format!("Snapshot is not Complete (status={})", manifest.status));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn records() -> Vec<SnapshotCheckpointRecord> {
        vec![
            SnapshotCheckpointRecord {
                checkpoint_index: 0,
                sbar_id: "100".into(),
                ts_event: "100".into(),
                record_kind: "Full".into(),
                state_data: r#"{"cbarCount":0,"cbars":[],"swingCount":0,"swings":[]}"#.into(),
                diagnostics: "[]".into(),
            },
            SnapshotCheckpointRecord {
                checkpoint_index: 1,
                sbar_id: "200".into(),
                ts_event: "200".into(),
                record_kind: "Full".into(),
                state_data: r#"{"cbarCount":0,"cbars":[],"swingCount":0,"swings":[]}"#.into(),
                diagnostics: "[]".into(),
            },
        ]
    }

    fn manifest(records: &[SnapshotCheckpointRecord]) -> SnapshotManifest {
        let effective_config = r#"{"enableStructure":true,"structureCbarsCapacity":10000,"structureSwingsCapacity":2000,"structureTrendsCapacity":666}"#.to_owned();
        SnapshotManifest {
            snapshot_id: "snapshot-1".into(),
            run_id: "run-1".into(),
            state_key: "AUD/USD.SIM|300s".into(),
            instrument_id: "AUD/USD.SIM".into(),
            bar_type: "AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL".into(),
            input_start_sbar_id: records.first().unwrap().sbar_id.clone(),
            input_end_sbar_id: records.last().unwrap().sbar_id.clone(),
            input_start_ts_event: records.first().unwrap().ts_event.clone(),
            input_end_ts_event: records.last().unwrap().ts_event.clone(),
            snapshot_generated_at: "1780000000000000000".into(),
            input_bar_count: records.len(),
            sbar_sequence_fingerprint: "a".repeat(64),
            config_fingerprint: crate::effective_config::fingerprint_canonical_config(&effective_config).unwrap(),
            effective_config,
            status: STATUS_COMPLETE.into(),
            checkpoint_count: records.len(),
            content_checksum: String::new(),
        }
    }

    #[test]
    fn canonical_structure_state_sorts_by_numeric_anchor_then_domain_id() {
        let structure = crate::checkpoint::StructureCheckpoint {
            cbar_count: 2,
            cbars: vec![
                crate::checkpoint::CBarCheckpoint {
                    cbar_id: "10".into(), high: "2".into(), low: "1".into(),
                    sbar_start_id: "20".into(), sbar_end_id: "30".into(),
                    span_sbars: 2, fractal_type: None, created_at: "1".into(),
                },
                crate::checkpoint::CBarCheckpoint {
                    cbar_id: "2".into(), high: "2".into(), low: "1".into(),
                    sbar_start_id: "3".into(), sbar_end_id: "4".into(),
                    span_sbars: 2, fractal_type: None, created_at: "1".into(),
                },
            ],
            swing_count: 0,
            swings: vec![],
        };
        let canonical = canonical_structure_state(Some(&structure)).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&canonical).unwrap();
        assert_eq!(parsed["cbars"][0]["cbarId"], "2");
        assert_eq!(parsed["cbars"][1]["cbarId"], "10");
        assert_eq!(parsed["cbarCount"], 2);
        assert_eq!(parsed["swingCount"], 0);
    }

    #[test]
    fn snapshot_validation_rejects_unsorted_structure_state() {
        let unsorted = r#"{"cbarCount":2,"cbars":[{"sbarStartId":"20","cbarId":"10"},{"sbarStartId":"3","cbarId":"2"}],"swingCount":0,"swings":[]}"#;
        let state: serde_json::Value = serde_json::from_str(unsorted).unwrap();
        assert!(validate_canonical_structure_state(&state).is_err());
    }

    #[test]
    fn snapshot_state_requires_numeric_counts_and_span_and_closed_fractal_values() {
        let string_count: serde_json::Value = serde_json::from_str(
            r#"{"cbarCount":"0","cbars":[],"swingCount":0,"swings":[]}"#,
        ).unwrap();
        assert!(validate_canonical_structure_state(&string_count)
            .unwrap_err()
            .contains("cbarCount must be a non-negative JSON integer"));

        let string_span: serde_json::Value = serde_json::from_str(
            r#"{"cbarCount":1,"cbars":[{"cbarId":"1","createdAt":"1","fractalType":null,"high":"2","low":"1","sbarEndId":"3","sbarStartId":"2","spanSbars":"1"}],"swingCount":0,"swings":[]}"#,
        ).unwrap();
        assert!(validate_canonical_structure_state(&string_span)
            .unwrap_err()
            .contains("invalid JSON type"));

        let invalid_fractal: serde_json::Value = serde_json::from_str(
            r#"{"cbarCount":1,"cbars":[{"cbarId":"1","createdAt":"1","fractalType":"Sideways","high":"2","low":"1","sbarEndId":"3","sbarStartId":"2","spanSbars":1}],"swingCount":0,"swings":[]}"#,
        ).unwrap();
        assert!(validate_canonical_structure_state(&invalid_fractal)
            .unwrap_err()
            .contains("unsupported value Sideways"));
    }

    #[test]
    fn snapshot_state_rejects_duplicate_domain_ids() {
        let duplicate_ids: serde_json::Value = serde_json::from_str(
            r#"{"cbarCount":2,"cbars":[{"cbarId":"1","createdAt":"1","fractalType":null,"high":"2","low":"1","sbarEndId":"3","sbarStartId":"2","spanSbars":1},{"cbarId":"1","createdAt":"1","fractalType":null,"high":"3","low":"2","sbarEndId":"4","sbarStartId":"3","spanSbars":1}],"swingCount":0,"swings":[]}"#,
        ).unwrap();
        assert!(validate_canonical_structure_state(&duplicate_ids)
            .unwrap_err()
            .contains("duplicate domain ID 1"));
    }

    #[test]
    fn canonical_structure_state_rejects_noncanonical_domain_ids() {
        let structure = crate::checkpoint::StructureCheckpoint {
            cbar_count: 1,
            cbars: vec![crate::checkpoint::CBarCheckpoint {
                cbar_id: "02".into(),
                high: "2".into(),
                low: "1".into(),
                sbar_start_id: "3".into(),
                sbar_end_id: "4".into(),
                span_sbars: 2,
                fractal_type: None,
                created_at: "1".into(),
            }],
            swing_count: 0,
            swings: vec![],
        };
        assert!(canonical_structure_state(Some(&structure))
            .unwrap_err()
            .contains("canonical unsigned decimal encoding"));
    }

    #[test]
    fn canonical_structure_state_without_structure_is_explicitly_empty() {
        assert_eq!(
            canonical_structure_state(None).unwrap(),
            r#"{"cbarCount":0,"cbars":[],"swingCount":0,"swings":[]}"#,
        );
    }

    #[test]
    fn canonical_json_preserves_integer_types_and_sorts_object_keys() {
        let input: serde_json::Value = serde_json::from_str(
            r#"{"z":1,"a":{"y":2,"b":3},"items":[{"z":1,"a":2},{"b":1,"a":2}]}"#,
        ).unwrap();
        assert_eq!(
            serde_json::to_string(&input).unwrap(),
            r#"{"a":{"b":3,"y":2},"items":[{"a":2,"z":1},{"a":2,"b":1}],"z":1}"#
        );
    }

    #[test]
    fn checksum_encodes_counts_as_strings_and_embedded_state_as_json() {
        let records = records();
        let manifest = manifest(&records);
        let checksum_payload = manifest.calculate_content_checksum(&records).unwrap();
        assert_eq!(checksum_payload.len(), 64);

        let payload = SnapshotChecksumPayload {
            manifest: SnapshotManifestChecksumView {
                snapshot_id: manifest.snapshot_id.clone(),
                run_id: manifest.run_id.clone(),
                state_key: manifest.state_key.clone(),
                instrument_id: manifest.instrument_id.clone(),
                bar_type: manifest.bar_type.clone(),
                input_start_sbar_id: manifest.input_start_sbar_id.clone(),
                input_end_sbar_id: manifest.input_end_sbar_id.clone(),
                input_start_ts_event: manifest.input_start_ts_event.clone(),
                input_end_ts_event: manifest.input_end_ts_event.clone(),
                snapshot_generated_at: manifest.snapshot_generated_at.clone(),
                input_bar_count: manifest.input_bar_count.to_string(),
                sbar_sequence_fingerprint: manifest.sbar_sequence_fingerprint.clone(),
                config_fingerprint: manifest.config_fingerprint.clone(),
                effective_config: serde_json::from_str(&manifest.effective_config).unwrap(),
                status: manifest.status.clone(),
                checkpoint_count: manifest.checkpoint_count.to_string(),
            },
            checkpoints: vec![SnapshotCheckpointChecksumView {
                checkpoint_index: "0".into(),
                sbar_id: "100".into(),
                ts_event: "100".into(),
                record_kind: "Full".into(),
                state_data: serde_json::from_str(&records[0].state_data).unwrap(),
                diagnostics: serde_json::Value::Array(vec![]),
            }],
        };
        let encoded = serde_json::to_string(&payload).unwrap();
        assert!(encoded.contains(r#""input_bar_count":"2""#));
        assert!(encoded.contains(r#""state_data":{"cbarCount":0"#));
        assert!(!encoded.contains(r#""state_data":"{"#));
    }

    #[test]
    fn config_and_snapshot_checksum_match_fixed_vectors() {
        let records = records();
        let manifest = manifest(&records);
        assert_eq!(
            manifest.config_fingerprint,
            "693f71cd1ec54d0c4fafa1afc24505fcf6e73a4d58f8ad6025d9f70b74b2391e"
        );
        assert_eq!(
            manifest.calculate_content_checksum(&records).unwrap(),
            "8996e6056ae7769f70f9fd3acb4329d512f4762e648092c2bc774946434a82c7"
        );
    }

    #[test]
    fn checksum_covers_status_but_excludes_checksum_field() {
        let records = records();
        let mut manifest = manifest(&records);
        let checksum = manifest.calculate_content_checksum(&records).unwrap();
        manifest.content_checksum = checksum.clone();
        assert_eq!(manifest.calculate_content_checksum(&records).unwrap(), checksum);
        manifest.status = STATUS_FAILED.into();
        assert_ne!(manifest.calculate_content_checksum(&records).unwrap(), checksum);
    }

    #[test]
    fn validates_complete_contiguous_records() {
        let records = records();
        let manifest = manifest(&records);
        assert!(validate_snapshot_records(&manifest, &records, true).is_ok());
    }

    #[test]
    fn rejects_missing_manifest_metadata_and_unknown_status() {
        let records = records();
        let mut missing_time = manifest(&records);
        missing_time.snapshot_generated_at.clear();
        assert!(validate_snapshot_records(&missing_time, &records, false)
            .unwrap_err().contains("snapshot_generated_at is required"));

        let mut unknown_status = manifest(&records);
        unknown_status.status = "Recovered".into();
        assert!(validate_snapshot_records(&unknown_status, &records, false)
            .unwrap_err().contains("Unsupported Snapshot status"));
    }

    #[test]
    fn rejects_noncanonical_snapshot_timestamp_and_sequence_fingerprint() {
        let records = records();
        let mut invalid_timestamp = manifest(&records);
        invalid_timestamp.snapshot_generated_at = "01780000000000000000".into();
        assert!(validate_snapshot_records(&invalid_timestamp, &records, false)
            .unwrap_err().contains("canonical unsigned nanosecond timestamp"));

        let mut invalid_fingerprint = manifest(&records);
        invalid_fingerprint.sbar_sequence_fingerprint = "g".repeat(64);
        assert!(validate_snapshot_records(&invalid_fingerprint, &records, false)
            .unwrap_err().contains("lowercase SHA-256 hex digest"));
    }

    #[test]
    fn rejects_noncanonical_checkpoint_timestamps_and_state_ids() {
        let mut timestamp_records = records();
        timestamp_records[1].ts_event = "0200".into();
        timestamp_records[1].sbar_id = "0200".into();
        let timestamp_manifest = manifest(&timestamp_records);
        assert!(validate_snapshot_records(&timestamp_manifest, &timestamp_records, false)
            .unwrap_err().contains("canonical unsigned decimal encoding"));

        let mut state_records = records();
        state_records[0].state_data = r#"{"cbarCount":1,"cbars":[{"cbarId":"01","createdAt":"1","fractalType":null,"high":"1","low":"1","sbarEndId":"100","sbarStartId":"100","spanSbars":1}],"swingCount":0,"swings":[]}"#.into();
        let state_manifest = manifest(&state_records);
        assert!(validate_snapshot_records(&state_manifest, &state_records, false)
            .unwrap_err().contains("canonical unsigned decimal encoding"));
    }

    #[test]
    fn rejects_delta_until_reconstruction_contract_is_implemented() {
        let mut records = records();
        records[1].record_kind = "Delta".into();
        records[1].state_data = r#"{"operations":[]}"#.into();
        let manifest = manifest(&records);
        assert!(validate_snapshot_records(&manifest, &records, true)
            .unwrap_err()
            .contains("Delta reconstruction is not implemented"));
    }

    #[test]
    fn rejects_skipped_checkpoint_index() {
        let mut records = records();
        records[1].checkpoint_index = 2;
        let manifest = manifest(&records);
        assert!(validate_snapshot_records(&manifest, &records, true).unwrap_err().contains("continuous"));
    }

    #[test]
    fn rejects_sbar_id_timestamp_mismatch() {
        let mut records = records();
        records[1].sbar_id = "201".into();
        let manifest = manifest(&records);
        assert!(validate_snapshot_records(&manifest, &records, true).unwrap_err().contains("SBarId == ts_event"));
    }

    #[test]
    fn rejects_noncanonical_config() {
        let records = records();
        let mut manifest = manifest(&records);
        manifest.effective_config = r#"{ "enableStructure": true }"#.into();
        assert!(validate_snapshot_records(&manifest, &records, true).unwrap_err().contains("canonical JSON"));
    }

    #[test]
    fn complete_snapshot_verification_detects_tampering() {
        let mut records = records();
        let mut manifest = manifest(&records);
        manifest.content_checksum = manifest.calculate_content_checksum(&records).unwrap();
        assert!(verify_complete_snapshot(&manifest, &records).is_ok());

        records[1].state_data = r#"{"cbarCount":1,"cbars":[{"cbarId":"1","createdAt":"1","fractalType":null,"high":"1","low":"1","sbarEndId":"100","sbarStartId":"100","spanSbars":1}],"swingCount":0,"swings":[]}"#.into();
        assert!(verify_complete_snapshot(&manifest, &records).unwrap_err().contains("checksum mismatch"));
    }

    #[test]
    fn checkpoint_record_schema_has_no_sbar_entity_fields() {
        let encoded = serde_json::to_string(&records()[0]).unwrap();
        assert!(!encoded.contains("sbars"));
        assert!(!encoded.contains("open"));
        assert!(!encoded.contains("volume"));
    }
}
