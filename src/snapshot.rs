//! Canonical Snapshot metadata and integrity primitives.
//!
//! This module fixes owned persistence DTOs and deterministic checksum inputs.
//! It does not claim to be the SQLite storage backend or publish Snapshots.

use std::io::{BufWriter, Write};

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
#[cfg(test)]
pub(crate) struct SnapshotCheckpointChecksumView {
    checkpoint_index: String,
    sbar_id: String,
    ts_event: String,
    record_kind: String,
    state_data: serde_json::Value,
    diagnostics: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg(test)]
struct SnapshotChecksumPayload {
    manifest: SnapshotManifestChecksumView,
    checkpoints: Vec<SnapshotCheckpointChecksumView>,
}

impl SnapshotManifest {
    /// Canonical checksum payload. Field order follows snapshot-compare.md;
    /// integer values are encoded as decimal strings and embedded JSON remains
    /// JSON values rather than being double-encoded strings.
    #[cfg(test)]
    pub(crate) fn calculate_content_checksum(
        &self,
        checkpoints: &[SnapshotCheckpointRecord],
    ) -> Result<String, String> {
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
        let effective_config: serde_json::Value = serde_json::from_str(&self.effective_config)
            .map_err(|error| format!("Invalid effective_config JSON for checksum: {error}"))?;
        self.calculate_content_checksum_from_views(effective_config, canonical_checkpoints)
    }

    /// Hashes embedded state and diagnostics JSON verbatim after their canonical form is established.
    pub(crate) fn calculate_content_checksum_from_canonical_records(
        &self,
        checkpoints: &[SnapshotCheckpointRecord],
    ) -> Result<String, String> {
        let effective_config = serde_json::from_str(&self.effective_config)
            .map_err(|error| format!("Invalid effective_config JSON for checksum: {error}"))?;
        let manifest_view = self.checksum_manifest_view(effective_config);
        let mut hasher = Sha256::new();
        hasher.update(SNAPSHOT_HASH_PREFIX);
        {
            let sink = Sha256Writer(&mut hasher);
            let mut writer = BufWriter::with_capacity(64 * 1024, sink);
            writer
                .write_all(b"{\"manifest\":")
                .map_err(|error| format!("Snapshot checksum write failed: {error}"))?;
            serde_json::to_writer(&mut writer, &manifest_view)
                .map_err(|error| format!("Snapshot checksum encoding failed: {error}"))?;
            writer
                .write_all(b",\"checkpoints\":[")
                .map_err(|error| format!("Snapshot checksum write failed: {error}"))?;
            for (index, checkpoint) in checkpoints.iter().enumerate() {
                if index > 0 {
                    writer
                        .write_all(b",")
                        .map_err(|error| format!("Snapshot checksum write failed: {error}"))?;
                }
                writer
                    .write_all(b"{\"checkpoint_index\":")
                    .map_err(|error| format!("Snapshot checksum write failed: {error}"))?;
                serde_json::to_writer(&mut writer, &checkpoint.checkpoint_index.to_string())
                    .map_err(|error| format!("Snapshot checksum encoding failed: {error}"))?;
                writer
                    .write_all(b",\"sbar_id\":")
                    .map_err(|error| format!("Snapshot checksum write failed: {error}"))?;
                serde_json::to_writer(&mut writer, &checkpoint.sbar_id)
                    .map_err(|error| format!("Snapshot checksum encoding failed: {error}"))?;
                writer
                    .write_all(b",\"ts_event\":")
                    .map_err(|error| format!("Snapshot checksum write failed: {error}"))?;
                serde_json::to_writer(&mut writer, &checkpoint.ts_event)
                    .map_err(|error| format!("Snapshot checksum encoding failed: {error}"))?;
                writer
                    .write_all(b",\"record_kind\":")
                    .map_err(|error| format!("Snapshot checksum write failed: {error}"))?;
                serde_json::to_writer(&mut writer, &checkpoint.record_kind)
                    .map_err(|error| format!("Snapshot checksum encoding failed: {error}"))?;
                writer
                    .write_all(b",\"state_data\":")
                    .and_then(|()| writer.write_all(checkpoint.state_data.as_bytes()))
                    .map_err(|error| format!("Snapshot checksum write failed: {error}"))?;
                writer
                    .write_all(b",\"diagnostics\":")
                    .and_then(|()| writer.write_all(checkpoint.diagnostics.as_bytes()))
                    .and_then(|()| writer.write_all(b"}"))
                    .map_err(|error| format!("Snapshot checksum write failed: {error}"))?;
            }
            writer
                .write_all(b"]}")
                .map_err(|error| format!("Snapshot checksum write failed: {error}"))?;
            writer
                .flush()
                .map_err(|error| format!("Snapshot checksum write failed: {error}"))?;
        }
        Ok(digest_hex(&hasher.finalize()))
    }

    #[cfg(test)]
    fn calculate_content_checksum_from_views(
        &self,
        effective_config: serde_json::Value,
        canonical_checkpoints: Vec<SnapshotCheckpointChecksumView>,
    ) -> Result<String, String> {
        let payload = SnapshotChecksumPayload {
            manifest: self.checksum_manifest_view(effective_config),
            checkpoints: canonical_checkpoints,
        };
        let mut hasher = Sha256::new();
        hasher.update(SNAPSHOT_HASH_PREFIX);
        {
            let sink = Sha256Writer(&mut hasher);
            let mut writer = BufWriter::with_capacity(64 * 1024, sink);
            serde_json::to_writer(&mut writer, &payload)
                .map_err(|error| format!("Snapshot checksum encoding failed: {error}"))?;
            writer
                .flush()
                .map_err(|error| format!("Snapshot checksum write failed: {error}"))?;
        }
        Ok(digest_hex(&hasher.finalize()))
    }

    fn checksum_manifest_view(
        &self,
        effective_config: serde_json::Value,
    ) -> SnapshotManifestChecksumView {
        SnapshotManifestChecksumView {
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
        }
    }
}

struct Sha256Writer<'a>(&'a mut Sha256);

impl Write for Sha256Writer<'_> {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        self.0.update(bytes);
        Ok(bytes.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

/// Validates the record relationships and the checksum of a published Snapshot.
pub(crate) fn verify_complete_snapshot(
    manifest: &SnapshotManifest,
    checkpoints: &[SnapshotCheckpointRecord],
) -> Result<(), String> {
    validate_snapshot_records(manifest, checkpoints, true)?;
    let expected = manifest.calculate_content_checksum_from_canonical_records(checkpoints)?;
    if expected != manifest.content_checksum {
        return Err("Snapshot content_checksum mismatch".to_owned());
    }
    Ok(())
}

fn digest_hex(digest: &[u8]) -> String {
    let mut output = String::with_capacity(64);
    for byte in digest {
        use std::fmt::Write as _;
        let _ = write!(output, "{byte:02x}");
    }
    output
}

fn append_json_string(
    value: &impl Serialize,
    output: &mut String,
    scratch: &mut Vec<u8>,
) -> Result<(), String> {
    scratch.clear();
    serde_json::to_writer(&mut *scratch, value)
        .map_err(|error| format!("Cannot encode canonical JSON string: {error}"))?;
    let encoded = std::str::from_utf8(scratch)
        .map_err(|error| format!("Canonical JSON encoder produced invalid UTF-8: {error}"))?;
    output.push_str(encoded);
    Ok(())
}

fn append_sorted_json(
    value: &serde_json::Value,
    output: &mut String,
    scratch: &mut Vec<u8>,
) -> Result<(), String> {
    match value {
        serde_json::Value::Null => output.push_str("null"),
        serde_json::Value::Bool(value) => output.push_str(if *value { "true" } else { "false" }),
        serde_json::Value::Number(value) => append_json_string(value, output, scratch)?,
        serde_json::Value::String(value) => append_json_string(value, output, scratch)?,
        serde_json::Value::Array(values) => {
            output.push('[');
            for (index, value) in values.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                append_sorted_json(value, output, scratch)?;
            }
            output.push(']');
        }
        serde_json::Value::Object(values) => {
            let mut entries: Vec<_> = values.iter().collect();
            entries.sort_unstable_by(|left, right| left.0.cmp(right.0));
            output.push('{');
            for (index, (key, value)) in entries.into_iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                append_json_string(key, output, scratch)?;
                output.push(':');
                append_sorted_json(value, output, scratch)?;
            }
            output.push('}');
        }
    }
    Ok(())
}

