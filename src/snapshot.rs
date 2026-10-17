//! Canonical Snapshot metadata and integrity primitives.
//!
//! This module fixes owned persistence DTOs and deterministic checksum inputs.
//! It does not claim to be the SQLite storage backend or publish Snapshots.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const STATUS_RECORDING: &str = "Recording";
pub const STATUS_FINALIZING: &str = "Finalizing";
pub const STATUS_COMPLETE: &str = "Complete";
pub const STATUS_FAILED: &str = "Failed";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotManifest {
    pub snapshot_id: String,
    pub run_id: String,
    pub state_key: String,
    pub instrument_id: String,
    pub bar_type: String,
    pub input_start_sbar_id: String,
    pub input_end_sbar_id: String,
    pub input_start_ts_event: String,
    pub input_end_ts_event: String,
    pub snapshot_generated_at: String,
    pub input_bar_count: usize,
    pub sbar_sequence_fingerprint: String,
    pub config_fingerprint: String,
    /// Canonical JSON for the complete resolved effective-config DTO.
    pub effective_config: String,
    pub status: String,
    pub checkpoint_count: usize,
    pub content_checksum: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotCheckpointRecord {
    pub checkpoint_index: usize,
    pub sbar_id: String,
    pub ts_event: String,
    pub record_kind: String,
    /// Canonical owned structure state only; never contains the SBar sequence.
    pub state_data: String,
    /// Canonical JSON array; empty diagnostics are represented as [].
    pub diagnostics: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SnapshotManifestChecksumView<'a> {
    pub snapshot_id: &'a str,
    pub run_id: &'a str,
    pub state_key: &'a str,
    pub instrument_id: &'a str,
    pub bar_type: &'a str,
    pub input_start_sbar_id: &'a str,
    pub input_end_sbar_id: &'a str,
    pub input_start_ts_event: &'a str,
    pub input_end_ts_event: &'a str,
    pub snapshot_generated_at: &'a str,
    pub input_bar_count: usize,
    pub sbar_sequence_fingerprint: &'a str,
    pub config_fingerprint: &'a str,
    pub effective_config: &'a str,
    pub status: &'a str,
    pub checkpoint_count: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct SnapshotChecksumPayload<'a> {
    pub manifest: SnapshotManifestChecksumView<'a>,
    pub checkpoints: &'a [SnapshotCheckpointRecord],
}

impl SnapshotManifest {
    /// Checksum field is excluded; status remains covered, including Complete.
    pub fn checksum_payload<'a>(
        &'a self,
        checkpoints: &'a [SnapshotCheckpointRecord],
    ) -> SnapshotChecksumPayload<'a> {
        SnapshotChecksumPayload {
            manifest: SnapshotManifestChecksumView {
                snapshot_id: &self.snapshot_id,
                run_id: &self.run_id,
                state_key: &self.state_key,
                instrument_id: &self.instrument_id,
                bar_type: &self.bar_type,
                input_start_sbar_id: &self.input_start_sbar_id,
                input_end_sbar_id: &self.input_end_sbar_id,
                input_start_ts_event: &self.input_start_ts_event,
                input_end_ts_event: &self.input_end_ts_event,
                snapshot_generated_at: &self.snapshot_generated_at,
                input_bar_count: self.input_bar_count,
                sbar_sequence_fingerprint: &self.sbar_sequence_fingerprint,
                config_fingerprint: &self.config_fingerprint,
                effective_config: &self.effective_config,
                status: &self.status,
                checkpoint_count: self.checkpoint_count,
            },
            checkpoints,
        }
    }

    pub fn calculate_content_checksum(
        &self,
        checkpoints: &[SnapshotCheckpointRecord],
    ) -> Result<String, String> {
        let encoded = serde_json::to_vec(&self.checksum_payload(checkpoints))
            .map_err(|error| format!("Snapshot checksum encoding failed: {error}"))?;
        Ok(sha256_hex(&encoded))
    }
}

