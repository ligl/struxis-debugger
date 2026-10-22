//! SQLite-backed Snapshot recording and finalization.
//!
//! Checkpoints are committed individually. A Snapshot is only published after
//! final checksum verification through an independent read-only connection.

use std::{
    fs::{self, File},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use rusqlite::{Connection, OpenFlags, params};
use crate::{
    checkpoint::{OwnedCheckpoint, ReplayCheckpointProjection},
    diagnostics::canonical_diagnostics_json,
    effective_config::EffectiveStruxisConfig,
    replay::LoadedInput,
    run::{RunState, RunStatus},
    snapshot::{
        canonical_structure_state, verify_complete_snapshot, SnapshotCheckpointRecord,
        SnapshotManifest, STATUS_COMPLETE, STATUS_FAILED, STATUS_RECORDING,
    },
    worker::CheckpointSink,
};

pub(crate) struct SnapshotWriter {
    root: PathBuf,
    temporary_path: PathBuf,
    published_path: PathBuf,
    input: InputMetadata,
    manifest: Option<SnapshotManifest>,
    checkpoints: Vec<SnapshotCheckpointRecord>,
    connection: Option<Connection>,
    /// True only after this writer atomically creates the published hard link.
    /// Prevents failure handling from mutating the same inode through a leftover
    /// temporary link if temporary-path cleanup fails.
    published_by_this_writer: bool,
    #[cfg(test)]
    fail_directory_sync: bool,
    #[cfg(test)]
    fail_temporary_cleanup: bool,
}

struct InputMetadata {
    state_key: String,
    instrument_id: String,
    bar_type: String,
    start_id: String,
    end_id: String,
    start_ts: String,
    end_ts: String,
    count: usize,
    fingerprint: String,
    bar_ids: Vec<String>,
}

impl SnapshotWriter {
    pub(crate) fn new(root: impl AsRef<Path>, input: &LoadedInput, instrument_id: &str) -> Result<Self, String> {
        let first = input.bars.first().ok_or_else(|| "Snapshot input is empty".to_owned())?;
        let last = input.bars.last().expect("nonempty input checked above");
        let id = uuid::Uuid::new_v4().to_string();
        let root = root.as_ref().to_path_buf();
        Ok(Self {
            temporary_path: root.join(format!(".{id}.snapshot.tmp")),
            published_path: root.join(format!("{id}.snapshot.sqlite")),
            root,
            input: InputMetadata {
                state_key: format!("{:?}", input.state_key),
                instrument_id: instrument_id.to_owned(),
                bar_type: input.bar_type.clone(),
                start_id: first.ts_event.to_string(),
                end_id: last.ts_event.to_string(),
                start_ts: first.ts_event.to_string(),
                end_ts: last.ts_event.to_string(),
                count: input.bars.len(),
                fingerprint: input.sbar_sequence_fingerprint.clone(),
                bar_ids: input.bars.iter().map(|bar| bar.ts_event.to_string()).collect(),
            },
            manifest: None,
            checkpoints: Vec::new(),
            connection: None,
            published_by_this_writer: false,
            #[cfg(test)]
            fail_directory_sync: false,
            #[cfg(test)]
            fail_temporary_cleanup: false,
        })
    }

    /// Persists a completed Run's immutable in-memory trajectory as a new Snapshot.
    ///
    /// This path is intentionally separate from Worker Start / Step. It creates
    /// a fresh writer, validates the full ordered trajectory, and publishes only
    /// after the existing checksum and read-only reopen checks succeed.
    pub(crate) fn save_completed(
        root: impl AsRef<Path>,
        input: &LoadedInput,
        instrument_id: &str,
        completed_state: &RunState,
        effective_config: &EffectiveStruxisConfig,
        checkpoints: &[OwnedCheckpoint],
    ) -> Result<String, String> {
        if completed_state.status != RunStatus::Completed {
            return Err(format!(
                "Snapshot save requires Completed Run, got {:?}",
                completed_state.status
            ));
        }
        if checkpoints.len() != input.bars.len()
            || completed_state.processed_count != input.bars.len()
            || completed_state.input_count != input.bars.len()
            || completed_state.test_dataset_id != input.test_dataset_id
            || completed_state.input_fingerprint != input.sbar_sequence_fingerprint
        {
            return Err(format!(
                "Completed Run trajectory does not match fixed input: input={}, processed={}, checkpoints={}",
                input.bars.len(), completed_state.processed_count, checkpoints.len()
            ));
        }

        let mut writer = Self::new(root, input, instrument_id)?;
        let initial_state = RunState::ready(
            completed_state.run_id.clone(),
            input.test_dataset_id.clone(),
            input.sbar_sequence_fingerprint.clone(),
            input.bars.len(),
        )?;
        let result = (|| {
            writer.initialize(&initial_state, effective_config)?;
            for (expected_index, checkpoint) in checkpoints.iter().enumerate() {
                if checkpoint.checkpoint_index != expected_index {
                    return Err(format!(
                        "Owned Checkpoint trajectory is not contiguous: expected index {expected_index}, got {}",
                        checkpoint.checkpoint_index
                    ));
                }
                let expected_sbar_id = input.bars[expected_index].ts_event.to_string();
                if checkpoint.sbar_id != expected_sbar_id
                    || checkpoint.ts_event != expected_sbar_id
                {
                    return Err(format!(
                        "Owned Checkpoint SBar mismatch at index {expected_index}: expected {expected_sbar_id}, got {} / {}",
                        checkpoint.sbar_id, checkpoint.ts_event
                    ));
                }
                writer.commit_checkpoint(
                    checkpoint.checkpoint_index,
                    &checkpoint.sbar_id,
                    &checkpoint.persistence_projection(),
                )?;
            }
            writer.finalize(completed_state)?;
            writer.manifest.as_ref()
                .map(|manifest| manifest.snapshot_id.clone())
                .ok_or_else(|| "Snapshot finalization did not produce a Manifest".to_owned())
        })();

        if let Err(error) = &result {
            let _ = <Self as CheckpointSink>::fail(&mut writer, error);
        }
        result
    }

    #[cfg(test)]
    #[must_use]
    pub(crate) fn published_path(&self) -> &Path {
        &self.published_path
    }

    fn finalize_snapshot(&mut self, state: &RunState) -> Result<(), String> {
        if state.status != RunStatus::Completed {
            return Err(format!("Snapshot finalization requires Completed Run, got {:?}", state.status));
        }
        let mut manifest = self.manifest.clone()
            .ok_or_else(|| "Snapshot finalization requested before initialization".to_owned())?;
        if self.checkpoints.len() != manifest.input_bar_count
            || state.processed_count != manifest.input_bar_count
        {
            return Err(format!("Snapshot finalization count mismatch: input={}, checkpoints={}, processed={}",
                manifest.input_bar_count, self.checkpoints.len(), state.processed_count));
        }
        manifest.status = STATUS_COMPLETE.to_owned();
        manifest.checkpoint_count = self.checkpoints.len();
        manifest.content_checksum = manifest.calculate_content_checksum(&self.checkpoints)?;
        verify_complete_snapshot(&manifest, &self.checkpoints)?;

        let connection = self.connection.as_mut()
            .ok_or_else(|| "Snapshot database connection is not open".to_owned())?;
        let tx = connection.transaction().map_err(|e| format!("Begin finalization transaction: {e}"))?;
        tx.execute("UPDATE snapshot_manifest SET payload=?1 WHERE singleton=1",
            params![serde_json::to_string(&manifest).map_err(|e| e.to_string())?])
            .map_err(|e| format!("Persist final Manifest: {e}"))?;
        tx.commit().map_err(|e| format!("Commit final Manifest: {e}"))?;
        self.manifest = Some(manifest);
        self.connection.take();

        let (reopened, records) = read_database(&self.temporary_path)?;
        verify_complete_snapshot(&reopened, &records)?;
        // hard_link creates the published name atomically and fails if the
        // destination already exists; unlike rename on Unix, it cannot replace
        // a Snapshot created concurrently after an earlier existence check.
        // Both paths are in the same directory, so they are on the same filesystem.
        fs::hard_link(&self.temporary_path, &self.published_path)
            .map_err(|e| {
                if e.kind() == std::io::ErrorKind::AlreadyExists {
                    "Snapshot publish destination already exists".to_owned()
                } else {
                    format!("Atomically publish Snapshot without replacement: {e}")
                }
            })?;
        self.published_by_this_writer = true;

        // The published file is already valid at this point. If unlinking the
        // temporary hard link fails, keep the published artifact intact and
        // continue; failure handling must not mutate the shared inode.
        #[cfg(test)]
        let cleanup_result = if self.fail_temporary_cleanup {
            Err(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                "simulated temporary-link cleanup failure",
            ))
        } else {
            fs::remove_file(&self.temporary_path)
        };
        #[cfg(not(test))]
        let cleanup_result = fs::remove_file(&self.temporary_path);

        if let Err(error) = cleanup_result {
            log::warn!(
                "Published Snapshot {} but could not remove temporary link {}: {error}",
                self.published_path.display(),
                self.temporary_path.display(),
            );
        }
        self.sync_snapshot_directory()?;
        Ok(())
    }

    fn sync_snapshot_directory(&self) -> Result<(), String> {
        #[cfg(test)]
        if self.fail_directory_sync {
            return Err("Flush Snapshot directory: simulated directory sync failure".to_owned());
        }

        File::open(&self.root).and_then(|directory| directory.sync_all())
            .map_err(|e| format!("Flush Snapshot directory: {e}"))
    }
}