fn canonical_json_string(value: &serde_json::Value) -> Result<String, String> {
    let mut output = String::new();
    let mut scratch = Vec::new();
    append_sorted_json(value, &mut output, &mut scratch)?;
    Ok(output)
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
            "trendCount": 0,
            "trends": [],
            "trendCount": 0,
            "trends": [],
        }),
    };

    let object = state
        .as_object_mut()
        .ok_or_else(|| "Structure state must be a JSON object".to_owned())?;
    let cbars = object
        .get_mut("cbars")
        .and_then(serde_json::Value::as_array_mut)
        .ok_or_else(|| "Structure state cbars must be an array".to_owned())?;
    sort_domain_objects(cbars, "sbarStartId", "cbarId", "CBar")?;
    let swings = object
        .get_mut("swings")
        .and_then(serde_json::Value::as_array_mut)
        .ok_or_else(|| "Structure state swings must be an array".to_owned())?;
    sort_domain_objects(swings, "sbarStartId", "swingId", "Swing")?;
    let trends = object
        .get_mut("trends")
        .and_then(serde_json::Value::as_array_mut)
        .ok_or_else(|| "Structure state trends must be an array".to_owned())?;
    sort_domain_objects(trends, "sbarStartId", "trendId", "Trend")?;
    canonical_json_string(&state)
}

fn parse_canonical_u128(value: &str, field: &str) -> Result<u128, String> {
    let parsed = value
        .parse::<u128>()
        .map_err(|_| format!("{field} must be an unsigned decimal string"))?;
    if parsed.to_string() != value {
        return Err(format!(
            "{field} must use canonical unsigned decimal encoding"
        ));
    }
    Ok(parsed)
}

fn validate_canonical_structure_state(state: &serde_json::Value) -> Result<(), String> {
    let object = state
        .as_object()
        .ok_or_else(|| "state_data must be a JSON object".to_owned())?;
    let expected_fields = [
        "cbarCount",
        "cbars",
        "swingCount",
        "swings",
        "trendCount",
        "trends",
    ];
    let has_feature_sequence = object.contains_key("featureSequence");
    let has_keyzones = object.contains_key("keyzones");
    if let Some(keyzones) = object.get("keyzones") {
        validate_keyzone_checkpoint(keyzones)?;
    }
    if object.len()
        != expected_fields.len() + usize::from(has_feature_sequence) + usize::from(has_keyzones)
        || expected_fields.iter().any(|key| !object.contains_key(*key))
    {
        return Err(
            "state_data must contain cbarCount, cbars, swingCount, swings, trendCount, and trends; optional fields are featureSequence and keyzones"
                .to_owned(),
        );
    }
    let cbars = object["cbars"]
        .as_array()
        .ok_or_else(|| "state_data cbars must be an array".to_owned())?;
    let swings = object["swings"]
        .as_array()
        .ok_or_else(|| "state_data swings must be an array".to_owned())?;
    let cbar_count = object["cbarCount"]
        .as_u64()
        .ok_or_else(|| "state_data cbarCount must be a non-negative JSON integer".to_owned())?;
    let swing_count = object["swingCount"]
        .as_u64()
        .ok_or_else(|| "state_data swingCount must be a non-negative JSON integer".to_owned())?;
    let trends = object["trends"]
        .as_array()
        .ok_or_else(|| "state_data trends must be an array".to_owned())?;
    let trend_count = object["trendCount"]
        .as_u64()
        .ok_or_else(|| "state_data trendCount must be a non-negative JSON integer".to_owned())?;
    if cbar_count != cbars.len() as u64 {
        return Err("state_data cbarCount does not match cbars length".to_owned());
    }
    if swing_count != swings.len() as u64 {
        return Err("state_data swingCount does not match swings length".to_owned());
    }
    if trend_count != trends.len() as u64 {
        return Err("state_data trendCount does not match trends length".to_owned());
    }
    validate_object_fields(
        cbars,
        &[
            "cbarId",
            "createdAt",
            "fractalType",
            "high",
            "low",
            "sbarEndId",
            "sbarStartId",
            "spanSbars",
        ],
        &["fractalType"],
        &["spanSbars"],
        "CBar",
    )?;
    validate_object_fields(
        swings,
        &[
            "cbarEndId",
            "cbarStartId",
            "createdAt",
            "direction",
            "endOi",
            "high",
            "low",
            "sbarEndId",
            "sbarStartId",
            "spanSbars",
            "startOi",
            "state",
            "swingId",
            "updatedAt",
            "volume",
        ],
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
    validate_object_fields(
        trends,
        &[
            "createdAt",
            "direction",
            "endOi",
            "high",
            "low",
            "sbarEndId",
            "sbarStartId",
            "spanSbars",
            "startOi",
            "state",
            "swingEndId",
            "swingStartId",
            "trendId",
            "updatedAt",
            "volume",
        ],
        &["endOi", "startOi"],
        &["spanSbars"],
        "Trend",
    )?;
    validate_enum_field(trends, "direction", &["Up", "Down"], false, "Trend")?;
    validate_enum_field(
        trends,
        "state",
        &["Extending", "Tentative", "Confirmed"],
        false,
        "Trend",
    )?;
    validate_unsigned_string_fields(
        cbars,
        &["cbarId", "createdAt", "sbarEndId", "sbarStartId"],
        "CBar",
    )?;
    validate_unsigned_number_fields(cbars, &["spanSbars"], "CBar")?;
    validate_unsigned_string_fields(
        swings,
        &[
            "cbarEndId",
            "cbarStartId",
            "createdAt",
            "sbarEndId",
            "sbarStartId",
            "swingId",
            "updatedAt",
        ],
        "Swing",
    )?;
    validate_unsigned_number_fields(swings, &["spanSbars"], "Swing")?;
    validate_unsigned_string_fields(
        trends,
        &[
            "createdAt",
            "sbarEndId",
            "sbarStartId",
            "swingEndId",
            "swingStartId",
            "trendId",
            "updatedAt",
        ],
        "Trend",
    )?;
    validate_unsigned_number_fields(trends, &["spanSbars"], "Trend")?;
    validate_unique_domain_ids(cbars, "cbarId", "CBar")?;
    validate_unique_domain_ids(swings, "swingId", "Swing")?;
    validate_unique_domain_ids(trends, "trendId", "Trend")?;
    validate_sorted_domain_objects(cbars, "sbarStartId", "cbarId", "CBar")?;
    validate_sorted_domain_objects(swings, "sbarStartId", "swingId", "Swing")?;
    validate_sorted_domain_objects(trends, "sbarStartId", "trendId", "Trend")?;

    if let Some(feature_sequence) = object.get("featureSequence") {
        let features = feature_sequence
            .as_array()
            .ok_or_else(|| "state_data featureSequence must be an array when present".to_owned())?;
        validate_object_fields(
            features,
            &[
                "featureId",
                "high",
                "low",
                "sbarEndId",
                "sbarStartId",
                "sourceEndSwingId",
                "sourceStartSwingId",
            ],
            &[],
            &[],
            "FeatureElement",
        )?;
        validate_unsigned_string_fields(
            features,
            &[
                "sbarEndId",
                "sbarStartId",
                "sourceEndSwingId",
                "sourceStartSwingId",
            ],
            "FeatureElement",
        )?;
        let mut previous_end = None;
        for (index, feature) in features.iter().enumerate() {
            let start = feature["sourceStartSwingId"]
                .as_str()
                .expect("FeatureElement fields were validated")
                .parse::<u128>()
                .map_err(|_| format!("FeatureElement[{index}].sourceStartSwingId is invalid"))?;
            let end = feature["sourceEndSwingId"]
                .as_str()
                .expect("FeatureElement fields were validated")
                .parse::<u128>()
                .map_err(|_| format!("FeatureElement[{index}].sourceEndSwingId is invalid"))?;
            if start > end || previous_end.is_some_and(|previous| start <= previous) {
                return Err(
                    "state_data featureSequence must be ordered by non-overlapping source Swing intervals"
                        .to_owned(),
                );
            }
            previous_end = Some(end);
        }
        validate_unique_domain_ids(features, "featureId", "FeatureElement")?;
    }
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
        let value = object
            .get(field)
            .ok_or_else(|| format!("{kind} at index {index} is missing enum field {field}"))?;
        if nullable && value.is_null() {
            continue;
        }
        let label = value.as_str().ok_or_else(|| {
            format!(
                "{kind}[{index}].{field} must be a string{}",
                if nullable { " or null" } else { "" }
            )
        })?;
        if !allowed.contains(&label) {
            return Err(format!(
                "{kind}[{index}].{field} has unsupported value {label}"
            ));
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
            let value = object
                .get(*field)
                .and_then(serde_json::Value::as_str)
                .ok_or_else(|| {
                    format!("{kind} at index {index} is missing string field {field}")
                })?;
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
            let value = object
                .get(*field)
                .and_then(serde_json::Value::as_u64)
                .ok_or_else(|| {
                    format!("{kind} at index {index} is missing non-negative integer field {field}")
                })?;
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
        let fields = object
            .as_object()
            .ok_or_else(|| format!("{kind} at index {index} must be a JSON object"))?;
        if fields.len() != expected_fields.len()
            || expected_fields
                .iter()
                .any(|field| !fields.contains_key(*field))
        {
            return Err(format!(
                "{kind} at index {index} has missing or unexpected fields"
            ));
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
        let id = object
            .get(id_field)
            .and_then(serde_json::Value::as_str)
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
        let anchor = object
            .get(anchor_field)
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| format!("{kind} is missing string field {anchor_field}"))?
            .parse::<u128>()
            .map_err(|_| format!("{kind} has invalid numeric {anchor_field}"))?;
        let id = object
            .get(id_field)
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| format!("{kind} is missing string field {id_field}"))?
            .parse::<u128>()
            .map_err(|_| format!("{kind} has invalid numeric {id_field}"))?;
        let key = (anchor, id);
        if previous.is_some_and(|value| key < value) {
            return Err(format!(
                "state_data {kind} array is not sorted by {anchor_field} and {id_field}"
            ));
        }
        previous = Some(key);
    }
    Ok(())
}