/// Validates the record relationships and the checksum of a published Snapshot.
pub fn verify_complete_snapshot(
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

pub fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut output = String::with_capacity(64);
    for byte in digest {
        use std::fmt::Write as _;
        let _ = write!(output, "{byte:02x}");
    }
    output
}

/// Validates persisted relationships without depending on a storage backend.
/// Delta dependency reconstruction remains the responsibility of the reader.
pub fn validate_snapshot_records(
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
        ("sbar_sequence_fingerprint", manifest.sbar_sequence_fingerprint.as_str()),
        ("config_fingerprint", manifest.config_fingerprint.as_str()),
        ("effective_config", manifest.effective_config.as_str()),
    ];
    for (field, value) in required {
        if value.trim().is_empty() {
            return Err(format!("Snapshot Manifest field {field} is required"));
        }
    }

    let config: serde_json::Value = serde_json::from_str(&manifest.effective_config)
        .map_err(|error| format!("Invalid effective_config JSON: {error}"))?;
    let canonical_config = serde_json::to_string(&config)
        .map_err(|error| format!("Cannot canonicalize effective_config: {error}"))?;
    if canonical_config != manifest.effective_config {
        return Err("effective_config is not canonical JSON".to_owned());
    }
    if sha256_hex(manifest.effective_config.as_bytes()) != manifest.config_fingerprint {
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
        let ts_event = checkpoint.ts_event.parse::<u128>()
            .map_err(|_| format!("Invalid checkpoint ts_event {}", checkpoint.ts_event))?;
        if previous_ts.is_some_and(|previous| ts_event <= previous) {
            return Err("Checkpoint ts_event must be strictly increasing".to_owned());
        }
        previous_ts = Some(ts_event);

        if checkpoint.record_kind != "Full" && checkpoint.record_kind != "Delta" {
            return Err(format!("Unsupported record_kind {}", checkpoint.record_kind));
        }
        if expected_index == 0 && checkpoint.record_kind != "Full" {
            return Err("First checkpoint must be a Full record".to_owned());
        }
        let state: serde_json::Value = serde_json::from_str(&checkpoint.state_data)
            .map_err(|error| format!("Invalid state_data JSON: {error}"))?;
        if serde_json::to_string(&state).map_err(|error| error.to_string())? != checkpoint.state_data {
            return Err(format!("Checkpoint {} state_data is not canonical JSON", checkpoint.checkpoint_index));
        }
        let diagnostics: serde_json::Value = serde_json::from_str(&checkpoint.diagnostics)
            .map_err(|error| format!("Invalid diagnostics JSON: {error}"))?;
        if !diagnostics.is_array()
            || serde_json::to_string(&diagnostics).map_err(|error| error.to_string())? != checkpoint.diagnostics
        {
            return Err(format!("Checkpoint {} diagnostics must be a canonical JSON array", checkpoint.checkpoint_index));
        }
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
                record_kind: "Delta".into(),
                state_data: r#"{"operations":[]}"#.into(),
                diagnostics: "[]".into(),
            },
        ]
    }

    fn manifest(records: &[SnapshotCheckpointRecord]) -> SnapshotManifest {
        let effective_config = r#"{"enableStructure":true}"#.to_owned();
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
            config_fingerprint: sha256_hex(effective_config.as_bytes()),
            effective_config,
            status: STATUS_COMPLETE.into(),
            checkpoint_count: records.len(),
            content_checksum: String::new(),
        }
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
        let records = records();
        let mut manifest = manifest(&records);
        manifest.content_checksum = manifest.calculate_content_checksum(&records).unwrap();
        assert!(verify_complete_snapshot(&manifest, &records).is_ok());

        manifest.status = STATUS_FAILED.into();
        assert!(verify_complete_snapshot(&manifest, &records).unwrap_err().contains("not Complete"));
    }

    #[test]
    fn checkpoint_record_schema_has_no_sbar_entity_fields() {
        let encoded = serde_json::to_string(&records()[0]).unwrap();
        assert!(!encoded.contains("sbars"));
        assert!(!encoded.contains("open"));
        assert!(!encoded.contains("volume"));
    }
}