impl CheckpointSink for SnapshotWriter {
    fn initialize(&mut self, state: &RunState, config: &EffectiveStruxisConfig) -> Result<(), String> {
        if self.connection.is_some() || self.manifest.is_some() {
            return Err("SnapshotWriter cannot be initialized twice".into());
        }
        if state.status != RunStatus::Ready || state.processed_count != 0
            || state.input_count != self.input.count || state.input_fingerprint != self.input.fingerprint
        {
            return Err("Snapshot input metadata does not match initial RunState".into());
        }
        fs::create_dir_all(&self.root).map_err(|e| format!("Create Snapshot directory: {e}"))?;
        if self.temporary_path.exists() || self.published_path.exists() {
            return Err("Snapshot output path already exists".into());
        }
        let generated_at = SystemTime::now().duration_since(UNIX_EPOCH)
            .map_err(|e| format!("System clock error: {e}"))?.as_nanos().to_string();
        let manifest = SnapshotManifest {
            snapshot_id: self.published_path.file_stem().and_then(|s| s.to_str())
                .and_then(|s| s.strip_suffix(".snapshot")).ok_or("Invalid Snapshot filename")?.to_owned(),
            run_id: state.run_id.clone(),
            state_key: self.input.state_key.clone(),
            instrument_id: self.input.instrument_id.clone(),
            bar_type: self.input.bar_type.clone(),
            input_start_sbar_id: self.input.start_id.clone(),
            input_end_sbar_id: self.input.end_id.clone(),
            input_start_ts_event: self.input.start_ts.clone(),
            input_end_ts_event: self.input.end_ts.clone(),
            snapshot_generated_at: generated_at,
            input_bar_count: self.input.count,
            sbar_sequence_fingerprint: self.input.fingerprint.clone(),
            config_fingerprint: config.fingerprint()?,
            effective_config: config.canonical_json()?,
            status: STATUS_RECORDING.to_owned(),
            checkpoint_count: 0,
            content_checksum: String::new(),
        };
        let mut connection = Connection::open(&self.temporary_path)
            .map_err(|e| format!("Create temporary SQLite database: {e}"))?;
        connection.execute_batch(
            "PRAGMA journal_mode=DELETE;
             PRAGMA synchronous=FULL;
             PRAGMA foreign_keys=ON;"
        ).map_err(|e| format!("Configure Snapshot database: {e}"))?;
        // Schema and the initial Recording Manifest are one atomic initialization
        // transaction. A failed initialization must not leave a valid-looking
        // half-created Snapshot database.
        let tx = connection.transaction()
            .map_err(|e| format!("Begin Snapshot initialization transaction: {e}"))?;
        tx.execute_batch(
            "CREATE TABLE snapshot_manifest(singleton INTEGER PRIMARY KEY CHECK(singleton=1), payload TEXT NOT NULL);
             CREATE TABLE snapshot_checkpoints(
               checkpoint_index INTEGER PRIMARY KEY CHECK(checkpoint_index>=0),
               sbar_id TEXT NOT NULL, ts_event TEXT NOT NULL, record_kind TEXT NOT NULL,
               state_data TEXT NOT NULL, diagnostics TEXT NOT NULL);
             CREATE INDEX snapshot_checkpoints_sbar_id ON snapshot_checkpoints(sbar_id);"
        ).map_err(|e| format!("Create Snapshot schema: {e}"))?;
        tx.execute("INSERT INTO snapshot_manifest(singleton,payload) VALUES(1,?1)",
            params![serde_json::to_string(&manifest).map_err(|e| e.to_string())?])
            .map_err(|e| format!("Persist initial Manifest: {e}"))?;
        tx.commit().map_err(|e| format!("Commit Snapshot initialization transaction: {e}"))?;
        self.manifest = Some(manifest);
        self.connection = Some(connection);
        Ok(())
    }