fn sort_domain_objects(
    objects: &mut Vec<serde_json::Value>,
    anchor_field: &str,
    id_field: &str,
    kind: &str,
) -> Result<(), String> {
    let mut keys = Vec::with_capacity(objects.len());
    for object in objects.iter() {
        let anchor = object
            .get(anchor_field)
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| format!("{kind} is missing string field {anchor_field}"))?;
        let id = object
            .get(id_field)
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| format!("{kind} is missing string field {id_field}"))?;
        let anchor = parse_canonical_u128(anchor, &format!("{kind}.{anchor_field}"))?;
        let id = parse_canonical_u128(id, &format!("{kind}.{id_field}"))?;
        keys.push((anchor, id));
    }
    let mut keyed_objects = keys
        .into_iter()
        .zip(std::mem::take(objects))
        .collect::<Vec<_>>();
    keyed_objects.sort_by_key(|(key, _)| *key);
    objects.extend(keyed_objects.into_iter().map(|(_, object)| object));
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
        (
            "input_start_ts_event",
            manifest.input_start_ts_event.as_str(),
        ),
        ("input_end_ts_event", manifest.input_end_ts_event.as_str()),
        (
            "snapshot_generated_at",
            manifest.snapshot_generated_at.as_str(),
        ),
        (
            "sbar_sequence_fingerprint",
            manifest.sbar_sequence_fingerprint.as_str(),
        ),
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
        || (manifest.snapshot_generated_at.len() > 1
            && manifest.snapshot_generated_at.starts_with('0'))
    {
        return Err(
            "snapshot_generated_at must be a canonical unsigned nanosecond timestamp".to_owned(),
        );
    }
    if manifest.sbar_sequence_fingerprint.len() != 64
        || !manifest
            .sbar_sequence_fingerprint
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    {
        return Err(
            "sbar_sequence_fingerprint must be a 64-character lowercase SHA-256 hex digest"
                .to_owned(),
        );
    }

    let config: crate::effective_config::EffectiveStruxisConfig =
        serde_json::from_str(&manifest.effective_config)
            .map_err(|error| format!("Invalid effective_config JSON: {error}"))?;
    let canonical_config = serde_json::to_string(&config)
        .map_err(|error| format!("Cannot canonicalize effective_config: {error}"))?;
    if canonical_config != manifest.effective_config {
        return Err("effective_config is not canonical JSON".to_owned());
    }
    let actual_fingerprint =
        crate::effective_config::fingerprint_canonical_config(&canonical_config)?;
    if actual_fingerprint != manifest.config_fingerprint {
        return Err("config_fingerprint does not match effective_config".to_owned());
    }

    if manifest.input_bar_count != checkpoints.len()
        || manifest.checkpoint_count != checkpoints.len()
    {
        return Err(format!(
            "Checkpoint count mismatch: input={}, manifest={}, actual={}",
            manifest.input_bar_count,
            manifest.checkpoint_count,
            checkpoints.len()
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
            return Err(format!(
                "Unsupported record_kind {}",
                checkpoint.record_kind
            ));
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

        if canonical_json_string(&state)? != checkpoint.state_data {
            return Err(format!(
                "Checkpoint {} state_data is not canonical JSON",
                checkpoint.checkpoint_index
            ));
        }

        crate::diagnostics::validate_checkpoint_diagnostics_json(
            &checkpoint.diagnostics,
            checkpoint.checkpoint_index,
        )
        .map_err(|error| {
            format!(
                "Checkpoint {} diagnostics: {error}",
                checkpoint.checkpoint_index
            )
        })?;
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
        return Err(format!(
            "Snapshot is not Complete (status={})",
            manifest.status
        ));
    }
    Ok(())
}

pub(crate) fn canonical_checkpoint_state(
    structure: Option<&crate::checkpoint::StructureCheckpoint>,
    keyzones: Option<&crate::checkpoint::KeyZoneCheckpoint>,
) -> Result<String, String> {
    let encoded = canonical_structure_state(structure)?;
    let Some(keyzones) = keyzones else {
        return Ok(encoded);
    };
    let mut state: serde_json::Value = serde_json::from_str(&encoded)
        .map_err(|error| format!("Decode canonical structure: {error}"))?;
    let mut registry = serde_json::to_value(keyzones)
        .map_err(|error| format!("Encode KeyZone checkpoint: {error}"))?;
    validate_keyzone_checkpoint(&registry)?;
    for (collection, identity) in [("zones", "keyzoneId"), ("interactions", "interactionId")] {
        let objects = registry
            .get_mut(collection)
            .and_then(serde_json::Value::as_array_mut)
            .ok_or_else(|| format!("KeyZone {collection} must be an array"))?;
        let mut indexed = objects
            .drain(..)
            .map(|value| {
                let id = value
                    .get(identity)
                    .and_then(serde_json::Value::as_str)
                    .ok_or_else(|| format!("KeyZone {collection} entry is missing {identity}"))?;
                let id = validate_keyzone_integer(id, identity)?;
                Ok((id, value))
            })
            .collect::<Result<Vec<_>, String>>()?;
        indexed.sort_by_key(|(id, _)| *id);
        *objects = indexed.into_iter().map(|(_, value)| value).collect();
    }
    state
        .as_object_mut()
        .ok_or("Checkpoint state must be an object")?
        .insert("keyzones".into(), registry);
    canonical_json_string(&state)
}

fn validate_keyzone_integer(value: &str, field: &str) -> Result<u64, String> {
    let integer = parse_canonical_u128(value, field)?;
    u64::try_from(integer).map_err(|error| format!("{field} exceeds domain integer range: {error}"))
}

fn validate_keyzone_checkpoint(value: &serde_json::Value) -> Result<(), String> {
    use std::collections::BTreeSet;
    let checkpoint: crate::checkpoint::KeyZoneCheckpoint = serde_json::from_value(value.clone())
        .map_err(|error| format!("Invalid KeyZone checkpoint: {error}"))?;
    if checkpoint.instrument_id.is_empty() {
        return Err("Invalid KeyZone Instrument".into());
    }
    let mut zone_ids = BTreeSet::new();
    for zone in &checkpoint.zones {
        let id = validate_keyzone_integer(&zone.keyzone_id, "keyzoneId")?;
        if !zone_ids.insert(id) {
            return Err("Duplicate KeyZone ID".into());
        }
        if !["Provisional", "Finalized", "Invalidated"].contains(&zone.state.as_str())
            || !["Swing", "Trend", "FixedPriceRange"].contains(&zone.origin_kind.as_str())
            || zone.timeframe.is_empty()
        {
            return Err("Invalid KeyZone state or origin".into());
        }
        match (&zone.origin_id, zone.origin_kind.as_str()) {
            (None, "FixedPriceRange") => {}
            (Some(id), "Swing" | "Trend") => {
                validate_keyzone_integer(id, "originId")?;
            }
            _ => return Err("KeyZone origin ID does not match origin kind".into()),
        }
        let lower = zone
            .lower
            .parse::<nautilus_model::types::Price>()
            .map_err(|error| format!("Invalid KeyZone lower: {error}"))?;
        let upper = zone
            .upper
            .parse::<nautilus_model::types::Price>()
            .map_err(|error| format!("Invalid KeyZone upper: {error}"))?;
        capitus_struxis::keyzone::PriceRange::new(lower, upper)
            .map_err(|error| format!("Invalid KeyZone range: {error}"))?;
        if zone.finalized_at.is_some() != zone.finalized_detected_at.is_some()
            || zone.invalidated_at.is_some() != zone.invalidated_detected_at.is_some()
            || (zone.state == "Provisional" && zone.finalized_at.is_some())
            || (zone.state == "Finalized" && zone.finalized_at.is_none())
            || (zone.state == "Invalidated") != zone.invalidated_at.is_some()
        {
            return Err("KeyZone lifecycle state does not match its timestamps".into());
        }
        for (field, time) in [
            ("formedAt", Some(&zone.formed_at)),
            ("createdAt", Some(&zone.created_at)),
            ("finalizedAt", zone.finalized_at.as_ref()),
            ("finalizedDetectedAt", zone.finalized_detected_at.as_ref()),
            ("invalidatedAt", zone.invalidated_at.as_ref()),
            (
                "invalidatedDetectedAt",
                zone.invalidated_detected_at.as_ref(),
            ),
        ] {
            if let Some(time) = time {
                validate_keyzone_integer(time, field)?;
            }
        }
    }
    let mut tasks = std::collections::BTreeMap::new();
    let mut request_ids = BTreeSet::new();
    for task in &checkpoint.observations {
        let id = validate_keyzone_integer(&task.observation_id, "observationId")?;
        let zid = validate_keyzone_integer(&task.keyzone_id, "Observation keyzoneId")?;
        let start = validate_keyzone_integer(&task.start_at, "Observation startAt")?;
        let deadline = validate_keyzone_integer(&task.deadline, "Observation deadline")?;
        validate_keyzone_integer(&task.created_at, "Observation createdAt")?;
        if tasks.insert(id, task).is_some()
            || !zone_ids.contains(&zid)
            || !request_ids.insert((&task.consumer_id, &task.request_id))
            || task.consumer_id.is_empty()
            || task.request_id.is_empty()
            || task.observer.instrument_id != checkpoint.instrument_id
            || task.observer.timeframe.is_empty()
            || start >= deadline
            || !task.config_x.is_finite()
            || task.config_x < 0.0
            || validate_keyzone_integer(&task.config_n, "Observation configN")? == 0
        {
            return Err("Invalid Observation identity, observer, window or configuration".into());
        }
        if !["AfterCurrentCursor", "FromTime"].contains(&task.start_mode.as_str())
            || task.start_exclusive != (task.start_mode == "AfterCurrentCursor")
            || !["AfterOneInteraction", "UntilDeadline"].contains(&task.completion.as_str())
        {
            return Err("Invalid Observation start or completion policy".into());
        }
        if let Some(t) = &task.last_processed_at {
            let t = validate_keyzone_integer(t, "Observation lastProcessedAt")?;
            if t < start || (task.start_exclusive && t == start) || t >= deadline {
                return Err("Observation progress outside window".into());
            }
        }
        let reason = task.reason.as_deref();
        let valid = match task.state.as_str() {
            "Observing" => reason.is_none(),
            "Completed" => matches!(reason, Some("InteractionCompleted" | "Deadline")),
            "Cancelled" => reason == Some("Cancelled"),
            "SourceInvalidated" => reason == Some("SourceInvalidated"),
            _ => false,
        };
        let terminal = task.state != "Observing";
        if !valid
            || task.terminal_at.is_some() != terminal
            || task.terminal_detected_at.is_some() != terminal
        {
            return Err("Observation state does not match termination facts".into());
        }
        if let Some(t) = &task.terminal_at {
            let time = validate_keyzone_integer(t, "Observation terminalAt")?;
            if reason == Some("Deadline") && time != deadline {
                return Err("Observation deadline reason disagrees with terminal position".into());
            }
        }
        if let Some(t) = &task.terminal_detected_at {
            validate_keyzone_integer(t, "Observation terminalDetectedAt")?;
        }
        let zone = checkpoint
            .zones
            .iter()
            .find(|z| z.keyzone_id == task.keyzone_id)
            .ok_or_else(|| "Missing Observation KeyZone".to_owned())?;
        if (task.state == "Observing" && zone.state == "Invalidated")
            || (task.state == "SourceInvalidated" && zone.state != "Invalidated")
        {
            return Err("Observation disagrees with source validity".into());
        }
    }
    let mut active_tasks = BTreeSet::new();
    let mut task_interactions =
        std::collections::BTreeMap::<u64, Vec<&crate::checkpoint::KeyZoneInteraction>>::new();
    let mut ids = BTreeSet::new();
    for interaction in &checkpoint.interactions {
        let id = validate_keyzone_integer(&interaction.interaction_id, "interactionId")?;
        let zone_id = validate_keyzone_integer(&interaction.keyzone_id, "interaction keyzoneId")?;
        if !ids.insert(id) || !zone_ids.contains(&zone_id) {
            return Err("Invalid Interaction identity or KeyZone reference".into());
        }
        if !["Active", "Ended", "Invalidated", "Interrupted"].contains(&interaction.state.as_str())
            || interaction.observer_timeframe.is_empty()
            || !interaction.config_x.is_finite()
            || interaction.config_x < 0.0
            || validate_keyzone_integer(&interaction.config_n, "Interaction configN")? == 0
        {
            return Err("Invalid Interaction configuration or state".into());
        }
        let task_id =
            validate_keyzone_integer(&interaction.observation_id, "Interaction observationId")?;
        let task = tasks
            .get(&task_id)
            .ok_or_else(|| "Unknown Interaction Observation".to_owned())?;
        if interaction.keyzone_id != task.keyzone_id
            || interaction.observer != task.observer
            || interaction.observer_timeframe != task.observer.timeframe
            || interaction.config_n != task.config_n
            || interaction.config_x != task.config_x
        {
            return Err("Interaction disagrees with Observation".into());
        }
        if interaction.state == "Active"
            && (task.state != "Observing" || !active_tasks.insert(task_id))
        {
            return Err("Invalid active Interaction ownership".into());
        }
        let interrupted = interaction.state == "Interrupted";
        if interaction.interrupted_at.is_some() != interrupted
            || interaction.interrupted_detected_at.is_some() != interrupted
            || interaction.interruption_reason.is_some() != interrupted
            || (interrupted
                && (!matches!(
                    interaction.interruption_reason.as_deref(),
                    Some("Cancelled" | "Deadline")
                ) || interaction.interruption_reason != task.reason))
        {
            return Err("Invalid Interaction interruption facts".into());
        }
        if interaction.state == "Invalidated"
            && (task.state != "SourceInvalidated" || interaction.invalidated_at != task.terminal_at)
        {
            return Err("Invalidated Interaction disagrees with task termination".into());
        }
        if interaction.state == "Interrupted" && interaction.interrupted_at != task.terminal_at {
            return Err("Interrupted Interaction disagrees with task termination".into());
        }
        if interaction.last_processed_at.is_none() {
            return Err("Observed Interaction missing actual progress".into());
        }
        if interaction.state == "Ended" && interaction.ended_at != interaction.last_processed_at {
            return Err("Ended Interaction disagrees with actual progress".into());
        }
        let start = validate_keyzone_integer(&interaction.started_at, "Interaction startedAt")?;
        let task_start = validate_keyzone_integer(&task.start_at, "Observation startAt")?;
        let deadline = validate_keyzone_integer(&task.deadline, "Observation deadline")?;
        if start < task_start || (task.start_exclusive && start == task_start) || start >= deadline
        {
            return Err("Interaction starts outside Observation window".into());
        }
        if let Some(t) = &interaction.last_processed_at {
            let end = validate_keyzone_integer(t, "Interaction lastProcessedAt")?;
            if end < start || end >= deadline {
                return Err("Interaction progress outside window".into());
            }
        }
        if let Some(t) = &interaction.interrupted_at {
            validate_keyzone_integer(t, "Interaction interruptedAt")?;
        }
        if let Some(t) = &interaction.interrupted_detected_at {
            validate_keyzone_integer(t, "Interaction interruptedDetectedAt")?;
        }
        task_interactions
            .entry(task_id)
            .or_default()
            .push(interaction);

        if interaction.ended_at.is_some() != interaction.ended_detected_at.is_some()
            || interaction.invalidated_at.is_some() != interaction.invalidated_detected_at.is_some()
            || (interaction.state == "Ended") != interaction.ended_at.is_some()
            || (interaction.state == "Invalidated") != interaction.invalidated_at.is_some()
        {
            return Err("Interaction lifecycle state does not match its timestamps".into());
        }
        validate_keyzone_integer(&interaction.outside_count, "outsideCount")?;
        for (field, time) in [
            ("startedAt", Some(&interaction.started_at)),
            ("startedDetectedAt", Some(&interaction.started_detected_at)),
            ("lastProcessedAt", interaction.last_processed_at.as_ref()),
            ("endedAt", interaction.ended_at.as_ref()),
            ("endedDetectedAt", interaction.ended_detected_at.as_ref()),
            ("invalidatedAt", interaction.invalidated_at.as_ref()),
            (
                "invalidatedDetectedAt",
                interaction.invalidated_detected_at.as_ref(),
            ),
        ] {
            if let Some(time) = time {
                validate_keyzone_integer(time, field)?;
            }
        }
    }
    for (id, episodes) in &task_interactions {
        let mut keyed = episodes
            .iter()
            .map(|i| {
                Ok((
                    validate_keyzone_integer(&i.started_at, "Interaction startedAt")?,
                    *i,
                ))
            })
            .collect::<Result<Vec<_>, String>>()?;
        keyed.sort_by_key(|(time, _)| *time);
        let episodes = keyed
            .into_iter()
            .map(|(_, episode)| episode)
            .collect::<Vec<_>>();
        for pair in episodes.windows(2) {
            let previous = pair[0]
                .last_processed_at
                .as_deref()
                .ok_or_else(|| "Interaction missing progress".to_owned())?;
            if validate_keyzone_integer(previous, "Interaction lastProcessedAt")?
                >= validate_keyzone_integer(&pair[1].started_at, "Interaction startedAt")?
            {
                return Err("Observation episodes overlap".into());
            }
        }
        let task = tasks
            .get(id)
            .ok_or_else(|| "Unknown Observation".to_owned())?;
        if task.completion == "AfterOneInteraction" && episodes.len() > 1 {
            return Err("One-interaction Observation contains multiple episodes".into());
        }
        if task.reason.as_deref() == Some("InteractionCompleted")
            && (episodes.len() != 1
                || episodes[0].state != "Ended"
                || task.terminal_at != episodes[0].ended_at)
        {
            return Err("Observation completion disagrees with episode".into());
        }
    }

    for (id, task) in &tasks {
        if task.reason.as_deref() == Some("InteractionCompleted")
            && !task_interactions.contains_key(id)
        {
            return Err("Completed Observation has no Interaction".into());
        }
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
                state_data: r#"{"cbarCount":0,"cbars":[],"swingCount":0,"swings":[],"trendCount":0,"trends":[]}"#.into(),
                diagnostics: "[]".into(),
            },
            SnapshotCheckpointRecord {
                checkpoint_index: 1,
                sbar_id: "200".into(),
                ts_event: "200".into(),
                record_kind: "Full".into(),
                state_data: r#"{"cbarCount":0,"cbars":[],"swingCount":0,"swings":[],"trendCount":0,"trends":[]}"#.into(),
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
            config_fingerprint: crate::effective_config::fingerprint_canonical_config(
                &effective_config,
            )
            .unwrap(),
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
                    cbar_id: "10".into(),
                    high: "2".into(),
                    low: "1".into(),
                    sbar_start_id: "20".into(),
                    sbar_end_id: "30".into(),
                    span_sbars: 2,
                    fractal_type: None,
                    created_at: "1".into(),
                },
                crate::checkpoint::CBarCheckpoint {
                    cbar_id: "2".into(),
                    high: "2".into(),
                    low: "1".into(),
                    sbar_start_id: "3".into(),
                    sbar_end_id: "4".into(),
                    span_sbars: 2,
                    fractal_type: None,
                    created_at: "1".into(),
                },
            ],
            swing_count: 0,
            swings: vec![],
            trend_count: 0,
            trends: vec![],
            feature_sequence: None,
        };
        let canonical = canonical_structure_state(Some(&structure)).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&canonical).unwrap();
        assert_eq!(parsed["cbars"][0]["cbarId"], "2");
        assert_eq!(parsed["cbars"][1]["cbarId"], "10");
        assert_eq!(parsed["cbarCount"], 2);
        assert_eq!(parsed["swingCount"], 0);
        assert_eq!(parsed["trendCount"], 0);
    }

    #[test]
    fn snapshot_validation_rejects_unsorted_structure_state() {
        let unsorted = r#"{"cbarCount":2,"cbars":[{"sbarStartId":"20","cbarId":"10"},{"sbarStartId":"3","cbarId":"2"}],"swingCount":0,"swings":[],"trendCount":0,"trends":[]}"#;
        let state: serde_json::Value = serde_json::from_str(unsorted).unwrap();
        assert!(validate_canonical_structure_state(&state).is_err());
    }

    #[test]
    fn snapshot_state_requires_numeric_counts_and_span_and_closed_fractal_values() {
        let string_count: serde_json::Value = serde_json::from_str(
            r#"{"cbarCount":"0","cbars":[],"swingCount":0,"swings":[],"trendCount":0,"trends":[]}"#,
        )
        .unwrap();
        assert!(
            validate_canonical_structure_state(&string_count)
                .unwrap_err()
                .contains("cbarCount must be a non-negative JSON integer")
        );

        let string_span: serde_json::Value = serde_json::from_str(
            r#"{"cbarCount":1,"cbars":[{"cbarId":"1","createdAt":"1","fractalType":null,"high":"2","low":"1","sbarEndId":"3","sbarStartId":"2","spanSbars":"1"}],"swingCount":0,"swings":[],"trendCount":0,"trends":[]}"#,
        ).unwrap();
        assert!(
            validate_canonical_structure_state(&string_span)
                .unwrap_err()
                .contains("invalid JSON type")
        );

        let invalid_fractal: serde_json::Value = serde_json::from_str(
            r#"{"cbarCount":1,"cbars":[{"cbarId":"1","createdAt":"1","fractalType":"Sideways","high":"2","low":"1","sbarEndId":"3","sbarStartId":"2","spanSbars":1}],"swingCount":0,"swings":[],"trendCount":0,"trends":[]}"#,
        ).unwrap();
        assert!(
            validate_canonical_structure_state(&invalid_fractal)
                .unwrap_err()
                .contains("unsupported value Sideways")
        );
    }

    #[test]
    fn snapshot_state_rejects_duplicate_domain_ids() {
        let duplicate_ids: serde_json::Value = serde_json::from_str(
            r#"{"cbarCount":2,"cbars":[{"cbarId":"1","createdAt":"1","fractalType":null,"high":"2","low":"1","sbarEndId":"3","sbarStartId":"2","spanSbars":1},{"cbarId":"1","createdAt":"1","fractalType":null,"high":"3","low":"2","sbarEndId":"4","sbarStartId":"3","spanSbars":1}],"swingCount":0,"swings":[],"trendCount":0,"trends":[]}"#,
        ).unwrap();
        assert!(
            validate_canonical_structure_state(&duplicate_ids)
                .unwrap_err()
                .contains("duplicate domain ID 1")
        );
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
            trend_count: 0,
            trends: vec![],
            feature_sequence: None,
        };
        assert!(
            canonical_structure_state(Some(&structure))
                .unwrap_err()
                .contains("canonical unsigned decimal encoding")
        );
    }

    #[test]
    fn canonical_structure_state_without_structure_is_explicitly_empty() {
        assert_eq!(
            canonical_structure_state(None).unwrap(),
            r#"{"cbarCount":0,"cbars":[],"swingCount":0,"swings":[],"trendCount":0,"trends":[]}"#,
        );
    }

    #[test]
    fn snapshot_state_requires_trend_fields_and_rejects_legacy_schema() {
        let legacy: serde_json::Value =
            serde_json::from_str(r#"{"cbarCount":0,"cbars":[],"swingCount":0,"swings":[]}"#)
                .unwrap();
        assert!(
            validate_canonical_structure_state(&legacy)
                .unwrap_err()
                .contains("trendCount, and trends")
        );

        let inconsistent: serde_json::Value = serde_json::from_str(
            r#"{"cbarCount":0,"cbars":[],"swingCount":0,"swings":[],"trendCount":1,"trends":[]}"#,
        )
        .unwrap();
        assert!(
            validate_canonical_structure_state(&inconsistent)
                .unwrap_err()
                .contains("trendCount does not match trends length")
        );
    }

    #[test]
    fn snapshot_state_validates_trend_fields_and_enum_values() {
        let valid: serde_json::Value = serde_json::from_str(
            r#"{"cbarCount":0,"cbars":[],"swingCount":0,"swings":[],"trendCount":1,"trends":[{"createdAt":"1","direction":"Up","endOi":null,"high":"12.5","low":"10.5","sbarEndId":"8","sbarStartId":"2","spanSbars":7,"startOi":null,"state":"Tentative","swingEndId":"7","swingStartId":"3","trendId":"4","updatedAt":"9","volume":"123.25"}]}"#,
        ).unwrap();
        assert!(validate_canonical_structure_state(&valid).is_ok());

        let invalid_direction: serde_json::Value = serde_json::from_str(
            r#"{"cbarCount":0,"cbars":[],"swingCount":0,"swings":[],"trendCount":1,"trends":[{"createdAt":"1","direction":"Sideways","endOi":null,"high":"12.5","low":"10.5","sbarEndId":"8","sbarStartId":"2","spanSbars":7,"startOi":null,"state":"Tentative","swingEndId":"7","swingStartId":"3","trendId":"4","updatedAt":"9","volume":"123.25"}]}"#,
        ).unwrap();
        assert!(
            validate_canonical_structure_state(&invalid_direction)
                .unwrap_err()
                .contains("unsupported value Sideways")
        );
    }

    #[test]
    fn canonical_json_preserves_integer_types_and_sorts_object_keys() {
        let value: serde_json::Value = serde_json::from_str(
            r#"{"z":1,"a":{"y":2,"b":3},"items":[{"z":1,"a":2},{"b":1,"a":2}]}"#,
        )
        .unwrap();
        assert_eq!(
            canonical_json_string(&value).unwrap(),
            r#"{"a":{"b":3,"y":2},"items":[{"a":2,"z":1},{"a":2,"b":1}],"z":1}"#
        );
    }

    #[test]
    fn persisted_manifest_and_checkpoint_positions_are_json_numbers() {
        let records = records();
        let manifest = manifest(&records);
        let manifest_json = serde_json::to_string(&manifest).unwrap();
        let checkpoint_json = serde_json::to_string(&records[0]).unwrap();

        assert!(manifest_json.contains(r#""inputBarCount":2"#));
        assert!(manifest_json.contains(r#""checkpointCount":2"#));
        assert!(checkpoint_json.contains(r#""checkpointIndex":0"#));
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
        assert!(encoded.contains(r#""checkpoint_index":"0""#));
        assert!(encoded.contains(r#""state_data":{"cbarCount":0"#));
        assert!(!encoded.contains(r#""cbarCount":"0""#));
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
            "c128c174ec3ea38247aed9f874d0f50c9a9fdcf244163ba5e2f78d2b700165e2"
        );
        assert_eq!(
            manifest
                .calculate_content_checksum_from_canonical_records(&records)
                .unwrap(),
            "c128c174ec3ea38247aed9f874d0f50c9a9fdcf244163ba5e2f78d2b700165e2"
        );
    }

    #[test]
    fn raw_checksum_matches_value_checksum_for_canonical_nested_json() {
        let mut records = records();
        records[0].state_data = r#"{"cbarCount":1,"cbars":[{"cbarId":"1","createdAt":"2","fractalType":null,"high":"3","low":"1","sbarEndId":"4","sbarStartId":"2","spanSbars":2}],"swingCount":0,"swings":[],"trendCount":0,"trends":[]}"#.into();
        let manifest = manifest(&records);

        assert_eq!(
            manifest
                .calculate_content_checksum_from_canonical_records(&records)
                .unwrap(),
            manifest.calculate_content_checksum(&records).unwrap(),
        );
    }

    #[test]
    fn checksum_covers_status_but_excludes_checksum_field() {
        let records = records();
        let mut manifest = manifest(&records);
        let checksum = manifest.calculate_content_checksum(&records).unwrap();
        manifest.content_checksum = checksum.clone();
        assert_eq!(
            manifest.calculate_content_checksum(&records).unwrap(),
            checksum
        );
        manifest.status = STATUS_FAILED.into();
        assert_ne!(
            manifest.calculate_content_checksum(&records).unwrap(),
            checksum
        );
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
        assert!(
            validate_snapshot_records(&missing_time, &records, false)
                .unwrap_err()
                .contains("snapshot_generated_at is required")
        );

        let mut unknown_status = manifest(&records);
        unknown_status.status = "Recovered".into();
        assert!(
            validate_snapshot_records(&unknown_status, &records, false)
                .unwrap_err()
                .contains("Unsupported Snapshot status")
        );
    }

    #[test]
    fn rejects_noncanonical_snapshot_timestamp_and_sequence_fingerprint() {
        let records = records();
        let mut invalid_timestamp = manifest(&records);
        invalid_timestamp.snapshot_generated_at = "01780000000000000000".into();
        assert!(
            validate_snapshot_records(&invalid_timestamp, &records, false)
                .unwrap_err()
                .contains("canonical unsigned nanosecond timestamp")
        );

        let mut invalid_fingerprint = manifest(&records);
        invalid_fingerprint.sbar_sequence_fingerprint = "g".repeat(64);
        assert!(
            validate_snapshot_records(&invalid_fingerprint, &records, false)
                .unwrap_err()
                .contains("lowercase SHA-256 hex digest")
        );
    }

    #[test]
    fn rejects_noncanonical_checkpoint_timestamps_and_state_ids() {
        let mut timestamp_records = records();
        timestamp_records[1].ts_event = "0200".into();
        timestamp_records[1].sbar_id = "0200".into();
        let timestamp_manifest = manifest(&timestamp_records);
        assert!(
            validate_snapshot_records(&timestamp_manifest, &timestamp_records, false)
                .unwrap_err()
                .contains("canonical unsigned decimal encoding")
        );

        let mut state_records = records();
        state_records[0].state_data = r#"{"cbarCount":1,"cbars":[{"cbarId":"01","createdAt":"1","fractalType":null,"high":"1","low":"1","sbarEndId":"100","sbarStartId":"100","spanSbars":1}],"swingCount":0,"swings":[],"trendCount":0,"trends":[]}"#.into();
        let state_manifest = manifest(&state_records);
        assert!(
            validate_snapshot_records(&state_manifest, &state_records, false)
                .unwrap_err()
                .contains("canonical unsigned decimal encoding")
        );
    }

    #[test]
    fn rejects_delta_until_reconstruction_contract_is_implemented() {
        let mut records = records();
        records[1].record_kind = "Delta".into();
        records[1].state_data = r#"{"operations":[]}"#.into();
        let manifest = manifest(&records);
        assert!(
            validate_snapshot_records(&manifest, &records, true)
                .unwrap_err()
                .contains("Delta reconstruction is not implemented")
        );
    }

    #[test]
    fn rejects_skipped_checkpoint_index() {
        let mut records = records();
        records[1].checkpoint_index = 2;
        let manifest = manifest(&records);
        assert!(
            validate_snapshot_records(&manifest, &records, true)
                .unwrap_err()
                .contains("continuous")
        );
    }

    #[test]
    fn rejects_diagnostic_associated_with_another_checkpoint() {
        let mut records = records();
        records[0].diagnostics = r#"[{"source":"struxis","severity":"warning","category":"example","objectType":null,"objectId":null,"sbarIds":[],"checkpointIndex":1,"message":"example"}]"#.into();
        let manifest = manifest(&records);
        assert!(
            validate_snapshot_records(&manifest, &records, false)
                .unwrap_err()
                .contains("does not match enclosing checkpointIndex")
        );
    }

    #[test]
    fn rejects_sbar_id_timestamp_mismatch() {
        let mut records = records();
        records[1].sbar_id = "201".into();
        let manifest = manifest(&records);
        assert!(
            validate_snapshot_records(&manifest, &records, true)
                .unwrap_err()
                .contains("SBarId == ts_event")
        );
    }

    #[test]
    fn rejects_noncanonical_config() {
        let records = records();
        let mut manifest = manifest(&records);
        // Keep the config schema valid; only violate canonical JSON encoding.
        manifest.effective_config.push(' ');
        assert!(
            validate_snapshot_records(&manifest, &records, true)
                .unwrap_err()
                .contains("canonical JSON")
        );
    }

    #[test]
    fn complete_snapshot_verification_detects_tampering() {
        let mut records = records();
        let mut manifest = manifest(&records);
        manifest.content_checksum = manifest
            .calculate_content_checksum_from_canonical_records(&records)
            .unwrap();
        assert!(verify_complete_snapshot(&manifest, &records).is_ok());

        records[1].state_data = r#"{"cbarCount":1,"cbars":[{"cbarId":"1","createdAt":"1","fractalType":null,"high":"1","low":"1","sbarEndId":"100","sbarStartId":"100","spanSbars":1}],"swingCount":0,"swings":[],"trendCount":0,"trends":[]}"#.into();
        assert!(
            verify_complete_snapshot(&manifest, &records)
                .unwrap_err()
                .contains("checksum mismatch")
        );
    }

    #[test]
    fn checkpoint_record_schema_has_no_sbar_entity_fields() {
        let encoded = serde_json::to_string(&records()[0]).unwrap();
        assert!(!encoded.contains("sbars"));
        assert!(!encoded.contains("open"));
        assert!(!encoded.contains("volume"));
    }

    #[test]
    fn accepts_optional_feature_sequence_with_ordered_source_intervals() {
        let state = serde_json::json!({
            "cbarCount": 0,
            "cbars": [],
            "swingCount": 0,
            "swings": [],
            "trendCount": 0,
            "trends": [],
            "featureSequence": [{
                "featureId": "20:40",
                "high": "123.450",
                "low": "120.125",
                "sourceStartSwingId": "20",
                "sourceEndSwingId": "40",
                "sbarStartId": "200",
                "sbarEndId": "400"
            }, {
                "featureId": "60:80",
                "high": "124.000",
                "low": "121.000",
                "sourceStartSwingId": "60",
                "sourceEndSwingId": "80",
                "sbarStartId": "600",
                "sbarEndId": "800"
            }]
        });
        assert!(validate_canonical_structure_state(&state).is_ok());
    }

    #[test]
    fn rejects_overlapping_feature_source_intervals() {
        let state = serde_json::json!({
            "cbarCount": 0,
            "cbars": [],
            "swingCount": 0,
            "swings": [],
            "trendCount": 0,
            "trends": [],
            "featureSequence": [{
                "featureId": "20:60",
                "high": "123",
                "low": "120",
                "sourceStartSwingId": "20",
                "sourceEndSwingId": "60",
                "sbarStartId": "200",
                "sbarEndId": "600"
            }, {
                "featureId": "40:80",
                "high": "124",
                "low": "121",
                "sourceStartSwingId": "40",
                "sourceEndSwingId": "80",
                "sbarStartId": "400",
                "sbarEndId": "800"
            }]
        });
        assert!(
            validate_canonical_structure_state(&state)
                .unwrap_err()
                .contains("non-overlapping")
        );
    }
}

#[cfg(test)]
mod keyzone_snapshot_tests {
    use super::*;
    use crate::checkpoint::keyzone_projection_tests::fixed_projection;

    #[test]
    fn keyzone_observation_recording_validates_tasks_interruption_and_rejects_old_model() {
        let value = serde_json::to_value(
            crate::checkpoint::keyzone_projection_tests::observation_projection(),
        )
        .unwrap();
        assert!(validate_keyzone_checkpoint(&value).is_ok());
        let mut unknown = value.clone();
        unknown["interactions"][0]["observationId"] = serde_json::json!("999");
        assert!(validate_keyzone_checkpoint(&unknown).is_err());
        let mut invalid = value.clone();
        invalid["observations"][0]["observer"]["instrumentId"] = serde_json::json!("EUR/USD.SIM");
        assert!(validate_keyzone_checkpoint(&invalid).is_err());
        let mut reason = value.clone();
        reason["interactions"][1]["interruptionReason"] = serde_json::json!("Deadline");
        assert!(validate_keyzone_checkpoint(&reason).is_err());
        let mut legacy = serde_json::to_value(fixed_projection()).unwrap();
        legacy.as_object_mut().unwrap().remove("observations");
        legacy["configN"] = serde_json::json!("3");
        legacy["configX"] = serde_json::json!(0.5);
        assert!(validate_keyzone_checkpoint(&legacy).is_err());
        legacy["observations"] = serde_json::Value::Null;
        assert!(validate_keyzone_checkpoint(&legacy).is_err());
        let mut global_config = value.clone();
        global_config["configN"] = serde_json::json!("3");
        assert!(validate_keyzone_checkpoint(&global_config).is_err());
        let mut missing_observer = value.clone();
        missing_observer["interactions"][0]
            .as_object_mut()
            .unwrap()
            .remove("observer");
        assert!(validate_keyzone_checkpoint(&missing_observer).is_err());
        let mut missing = value.clone();
        missing.as_object_mut().unwrap().remove("observations");
        assert!(validate_keyzone_checkpoint(&missing).is_err());
        let mut unowned = value.clone();
        unowned["interactions"][0]
            .as_object_mut()
            .unwrap()
            .remove("observationId");
        assert!(validate_keyzone_checkpoint(&unowned).is_err());
        let mut old_binding = value.clone();
        old_binding["interactions"][0]["observerBarType"] =
            serde_json::json!("AUD/USD.SIM-1-MINUTE-LAST-EXTERNAL");
        assert!(validate_keyzone_checkpoint(&old_binding).is_err());
        let mut overlap = value.clone();
        let mut extra = overlap["interactions"][0].clone();
        extra["interactionId"] = serde_json::json!("999");
        overlap["interactions"].as_array_mut().unwrap().push(extra);
        assert!(validate_keyzone_checkpoint(&overlap).is_err());
    }

    #[test]
    fn keyzone_snapshot_distinguishes_legacy_missing_and_recorded_empty() {
        let legacy = canonical_checkpoint_state(None, None).unwrap();
        assert!(!legacy.contains("keyzones"));
        let mut registry = fixed_projection();
        registry.zones.clear();
        let current = canonical_checkpoint_state(None, Some(&registry)).unwrap();
        let state: serde_json::Value = serde_json::from_str(&current).unwrap();
        validate_canonical_structure_state(&state).unwrap();
        assert_eq!(state["keyzones"]["zones"], serde_json::json!([]));
        assert_eq!(state["keyzones"]["interactions"], serde_json::json!([]));
    }

    #[test]
    fn keyzone_snapshot_validates_lossless_prices_ids_and_references() {
        let encoded = canonical_checkpoint_state(None, Some(&fixed_projection())).unwrap();
        let state: serde_json::Value = serde_json::from_str(&encoded).unwrap();
        validate_canonical_structure_state(&state).unwrap();
        assert_eq!(state["keyzones"]["zones"][0]["lower"], "9.00001");
        assert_eq!(
            state["keyzones"]["zones"][0]["formedAt"],
            "9007199254740993"
        );
        let mut duplicate = state.clone();
        let zone = duplicate["keyzones"]["zones"][0].clone();
        duplicate["keyzones"]["zones"]
            .as_array_mut()
            .unwrap()
            .push(zone);
        assert!(
            validate_canonical_structure_state(&duplicate)
                .unwrap_err()
                .contains("Duplicate KeyZone")
        );
        let mut invalid = state.clone();
        invalid["keyzones"]["zones"][0]["upper"] = serde_json::json!("8.0");
        assert!(validate_canonical_structure_state(&invalid).is_err());
        invalid = state.clone();
        invalid["keyzones"]["zones"][0]["formedAt"] = serde_json::json!(9007199254740993_u64);
        assert!(validate_canonical_structure_state(&invalid).is_err());
        invalid = state.clone();
        invalid["keyzones"]["zones"][0]["state"] = serde_json::json!("Unknown");
        assert!(validate_canonical_structure_state(&invalid).is_err());
        invalid = state;
        invalid["keyzones"] = serde_json::Value::Null;
        assert!(validate_canonical_structure_state(&invalid).is_err());
    }
}
