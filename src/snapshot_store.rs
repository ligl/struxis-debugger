//! Read-only Snapshot discovery and residual-artifact classification.
//!
//! Discovery never promotes or repairs files and reads only the Manifest needed
//! to classify/list artifacts. Reference reads trust published content after
//! direct reads; Compare retains full checksum and checkpoint validation.

use std::{
    fmt,
    fs,
    path::{Path, PathBuf},
};

use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};

use crate::snapshot::{
    verify_complete_snapshot, SnapshotCheckpointRecord, SnapshotManifest,
    STATUS_COMPLETE, STATUS_FAILED, STATUS_FINALIZING, STATUS_RECORDING,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SnapshotArtifactKind {
    Complete,
    InvalidPublished,
    RecordingTemporary,
    FinalizingTemporary,
    FailedTemporary,
    CompleteButUnpublished,
    UnreadableTemporary,
}

/// Typed failure categories for reading a published Snapshot. Human-readable
/// messages are retained for display, but callers must branch on the variant.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum SnapshotReadError {
    Unpublished(String),
    Unreadable(String),
    Incomplete(String),
    IntegrityFailure(String),
}

impl fmt::Display for SnapshotReadError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::Unpublished(message)
            | Self::Unreadable(message)
            | Self::Incomplete(message)
            | Self::IntegrityFailure(message) => message,
        };
        formatter.write_str(message)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SnapshotArtifact {
    pub(crate) file_name: String,
    pub(crate) path: PathBuf,
    pub(crate) kind: SnapshotArtifactKind,
    pub(crate) snapshot_id: Option<String>,
    pub(crate) run_id: Option<String>,
    pub(crate) state_key: Option<String>,
    pub(crate) instrument_id: Option<String>,
    pub(crate) bar_type: Option<String>,
    pub(crate) input_start_ts_event: Option<String>,
    pub(crate) input_end_ts_event: Option<String>,
    pub(crate) generated_at: Option<String>,
    pub(crate) checkpoint_count: Option<usize>,
    pub(crate) diagnostic: Option<String>,
}

