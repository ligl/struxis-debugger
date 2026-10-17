//! Read-only Snapshot discovery and residual-artifact classification.
//!
//! Discovery never promotes or repairs files. Only a published
//! `.snapshot.sqlite` with a Complete Manifest and valid checksum is usable.

use std::{
    fs,
    path::{Path, PathBuf},
};

use rusqlite::{Connection, OpenFlags};
use serde::Serialize;

use crate::snapshot::{
    verify_complete_snapshot, SnapshotCheckpointRecord, SnapshotManifest,
    STATUS_COMPLETE, STATUS_FAILED, STATUS_FINALIZING, STATUS_RECORDING,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SnapshotArtifactKind {
    Complete,
    InvalidPublished,
    RecordingTemporary,
    FinalizingTemporary,
    FailedTemporary,
    CompleteButUnpublished,
    UnreadableTemporary,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotArtifact {
    pub file_name: String,
    pub path: PathBuf,
    pub kind: SnapshotArtifactKind,
    pub snapshot_id: Option<String>,
    pub run_id: Option<String>,
    pub state_key: Option<String>,
    pub generated_at: Option<String>,
    pub checkpoint_count: Option<usize>,
    pub diagnostic: Option<String>,
}

/// Enumerates only files using the Snapshot artifact suffixes. Results are
/// sorted by filename for stable UI and test behavior.
pub fn discover_snapshot_artifacts(root: impl AsRef<Path>) -> Result<Vec<SnapshotArtifact>, String> {
    let root = root.as_ref();
    if !root.exists() {
        return Ok(Vec::new());
    }
    if !root.is_dir() {
        return Err(format!("Snapshot root is not a directory: {}", root.display()));
    }

    let entries = fs::read_dir(root)
        .map_err(|error| format!("Read Snapshot directory {}: {error}", root.display()))?;
    let mut paths = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|error| format!("Read Snapshot directory entry: {error}"))?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.ends_with(".snapshot.sqlite") || (name.starts_with('.') && name.ends_with(".snapshot.tmp")) {
            paths.push((name, path));
        }
    }
    paths.sort_by(|left, right| left.0.cmp(&right.0));

    Ok(paths.into_iter().map(|(file_name, path)| {
        if file_name.ends_with(".snapshot.sqlite") {
            classify_published(file_name, path)
        } else {
            classify_temporary(file_name, path)
        }
    }).collect())
}

/// Opens and validates a published Snapshot without permitting writes.
pub fn read_complete_snapshot(path: impl AsRef<Path>) -> Result<(SnapshotManifest, Vec<SnapshotCheckpointRecord>), String> {
    let path = path.as_ref();
    let file_name = path.file_name().and_then(|name| name.to_str()).unwrap_or_default();
    if !file_name.ends_with(".snapshot.sqlite") {
        return Err("Only published .snapshot.sqlite files can be read as complete Snapshots".into());
    }
    let (manifest, checkpoints) = read_database(path)?;
    verify_complete_snapshot(&manifest, &checkpoints)?;
    Ok((manifest, checkpoints))
}

fn classify_published(file_name: String, path: PathBuf) -> SnapshotArtifact {
    match read_database(&path) {
        Ok((manifest, checkpoints)) => {
            let verification = verify_complete_snapshot(&manifest, &checkpoints);
            if manifest.status == STATUS_COMPLETE && verification.is_ok() {
                artifact(file_name, path, SnapshotArtifactKind::Complete, Some(&manifest), Some(checkpoints.len()), None)
            } else {
                let diagnostic = verification.err().unwrap_or_else(|| {
                    format!("Published Snapshot must have Complete status, got {}", manifest.status)
                });
                artifact(file_name, path, SnapshotArtifactKind::InvalidPublished, Some(&manifest), Some(checkpoints.len()), Some(diagnostic))
            }
        }
        Err(error) => artifact(file_name, path, SnapshotArtifactKind::InvalidPublished, None, None, Some(error)),
    }
}