    fn commit_checkpoint(&mut self, index: usize, sbar_id: &str,
        projection: &ReplayCheckpointProjection) -> Result<(), String> {
        let mut manifest = self.manifest.clone().ok_or("Snapshot not initialized")?;
        if manifest.status != STATUS_RECORDING {
            return Err(format!("Cannot append checkpoint to Snapshot in {}", manifest.status));
        }
        if index != self.checkpoints.len() {
            return Err(format!("Expected checkpoint index {}, got {index}", self.checkpoints.len()));
        }
        let expected_sbar_id = self.input.bar_ids.get(index)
            .ok_or_else(|| format!("Checkpoint index {index} exceeds the fixed input sequence"))?;
        if sbar_id != expected_sbar_id {
            return Err(format!(
                "Checkpoint SBar ID does not match fixed input at index {index}: expected={expected_sbar_id}, actual={sbar_id}"
            ));
        }
        if projection.state_key != self.input.state_key {
            return Err(format!(
                "Checkpoint StruxisStateKey mismatch: expected={}, actual={}",
                self.input.state_key, projection.state_key
            ));
        }
        if projection.last_ts_event.as_deref() != Some(sbar_id) {
            return Err("Checkpoint projection SBar ID mismatch".into());
        }
        for diagnostic in &projection.diagnostics {
            if diagnostic.checkpoint_index != Some(index) {
                return Err(format!(
                    "Checkpoint diagnostic index mismatch at checkpoint {index}: expected Some({index}), actual={:?}",
                    diagnostic.checkpoint_index
                ));
            }
        }
        let record = SnapshotCheckpointRecord {
            checkpoint_index: index,
            sbar_id: sbar_id.to_owned(),
            ts_event: sbar_id.to_owned(),
            record_kind: "Full".into(),
            state_data: canonical_structure_state(projection.structure.as_ref())?,
            diagnostics: canonical_diagnostics_json(&projection.diagnostics)?,
        };
        let connection = self.connection.as_mut().ok_or("Snapshot DB is closed")?;
        let tx = connection.transaction().map_err(|e| format!("Begin checkpoint transaction: {e}"))?;
        tx.execute("INSERT INTO snapshot_checkpoints(checkpoint_index,sbar_id,ts_event,record_kind,state_data,diagnostics)
                    VALUES(?1,?2,?3,?4,?5,?6)",
            params![
                i64::try_from(index).map_err(|_| "Checkpoint index exceeds SQLite INTEGER range")?,
                record.sbar_id, record.ts_event, record.record_kind, record.state_data, record.diagnostics
            ]).map_err(|e| format!("Insert checkpoint: {e}"))?;
        manifest.checkpoint_count = index + 1;
        tx.execute("UPDATE snapshot_manifest SET payload=?1 WHERE singleton=1",
            params![serde_json::to_string(&manifest).map_err(|e| e.to_string())?])
            .map_err(|e| format!("Update Manifest checkpoint count: {e}"))?;
        tx.commit().map_err(|e| format!("Commit checkpoint transaction: {e}"))?;
        self.checkpoints.push(record);
        self.manifest = Some(manifest);
        Ok(())
    }