/// Enumerates only files using the Snapshot artifact suffixes. Results are
/// sorted by filename for stable UI and test behavior.
pub(crate) fn discover_snapshot_artifacts(root: impl AsRef<Path>) -> Result<Vec<SnapshotArtifact>, String> {
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
#[cfg(test)]
pub(crate) fn read_complete_snapshot(
    path: impl AsRef<Path>,
) -> Result<(SnapshotManifest, Vec<SnapshotCheckpointRecord>), String> {
    read_complete_snapshot_typed(path).map_err(|error| error.to_string())
}

/// Typed variant for callers that need stable failure classification.
pub(crate) fn read_complete_snapshot_typed(
    path: impl AsRef<Path>,
) -> Result<(SnapshotManifest, Vec<SnapshotCheckpointRecord>), SnapshotReadError> {
    let (manifest, checkpoints) = read_published_database(path.as_ref())?;
    verify_complete_snapshot(&manifest, &checkpoints)
        .map_err(SnapshotReadError::IntegrityFailure)?;
    Ok((manifest, checkpoints))
}

/// The only persisted fields needed to display one trusted Full checkpoint.
#[derive(Debug)]
pub(crate) struct ReferenceCheckpoint {
    pub(crate) sbar_id: String,
    pub(crate) state_data: String,
    pub(crate) diagnostics: String,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ReferenceObjectKind {
    Cbar,
    Swing,
    Trend,
}

/// Initial display reads only the Manifest and final checkpoint, without validation.
pub(crate) fn read_snapshot_reference(
    path: impl AsRef<Path>,
) -> Result<(SnapshotManifest, ReferenceCheckpoint), String> {
    let connection = open_reference(path.as_ref())?;
    let payload: String = connection
        .query_row(
            "SELECT payload FROM snapshot_manifest WHERE singleton=1",
            [],
            |row| row.get(0),
        )
        .map_err(|error| format!("Read Reference Manifest: {error}"))?;
    let manifest = serde_json::from_str(&payload)
        .map_err(|error| format!("Decode Reference Manifest: {error}"))?;
    let checkpoint = connection.query_row(
        "SELECT sbar_id,record_kind,state_data,diagnostics FROM snapshot_checkpoints ORDER BY checkpoint_index DESC LIMIT 1",
        [], reference_row,
    ).map_err(|error| format!("Read final Reference checkpoint: {error}"))?;
    Ok((manifest, decode_reference_record(checkpoint)?))
}

/// Historical state is fetched by the persisted SBar index only when requested.
pub(crate) fn read_reference_checkpoint(
    path: &Path,
    sbar_id: &str,
) -> Result<ReferenceCheckpoint, String> {
    let connection = open_reference(path)?;
    let checkpoint = connection.query_row(
        "SELECT sbar_id,record_kind,state_data,diagnostics FROM snapshot_checkpoints WHERE sbar_id=?1 LIMIT 1",
        [sbar_id], reference_row,
    ).map_err(|error| format!("Read Reference checkpoint for SBar {sbar_id}: {error}"))?;
    decode_reference_record(checkpoint)
}

/// Preserves Inspector's latest-checkpoint-containing-ID rule without transferring history.
pub(crate) fn read_reference_object_checkpoint(
    path: &Path,
    kind: ReferenceObjectKind,
    object_id: &str,
) -> Result<Option<ReferenceCheckpoint>, String> {
    let (collection, id_field) = match kind {
        ReferenceObjectKind::Cbar => ("cbars", "cbarId"),
        ReferenceObjectKind::Swing => ("swings", "swingId"),
        ReferenceObjectKind::Trend => ("trends", "trendId"),
    };
    let sql = format!(
        "SELECT sbar_id,record_kind,state_data,diagnostics FROM snapshot_checkpoints
         WHERE EXISTS(SELECT 1 FROM json_each(state_data, '$.{collection}') AS object
         WHERE json_extract(object.value, '$.{id_field}') = ?1)
         ORDER BY checkpoint_index DESC LIMIT 1"
    );
    let connection = open_reference(path)?;
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| format!("Prepare Reference object lookup: {error}"))?;
    let mut rows = statement
        .query([object_id])
        .map_err(|error| format!("Query Reference object {object_id}: {error}"))?;
    let row = rows
        .next()
        .map_err(|error| format!("Read Reference object: {error}"))?;
    match row {
        Some(row) => {
            let checkpoint = reference_row(row)
                .map_err(|error| format!("Decode Reference object row: {error}"))?;
            decode_reference_record(checkpoint).map(Some)
        }
        None => Ok(None),
    }
}

fn open_reference(path: &Path) -> Result<Connection, String> {
    if !path
        .file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.ends_with(".snapshot.sqlite"))
    {
        return Err("Only published .snapshot.sqlite files can be displayed".into());
    }
    Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|error| format!("Open Reference read-only: {error}"))
}

fn reference_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<(String, String, String, String)> {
    Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
}

fn decode_reference_record(
    (sbar_id, kind, state_data, diagnostics): (String, String, String, String),
) -> Result<ReferenceCheckpoint, String> {
    // Delta reconstruction is unsupported; it cannot be displayed as Full state.
    if kind != "Full" {
        return Err(format!(
            "Cannot display Reference record kind {kind}; Full is required"
        ));
    }
    Ok(ReferenceCheckpoint {
        sbar_id,
        state_data,
        diagnostics,
    })
}

fn read_published_database(
    path: &Path,
) -> Result<(SnapshotManifest, Vec<SnapshotCheckpointRecord>), SnapshotReadError> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();
    if !file_name.ends_with(".snapshot.sqlite") {
        return Err(SnapshotReadError::Unpublished(
            "Only published .snapshot.sqlite files can be read as complete Snapshots".into(),
        ));
    }
    let (manifest, checkpoints) = read_database(path).map_err(SnapshotReadError::Unreadable)?;
    if manifest.status != STATUS_COMPLETE {
        return Err(SnapshotReadError::Incomplete(format!(
            "Snapshot is not Complete (status={})",
            manifest.status
        )));
    }
    Ok((manifest, checkpoints))
}