fn classify_temporary(file_name: String, path: PathBuf) -> SnapshotArtifact {
    match read_manifest(&path) {
        Ok(manifest) => {
            let kind = match manifest.status.as_str() {
                STATUS_RECORDING => SnapshotArtifactKind::RecordingTemporary,
                STATUS_FINALIZING => SnapshotArtifactKind::FinalizingTemporary,
                STATUS_FAILED => SnapshotArtifactKind::FailedTemporary,
                STATUS_COMPLETE => SnapshotArtifactKind::CompleteButUnpublished,
                other => return artifact(file_name, path, SnapshotArtifactKind::UnreadableTemporary, Some(&manifest), None,
                    Some(format!("Unsupported temporary Snapshot status {other}"))),
            };
            // Even a fully checksummed Complete Manifest remains a residual
            // artifact while it has the temporary suffix. Discovery never
            // renames it into the published namespace.
            artifact(file_name, path, kind, Some(&manifest), None, None)
        }
        Err(error) => artifact(file_name, path, SnapshotArtifactKind::UnreadableTemporary, None, None, Some(error)),
    }
}

fn artifact(
    file_name: String,
    path: PathBuf,
    kind: SnapshotArtifactKind,
    manifest: Option<&SnapshotManifest>,
    checkpoint_count: Option<usize>,
    diagnostic: Option<String>,
) -> SnapshotArtifact {
    SnapshotArtifact {
        file_name,
        path,
        kind,
        snapshot_id: manifest.map(|value| value.snapshot_id.clone()),
        run_id: manifest.map(|value| value.run_id.clone()),
        state_key: manifest.map(|value| value.state_key.clone()),
        generated_at: manifest.map(|value| value.snapshot_generated_at.clone()),
        checkpoint_count: checkpoint_count.or_else(|| manifest.map(|value| value.checkpoint_count)),
        diagnostic,
    }
}

fn read_manifest(path: &Path) -> Result<SnapshotManifest, String> {
    let connection = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    ).map_err(|error| format!("Open Snapshot read-only {}: {error}", path.display()))?;
    let payload: String = connection.query_row(
        "SELECT payload FROM snapshot_manifest WHERE singleton=1", [], |row| row.get(0),
    ).map_err(|error| format!("Read Snapshot Manifest: {error}"))?;
    serde_json::from_str(&payload).map_err(|error| format!("Decode Snapshot Manifest: {error}"))
}