    fn finalize(&mut self, state: &RunState) -> Result<(), String> {
        self.finalize_snapshot(state)
    }

    fn fail(&mut self, _diagnostic: &str) -> Result<(), String> {
        let Some(mut manifest) = self.manifest.clone() else {
            // Initialization may fail before a valid Manifest has been committed.
            return Ok(());
        };
        if manifest.status == STATUS_FAILED {
            return Ok(());
        }
        // Once the Complete Manifest and checksum have been committed, never
        // mutate that payload to Failed: status is covered by the checksum.
        // A later publication / directory-sync failure is reported separately;
        // a published artifact remains valid only if its existing checksum verifies.
        if manifest.status == STATUS_COMPLETE
            && !manifest.content_checksum.is_empty()
            && self.published_by_this_writer
            && self.published_path.exists()
        {
            // Publication succeeded through an atomic hard link. Even if
            // temporary-link cleanup failed, both names refer to the same inode;
            // never rewrite its Complete Manifest through the temporary path.
            self.manifest = Some(manifest);
            return Ok(());
        }
        manifest.status = STATUS_FAILED.to_owned();
        // Failed temporary artifacts are recovery records, not valid Snapshots.
        // Clear any checksum computed for the previous Complete status so the
        // failed manifest never advertises a checksum for different content.
        manifest.content_checksum.clear();
        let payload = serde_json::to_string(&manifest)
            .map_err(|e| format!("Encode failed Snapshot Manifest: {e}"))?;

        if let Some(connection) = self.connection.as_mut() {
            let tx = connection.transaction()
                .map_err(|e| format!("Begin failed Snapshot status transaction: {e}"))?;
            tx.execute("UPDATE snapshot_manifest SET payload=?1 WHERE singleton=1", params![payload])
                .map_err(|e| format!("Persist failed Snapshot status: {e}"))?;
            tx.commit().map_err(|e| format!("Commit failed Snapshot status: {e}"))?;
        } else {
            // Finalization closes the writer connection before read-only
            // verification and publication. If either later step fails, reopen
            // whichever artifact exists and ensure it is not left marked Complete.
            let target = if self.temporary_path.exists() {
                &self.temporary_path
            } else if self.published_path.exists() {
                &self.published_path
            } else {
                self.manifest = Some(manifest);
                return Ok(());
            };
            let mut connection = Connection::open(target)
                .map_err(|e| format!("Reopen failed Snapshot for status update: {e}"))?;
            let tx = connection.transaction()
                .map_err(|e| format!("Begin failed Snapshot status transaction: {e}"))?;
            tx.execute("UPDATE snapshot_manifest SET payload=?1 WHERE singleton=1", params![payload])
                .map_err(|e| format!("Persist failed Snapshot status: {e}"))?;
            tx.commit().map_err(|e| format!("Commit failed Snapshot status: {e}"))?;
        }
        self.manifest = Some(manifest);
        Ok(())
    }
}