fn classify_published(file_name: String, path: PathBuf) -> SnapshotArtifact {
    // Discovery is intentionally metadata-only: do not scan checkpoints or
    // verify the content checksum here. Reference trusts published content;
    // Compare performs full verification independently.
    match read_manifest(&path) {
        Ok(manifest) if manifest.status == STATUS_COMPLETE => {
            artifact(file_name, path, SnapshotArtifactKind::Complete, Some(&manifest), None, None)
        }
        Ok(manifest) => {
            let diagnostic = format!("Published Snapshot Manifest is not Complete (status={})", manifest.status);
            artifact(file_name, path, SnapshotArtifactKind::InvalidPublished, Some(&manifest), None, Some(diagnostic))
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
        instrument_id: manifest.map(|value| value.instrument_id.clone()),
        bar_type: manifest.map(|value| value.bar_type.clone()),
        input_start_ts_event: manifest.map(|value| value.input_start_ts_event.clone()),
        input_end_ts_event: manifest.map(|value| value.input_end_ts_event.clone()),
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

    fn reference_fixture() -> (SnapshotManifest, Vec<SnapshotCheckpointRecord>) {
        let mut manifest = manifest(STATUS_COMPLETE);
        manifest.checkpoint_count = 2;
        manifest.input_bar_count = 2;
        manifest.input_end_sbar_id = "200".into();
        manifest.input_end_ts_event = "200".into();
        let records = ["100", "200"].into_iter().enumerate().map(|(index, id)| {
            SnapshotCheckpointRecord {
                checkpoint_index: index,
                sbar_id: id.into(),
                ts_event: id.into(),
                record_kind: "Full".into(),
                state_data: r#"{"cbarCount":0,"cbars":[],"swingCount":0,"swings":[],"trendCount":0,"trends":[]}"#.into(),
                diagnostics: "[]".into(),
            }
        }).collect();
        (manifest, records)
    }

    fn create_reference_database(path: &Path) {
        create_manifest_database(path, STATUS_COMPLETE);
        let (manifest, records) = reference_fixture();
        let connection = Connection::open(path).unwrap();
        connection
            .execute(
                "UPDATE snapshot_manifest SET payload=?1",
                [serde_json::to_string(&manifest).unwrap()],
            )
            .unwrap();
        connection.execute_batch(
            "CREATE TABLE snapshot_checkpoints(checkpoint_index INTEGER PRIMARY KEY, sbar_id TEXT,
             ts_event TEXT, record_kind TEXT, state_data TEXT, diagnostics TEXT);
             CREATE INDEX snapshot_sbar ON snapshot_checkpoints(sbar_id);"
        ).unwrap();
        for record in &records {
            connection
                .execute(
                    "INSERT INTO snapshot_checkpoints VALUES(?1,?2,?3,?4,?5,?6)",
                    rusqlite::params![
                        record.checkpoint_index as i64,
                        record.sbar_id,
                        record.ts_event,
                        record.record_kind,
                        record.state_data,
                        record.diagnostics
                    ],
                )
                .unwrap();
        }
    }

    #[test]
    fn reference_reader_trusts_published_content_and_reads_only_the_final_state() {
        let root = temp_root();
        fs::create_dir_all(&root).unwrap();
        let path = root.join("snapshot-test.snapshot.sqlite");
        create_reference_database(&path);
        let original = fs::read(&path).unwrap();
        let (manifest, checkpoint) = read_snapshot_reference(&path).unwrap();
        assert_eq!(manifest.snapshot_id, "snapshot-test");
        assert_eq!(checkpoint.sbar_id, "200");
        assert_eq!(
            read_reference_checkpoint(&path, "100").unwrap().sbar_id,
            "100"
        );
        // The fixture deliberately lacks a valid effective config and checksum.
        assert!(matches!(
            read_complete_snapshot_typed(&path),
            Err(SnapshotReadError::IntegrityFailure(_))
        ));
        assert_eq!(fs::read(&path).unwrap(), original);
        assert!(read_reference_checkpoint(&path, "missing").is_err());
        let temporary = root.join(".snapshot-test.snapshot.tmp");
        fs::copy(&path, &temporary).unwrap();
        assert!(
            read_snapshot_reference(&temporary)
                .unwrap_err()
                .contains("Only published")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reference_display_does_not_validate_manifest_or_scan_historical_states() {
        let root = temp_root();
        fs::create_dir_all(&root).unwrap();
        let path = root.join("snapshot-test.snapshot.sqlite");
        create_reference_database(&path);
        let connection = Connection::open(&path).unwrap();
        let mut changed = reference_fixture().0;
        changed.status = STATUS_RECORDING.into();
        changed.checkpoint_count = 999;
        changed.input_bar_count = 888;
        changed.sbar_sequence_fingerprint = "unverified".into();
        connection
            .execute(
                "UPDATE snapshot_manifest SET payload=?1",
                [serde_json::to_string(&changed).unwrap()],
            )
            .unwrap();
        // A broken historical row must not block an otherwise readable final display.
        connection
            .execute_batch(
                "UPDATE snapshot_checkpoints SET state_data='invalid JSON',
            ts_event='not a timestamp',record_kind='Delta' WHERE checkpoint_index=0;",
            )
            .unwrap();
        drop(connection);
        let (manifest, checkpoint) = read_snapshot_reference(&path).unwrap();
        assert_eq!(manifest.checkpoint_count, 999);
        assert_eq!(checkpoint.sbar_id, "200");
        assert!(
            read_reference_checkpoint(&path, "100")
                .unwrap_err()
                .contains("Full")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reference_object_lookup_returns_the_latest_checkpoint_containing_the_domain_id() {
        let root = temp_root();
        fs::create_dir_all(&root).unwrap();
        let path = root.join("snapshot-test.snapshot.sqlite");
        create_reference_database(&path);
        let connection = Connection::open(&path).unwrap();
        connection.execute("UPDATE snapshot_checkpoints SET state_data=?1 WHERE checkpoint_index=0",
            [r#"{"cbars":[{"cbarId":"older"},{"cbarId":"shared"}],"swings":[{"swingId":"s1"}],"trends":[{"trendId":"t1"}]}"#]).unwrap();
        connection
            .execute(
                "UPDATE snapshot_checkpoints SET state_data=?1 WHERE checkpoint_index=1",
                [r#"{"cbars":[{"cbarId":"shared"}],"swings":[],"trends":[]}"#],
            )
            .unwrap();
        drop(connection);
        for (kind, id, expected) in [
            (ReferenceObjectKind::Cbar, "older", "100"),
            (ReferenceObjectKind::Cbar, "shared", "200"),
            (ReferenceObjectKind::Swing, "s1", "100"),
            (ReferenceObjectKind::Trend, "t1", "100"),
        ] {
            assert_eq!(
                read_reference_object_checkpoint(&path, kind, id)
                    .unwrap()
                    .unwrap()
                    .sbar_id,
                expected
            );
        }
        assert!(
            read_reference_object_checkpoint(&path, ReferenceObjectKind::Cbar, "absent")
                .unwrap()
                .is_none()
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reference_reads_diagnostics_with_only_the_requested_checkpoint() {
        let root = temp_root();
        fs::create_dir_all(&root).unwrap();
        let path = root.join("snapshot-test.snapshot.sqlite");
        create_reference_database(&path);
        let connection = Connection::open(&path).unwrap();
        let earlier = r#"[{"source":"struxis","severity":"error","category":"processing","objectType":null,"objectId":null,"sbarIds":["100"],"checkpointIndex":0,"message":"Earlier exception"}]"#;
        let final_diagnostics = r#"[{"source":"struxis","severity":"warning","category":"processing","objectType":null,"objectId":null,"sbarIds":["200"],"checkpointIndex":1,"message":"Final warning"}]"#;
        connection.execute("UPDATE snapshot_checkpoints SET diagnostics=?1,state_data=?2 WHERE checkpoint_index=0",
            rusqlite::params![earlier, r#"{"cbars":[{"cbarId":"earlier"}]}"#]).unwrap();
        connection
            .execute(
                "UPDATE snapshot_checkpoints SET diagnostics=?1 WHERE checkpoint_index=1",
                [final_diagnostics],
            )
            .unwrap();
        drop(connection);
        assert_eq!(
            read_snapshot_reference(&path).unwrap().1.diagnostics,
            final_diagnostics
        );
        assert_eq!(
            read_reference_checkpoint(&path, "100").unwrap().diagnostics,
            earlier
        );
        assert_eq!(
            read_reference_object_checkpoint(&path, ReferenceObjectKind::Cbar, "earlier")
                .unwrap()
                .unwrap()
                .diagnostics,
            earlier
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn snapshot_root_that_is_a_file_returns_a_clear_error() {
        let root = temp_root();
        fs::write(&root, b"not a directory").unwrap();

        let error = discover_snapshot_artifacts(&root).unwrap_err();

        assert!(error.contains("Snapshot root is not a directory"));
        assert!(error.contains(&root.display().to_string()));

        let _ = fs::remove_file(root);
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
    fn finalizing_and_failed_temporary_artifacts_are_classified_without_promotion() {
        let root = temp_root();
        fs::create_dir_all(&root).unwrap();
        let failed_path = root.join(".a-failed.snapshot.tmp");
        let finalizing_path = root.join(".z-finalizing.snapshot.tmp");
        create_manifest_database(&failed_path, STATUS_FAILED);
        create_manifest_database(&finalizing_path, STATUS_FINALIZING);

        let artifacts = discover_snapshot_artifacts(&root).unwrap();

        assert_eq!(artifacts.len(), 2);
        assert_eq!(artifacts[0].file_name, ".a-failed.snapshot.tmp");
        assert_eq!(artifacts[0].kind, SnapshotArtifactKind::FailedTemporary);
        assert_eq!(artifacts[1].file_name, ".z-finalizing.snapshot.tmp");
        assert_eq!(artifacts[1].kind, SnapshotArtifactKind::FinalizingTemporary);
        assert!(!root.join("snapshot-test.snapshot.sqlite").exists());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn unreadable_temporary_artifact_is_reported_without_promotion_or_mutation() {
        let root = temp_root();
        fs::create_dir_all(&root).unwrap();
        let path = root.join(".snapshot-interrupted.snapshot.tmp");
        let original_bytes = b"not a sqlite database";
        fs::write(&path, original_bytes).unwrap();

        let artifacts = discover_snapshot_artifacts(&root).unwrap();

        assert_eq!(artifacts.len(), 1);
        assert_eq!(
            artifacts[0].kind,
            SnapshotArtifactKind::UnreadableTemporary
        );
        assert!(artifacts[0].diagnostic.is_some());
        assert_eq!(
            fs::read(&path).unwrap(),
            original_bytes,
            "Discovery must preserve unreadable temporary recovery material"
        );
        assert!(
            !root.join("snapshot-interrupted.snapshot.sqlite").exists(),
            "Discovery must never promote an unreadable temporary artifact"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn discovery_ignores_files_outside_snapshot_naming_contract() {
        let root = temp_root();
        fs::create_dir_all(&root).unwrap();

        let unrelated = [
            ("ordinary.tmp", b"temporary".as_slice()),
            ("ordinary.sqlite", b"sqlite".as_slice()),
            ("visible.snapshot.tmp", b"not a hidden temporary artifact".as_slice()),
            ("notes.txt", b"notes".as_slice()),
        ];
        for (name, bytes) in unrelated {
            fs::write(root.join(name), bytes).unwrap();
        }
        fs::create_dir(root.join("nested.snapshot.sqlite")).unwrap();

        let artifacts = discover_snapshot_artifacts(&root).unwrap();

        assert!(
            artifacts.is_empty(),
            "Discovery must only include published .snapshot.sqlite files and hidden .snapshot.tmp files"
        );
        for (name, bytes) in unrelated {
            assert_eq!(fs::read(root.join(name)).unwrap(), bytes);
        }
        assert!(root.join("nested.snapshot.sqlite").is_dir());

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