fn read_database(path: &Path) -> Result<(SnapshotManifest, Vec<SnapshotCheckpointRecord>), String> {
    let connection = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    ).map_err(|error| format!("Open Snapshot read-only {}: {error}", path.display()))?;
    let payload: String = connection.query_row(
        "SELECT payload FROM snapshot_manifest WHERE singleton=1", [], |row| row.get(0),
    ).map_err(|error| format!("Read Snapshot Manifest: {error}"))?;
    let manifest: SnapshotManifest = serde_json::from_str(&payload)
        .map_err(|error| format!("Decode Snapshot Manifest: {error}"))?;
    let mut statement = connection.prepare(
        "SELECT checkpoint_index,sbar_id,ts_event,record_kind,state_data,diagnostics
         FROM snapshot_checkpoints ORDER BY checkpoint_index",
    ).map_err(|error| format!("Prepare Snapshot checkpoint read: {error}"))?;
    let rows = statement.query_map([], |row| Ok((
        row.get::<_, i64>(0)?,
        row.get::<_, String>(1)?,
        row.get::<_, String>(2)?,
        row.get::<_, String>(3)?,
        row.get::<_, String>(4)?,
        row.get::<_, String>(5)?,
    ))).map_err(|error| format!("Query Snapshot checkpoints: {error}"))?;

    let mut checkpoints = Vec::new();
    for row in rows {
        let (index, sbar_id, ts_event, record_kind, state_data, diagnostics) =
            row.map_err(|error| format!("Read Snapshot checkpoint: {error}"))?;
        checkpoints.push(SnapshotCheckpointRecord {
            checkpoint_index: usize::try_from(index)
                .map_err(|_| "Snapshot contains a negative checkpoint index")?,
            sbar_id,
            ts_event,
            record_kind,
            state_data,
            diagnostics,
        });
    }
    Ok((manifest, checkpoints))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_root() -> PathBuf {
        std::env::temp_dir().join(format!(
            "capitus-snapshot-store-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ))
    }

    fn manifest(status: &str) -> SnapshotManifest {
        SnapshotManifest {
            snapshot_id: "snapshot-test".into(),
            run_id: "run-test".into(),
            state_key: "test-state".into(),
            instrument_id: "TEST.SIM".into(),
            bar_type: "TEST.SIM-1-MINUTE-LAST-EXTERNAL".into(),
            input_start_sbar_id: "100".into(),
            input_end_sbar_id: "100".into(),
            input_start_ts_event: "100".into(),
            input_end_ts_event: "100".into(),
            snapshot_generated_at: "1780000000000000000".into(),
            input_bar_count: 1,
            sbar_sequence_fingerprint: "a".repeat(64),
            config_fingerprint: "b".repeat(64),
            effective_config: "{}".into(),
            status: status.into(),
            checkpoint_count: 0,
            content_checksum: String::new(),
        }
    }

    fn create_manifest_database(path: &Path, status: &str) {
        let connection = Connection::open(path).unwrap();
        connection.execute_batch(
            "CREATE TABLE snapshot_manifest(singleton INTEGER PRIMARY KEY, payload TEXT NOT NULL);",
        ).unwrap();
        connection.execute(
            "INSERT INTO snapshot_manifest(singleton,payload) VALUES(1,?1)",
            [serde_json::to_string(&manifest(status)).unwrap()],
        ).unwrap();
    }

    #[test]
    fn missing_snapshot_directory_is_an_empty_discovery_result() {
        let root = temp_root();
        assert!(discover_snapshot_artifacts(&root).unwrap().is_empty());
    }

    #[test]
    fn complete_temporary_artifact_is_classified_but_never_promoted() {
        let root = temp_root();
        fs::create_dir_all(&root).unwrap();
        let path = root.join(".snapshot-test.snapshot.tmp");
        create_manifest_database(&path, STATUS_COMPLETE);

        let artifacts = discover_snapshot_artifacts(&root).unwrap();
        assert_eq!(artifacts.len(), 1);
        assert_eq!(artifacts[0].kind, SnapshotArtifactKind::CompleteButUnpublished);
        assert_eq!(artifacts[0].snapshot_id.as_deref(), Some("snapshot-test"));
        assert!(!root.join("snapshot-test.snapshot.sqlite").exists());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn recording_temporary_artifact_is_not_a_published_snapshot() {
        let root = temp_root();
        fs::create_dir_all(&root).unwrap();
        let path = root.join(".snapshot-test.snapshot.tmp");
        create_manifest_database(&path, STATUS_RECORDING);

        let artifacts = discover_snapshot_artifacts(&root).unwrap();
        assert_eq!(artifacts[0].kind, SnapshotArtifactKind::RecordingTemporary);
        assert!(read_complete_snapshot(&path).unwrap_err().contains("Only published"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn malformed_published_artifact_is_reported_instead_of_ignored() {
        let root = temp_root();
        fs::create_dir_all(&root).unwrap();
        let path = root.join("bad.snapshot.sqlite");
        let connection = Connection::open(&path).unwrap();
        connection.execute_batch("CREATE TABLE unrelated(value TEXT);").unwrap();
        drop(connection);

        let artifacts = discover_snapshot_artifacts(&root).unwrap();
        assert_eq!(artifacts.len(), 1);
        assert_eq!(artifacts[0].kind, SnapshotArtifactKind::InvalidPublished);
        assert!(artifacts[0].diagnostic.is_some());

        let _ = fs::remove_dir_all(root);
    }
}