fn read_database(path: &Path) -> Result<(SnapshotManifest, Vec<SnapshotCheckpointRecord>), String> {
    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)
        .map_err(|e| format!("Read-only reopen Snapshot: {e}"))?;
    let payload: String = connection.query_row(
        "SELECT payload FROM snapshot_manifest WHERE singleton=1", [], |row| row.get(0))
        .map_err(|e| format!("Read Snapshot Manifest: {e}"))?;
    let manifest = serde_json::from_str(&payload).map_err(|e| format!("Decode Snapshot Manifest: {e}"))?;
    let mut stmt = connection.prepare("SELECT checkpoint_index,sbar_id,ts_event,record_kind,state_data,diagnostics
                                       FROM snapshot_checkpoints ORDER BY checkpoint_index")
        .map_err(|e| format!("Prepare checkpoint read: {e}"))?;
    let rows = stmt.query_map([], |row| Ok((
        row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?,
        row.get::<_, String>(3)?, row.get::<_, String>(4)?, row.get::<_, String>(5)?,
    ))).map_err(|e| format!("Query checkpoints: {e}"))?;
    let mut records = Vec::new();
    for row in rows {
        let (index, sbar_id, ts_event, record_kind, state_data, diagnostics) =
            row.map_err(|e| format!("Read checkpoint: {e}"))?;
        records.push(SnapshotCheckpointRecord {
            checkpoint_index: usize::try_from(index).map_err(|_| "Negative checkpoint index")?,
            sbar_id, ts_event, record_kind, state_data, diagnostics,
        });
    }
    Ok((manifest, records))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        catalog::OriginLoad,
        dataset::{sequence_fingerprint, TestDataset},
        diagnostics::Diagnostic,
    };
    use capitus_struxis::StruxisStateKey;
    use nautilus_model::{
        data::{Bar, BarType},
        types::{Price, Quantity},
    };
    use std::{str::FromStr, time::{SystemTime, UNIX_EPOCH}};

    fn input() -> LoadedInput {
        let bar_type = BarType::from_str("AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL").unwrap();
        let bars = vec![
            Bar::new(bar_type, Price::from("10.00"), Price::from("12.00"),
                Price::from("9.00"), Price::from("11.00"), Quantity::from("100"),
                100_u64.into(), 100_u64.into()),
            Bar::new(bar_type, Price::from("11.00"), Price::from("13.00"),
                Price::from("10.00"), Price::from("12.00"), Quantity::from("100"),
                200_u64.into(), 200_u64.into()),
        ];
        let state_key = StruxisStateKey::from_bar_type(&bar_type);
        let fingerprint = sequence_fingerprint(state_key, &bars).unwrap();
        let origin = OriginLoad {
            origin_dataset_id: uuid::Uuid::new_v4(),
            state_key,
            sbar_sequence_fingerprint: fingerprint,
            bar_type: bar_type.to_string(),
            bars,
            structure: None,
        };
        LoadedInput::from_test(&TestDataset::create(&origin, "100", "200").unwrap()).unwrap()
    }

    fn config() -> EffectiveStruxisConfig {
        EffectiveStruxisConfig {
            enable_structure: true,
            structure_cbars_capacity: 10000,
            structure_swings_capacity: 2000,
            structure_trends_capacity: 666,
        }
    }

    #[test]
    fn commits_checkpoints_and_publishes_only_a_verified_complete_snapshot() {
        let root = std::env::temp_dir().join(format!(
            "capitus-snapshot-writer-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        let input = input();
        let mut writer = SnapshotWriter::new(&root, &input, "AUD/USD.SIM").unwrap();
        let mut state = RunState::ready("writer-test".into(), input.test_dataset_id.clone(),
            input.sbar_sequence_fingerprint.clone(), input.bars.len()).unwrap();
        writer.initialize(&state, &config()).unwrap();

        for (index, sbar_id) in ["100", "200"].iter().enumerate() {
            let projection = ReplayCheckpointProjection {
                state_key: format!("{:?}", input.state_key),
                last_ts_event: Some((*sbar_id).into()),
                sbar_count: index + 1,
                sbars: vec![],
                structure: None,
                diagnostics: if index == 1 {
                    vec![Diagnostic {
                        source: "replay".into(),
                        severity: "warning".into(),
                        category: "TestDiagnostic".into(),
                        object_type: None,
                        object_id: None,
                        sbar_ids: vec![(*sbar_id).into()],
                        checkpoint_index: Some(index),
                        message: "diagnostic persistence fixture".into(),
                    }]
                } else {
                    Vec::new()
                },
            };
            writer.commit_checkpoint(index, sbar_id, &projection).unwrap();
            state.confirm_checkpoint((*sbar_id).into()).unwrap();
        }
        assert_eq!(state.status, RunStatus::Completed);
        writer.finalize(&state).unwrap();

        assert!(writer.published_path().is_file());
        assert!(!writer.temporary_path.exists(), "successful publication removes the temporary link");
        let (manifest, records) = read_database(writer.published_path()).unwrap();
        verify_complete_snapshot(&manifest, &records).unwrap();
        assert_eq!(manifest.status, STATUS_COMPLETE);
        assert_eq!(records.len(), 2);
        assert_eq!(records[0].diagnostics, "[]");
        let diagnostics: Vec<Diagnostic> = serde_json::from_str(&records[1].diagnostics).unwrap();
        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].category, "TestDiagnostic");
        assert_eq!(diagnostics[0].checkpoint_index, Some(1));
        drop(writer);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn directory_sync_failure_preserves_the_verified_checksum_and_status() {
        let root = std::env::temp_dir().join(format!(
            "capitus-snapshot-directory-sync-failure-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        let input = input();
        let mut writer = SnapshotWriter::new(&root, &input, "AUD/USD.SIM").unwrap();
        let mut state = RunState::ready(
            "writer-directory-sync-failure".into(),
            input.test_dataset_id.clone(),
            input.sbar_sequence_fingerprint.clone(),
            input.bars.len(),
        ).unwrap();
        writer.initialize(&state, &config()).unwrap();

        for (index, bar) in input.bars.iter().enumerate() {
            let sbar_id = bar.ts_event.to_string();
            let projection = ReplayCheckpointProjection {
                state_key: format!("{:?}", input.state_key),
                last_ts_event: Some(sbar_id.clone()),
                sbar_count: index + 1,
                sbars: vec![],
                structure: None,
            diagnostics: Vec::new(),
            };
            writer.commit_checkpoint(index, &sbar_id, &projection).unwrap();
            state.confirm_checkpoint(sbar_id).unwrap();
        }
        assert_eq!(state.status, RunStatus::Completed);

        // Inject failure only after the verified temporary file has been
        // renamed into the published namespace.
        writer.fail_directory_sync = true;
        let error = writer.finalize(&state).unwrap_err();
        assert!(error.contains("simulated directory sync failure"));
        assert!(writer.published_path().is_file());

        // Do not rewrite status after checksum verification: status is part
        // of the checksum payload. The caller still reports the directory-sync
        // error, while discovery independently verifies the published artifact.
        writer.fail("simulated directory sync failure").unwrap();
        let (manifest, records) = read_database(writer.published_path()).unwrap();
        assert_eq!(manifest.status, STATUS_COMPLETE);
        assert_eq!(records.len(), input.bars.len());
        verify_complete_snapshot(&manifest, &records).unwrap();

        let artifacts = crate::snapshot_store::discover_snapshot_artifacts(&root).unwrap();
        assert_eq!(artifacts.len(), 1);
        assert_eq!(artifacts[0].kind, crate::snapshot_store::SnapshotArtifactKind::Complete);
        assert_eq!(artifacts[0].snapshot_id.as_deref(), Some(manifest.snapshot_id.as_str()));

        drop(writer);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn publish_destination_collision_never_replaces_existing_file() {
        let root = std::env::temp_dir().join(format!(
            "capitus-snapshot-publish-collision-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        let input = input();
        let mut writer = SnapshotWriter::new(&root, &input, "AUD/USD.SIM").unwrap();
        let mut state = RunState::ready(
            "writer-publish-collision".into(),
            input.test_dataset_id.clone(),
            input.sbar_sequence_fingerprint.clone(),
            input.bars.len(),
        ).unwrap();
        writer.initialize(&state, &config()).unwrap();

        for (index, bar) in input.bars.iter().enumerate() {
            let sbar_id = bar.ts_event.to_string();
            let projection = ReplayCheckpointProjection {
                state_key: format!("{:?}", input.state_key),
                last_ts_event: Some(sbar_id.clone()),
                sbar_count: index + 1,
                sbars: vec![],
                structure: None,
                diagnostics: Vec::new(),
            };
            writer.commit_checkpoint(index, &sbar_id, &projection).unwrap();
            state.confirm_checkpoint(sbar_id).unwrap();
        }

        fs::write(writer.published_path(), b"pre-existing artifact").unwrap();
        let error = writer.finalize(&state).unwrap_err();
        assert!(error.contains("publish destination already exists"));
        writer.fail("publish destination collision").unwrap();

        assert_eq!(
            fs::read(writer.published_path()).unwrap(),
            b"pre-existing artifact",
            "publication must never overwrite an artifact created at the destination",
        );
        let (failed_manifest, _) = read_database(&writer.temporary_path).unwrap();
        assert_eq!(failed_manifest.status, STATUS_FAILED);

        drop(writer);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn temporary_link_cleanup_failure_preserves_published_complete_snapshot() {
        let root = std::env::temp_dir().join(format!(
            "capitus-snapshot-cleanup-failure-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        let input = input();
        let mut writer = SnapshotWriter::new(&root, &input, "AUD/USD.SIM").unwrap();
        let mut state = RunState::ready(
            "writer-cleanup-failure".into(),
            input.test_dataset_id.clone(),
            input.sbar_sequence_fingerprint.clone(),
            input.bars.len(),
        ).unwrap();
        writer.initialize(&state, &config()).unwrap();

        for (index, bar) in input.bars.iter().enumerate() {
            let sbar_id = bar.ts_event.to_string();
            let projection = ReplayCheckpointProjection {
                state_key: format!("{:?}", input.state_key),
                last_ts_event: Some(sbar_id.clone()),
                sbar_count: index + 1,
                sbars: vec![],
                structure: None,
                diagnostics: Vec::new(),
            };
            writer.commit_checkpoint(index, &sbar_id, &projection).unwrap();
            state.confirm_checkpoint(sbar_id).unwrap();
        }

        writer.fail_temporary_cleanup = true;
        writer.finalize(&state).unwrap();
        assert!(writer.published_path().is_file());
        assert!(writer.temporary_path.is_file());

        // The two paths are hard links to one inode. Failure handling must not
        // mutate the Complete Manifest through the leftover temporary name.
        writer.fail("temporary link cleanup failed").unwrap();
        let (manifest, records) = read_database(writer.published_path()).unwrap();
        assert_eq!(manifest.status, STATUS_COMPLETE);
        verify_complete_snapshot(&manifest, &records).unwrap();

        drop(writer);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn checkpoint_commit_rejects_identity_mismatches_without_advancing_writer() {
        let root = std::env::temp_dir().join(format!(
            "capitus-snapshot-writer-identity-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        let input = input();
        let mut writer = SnapshotWriter::new(&root, &input, "AUD/USD.SIM").unwrap();
        let state = RunState::ready("writer-identity".into(), input.test_dataset_id.clone(),
            input.sbar_sequence_fingerprint.clone(), input.bars.len()).unwrap();
        writer.initialize(&state, &config()).unwrap();

        let mut projection = ReplayCheckpointProjection {
            state_key: format!("{:?}", input.state_key),
            last_ts_event: Some("999".into()),
            sbar_count: 1,
            sbars: vec![],
            structure: None,
        diagnostics: Vec::new(),
        };
        assert!(writer.commit_checkpoint(0, "999", &projection).unwrap_err()
            .contains("does not match fixed input"));
        assert!(writer.checkpoints.is_empty());

        projection.state_key = "wrong-state-key".into();
        projection.last_ts_event = Some("100".into());
        assert!(writer.commit_checkpoint(0, "100", &projection).unwrap_err()
            .contains("StruxisStateKey mismatch"));
        assert!(writer.checkpoints.is_empty());

        drop(writer);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn checkpoint_commit_rejects_out_of_order_index_without_advancing_writer() {
        let root = std::env::temp_dir().join(format!(
            "capitus-snapshot-writer-order-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        let input = input();
        let mut writer = SnapshotWriter::new(&root, &input, "AUD/USD.SIM").unwrap();
        let state = RunState::ready("writer-order".into(), input.test_dataset_id.clone(),
            input.sbar_sequence_fingerprint.clone(), input.bars.len()).unwrap();
        writer.initialize(&state, &config()).unwrap();
        let projection = ReplayCheckpointProjection {
            state_key: format!("{:?}", input.state_key),
            last_ts_event: Some("100".into()),
            sbar_count: 1,
            sbars: vec![],
            structure: None,
        diagnostics: Vec::new(),
        };
        assert!(writer.commit_checkpoint(1, "100", &projection).unwrap_err()
            .contains("Expected checkpoint index 0"));
        assert!(writer.checkpoints.is_empty());
        drop(writer);
        let _ = fs::remove_dir_all(root);
    }
}
