//! Application services and session-owned Origin state for Struxis Debugger.

use std::{
    path::PathBuf,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
};

use nautilus_model::{
    data::Bar,
    instruments::{Instrument, InstrumentAny},
};
use nautilus_persistence::backend::parquet::catalog::ParquetDataCatalog;
use serde::Serialize;

use crate::{
    checkpoint::{ReplayInspectorProjection, ReplayStepResult, StructureCheckpoint},
    catalog::{OriginLoad, load_origin as load_origin_candidate},
    compare::{compare_snapshot_paths, CompareRejectCategory, CompareRejection, SnapshotCompareResult},
    dataset::{sequence_fingerprint, TestDataset},
    discovery::{CatalogDatasetEntry, configured_catalog_root, discover_catalog_datasets},
    ipc::{IpcError, IpcErrorCode},
    replay::LoadedInput,
    run::RunState,
    manager::ReplayManager,
    snapshot_store::{discover_snapshot_artifacts, read_complete_snapshot_typed, SnapshotArtifact, SnapshotArtifactKind},
    snapshot_writer::SnapshotWriter,
    worker::ReplayWorkerConfig,
};

/// Tauri-managed application state. Nautilus runtime objects are deliberately
/// not retained: Origin stores only the owned result produced after Engine
/// disposal and complete Struxis SBar validation.
#[derive(Clone)]
pub(crate) struct AppState {
    inner: Arc<AppStateInner>,
}

struct AppStateInner {
    catalog_path: PathBuf,
    snapshot_root: PathBuf,
    datasets: Mutex<AppDatasets>,
    replay_manager: Mutex<ReplayManager>,
    mutation_active: AtomicBool,
}

struct AppDatasets {
    current_origin: Option<OriginRecord>,
    current_test: Option<TestRecord>,
}

#[derive(Clone)]
struct OriginRecord {
    dataset: OriginLoad,
    catalog_path: PathBuf,
    enable_structure: bool,
}

#[derive(Clone)]
struct TestRecord {
    dataset: TestDataset,
}

impl AppState {
    #[must_use]
    pub(crate) fn new(catalog_path: PathBuf) -> Self {
        Self::with_snapshot_root(catalog_path, configured_snapshot_root())
    }

    /// Creates application state with an explicit Snapshot root.
    ///
    /// This keeps discovery deterministic for isolated tests and callers that
    /// manage Snapshot storage outside the default user data directory.
    #[must_use]
    pub(crate) fn with_snapshot_root(catalog_path: PathBuf, snapshot_root: PathBuf) -> Self {
        Self {
            inner: Arc::new(AppStateInner {
                snapshot_root,
                catalog_path,
                datasets: Mutex::new(AppDatasets {
                    current_origin: None,
                    current_test: None,
                }),
                replay_manager: Mutex::new(ReplayManager::new()),
                mutation_active: AtomicBool::new(false),
            }),
        }
    }

    #[must_use]
    pub(crate) fn with_configured_catalog() -> Self {
        Self::new(configured_catalog_root())
    }

    pub(crate) fn discover_datasets(&self) -> Result<Vec<CatalogDatasetEntry>, IpcError> {
        discover_catalog_datasets(&self.inner.catalog_path).map_err(|error| {
            IpcError::new(
                IpcErrorCode::Internal,
                format!("Catalog discovery failed: {error}"),
            )
        })
    }

    pub(crate) fn load_origin(
        &self,
        dataset_id: &str,
        enable_structure: bool,
    ) -> Result<OriginDatasetDto, IpcError> {
        let _permit = self.acquire_mutation_permit()?;
        self.ensure_no_owned_run()?;

        let entries = discover_catalog_datasets(&self.inner.catalog_path).map_err(|error| {
            IpcError::new(
                IpcErrorCode::Internal,
                format!("Catalog discovery failed before Load: {error}"),
            )
        })?;
        let selected = entries
            .iter()
            .find(|entry| entry.id == dataset_id)
            .ok_or_else(|| {
                IpcError::new(
                    IpcErrorCode::NotFound,
                    format!("Catalog dataset entry {dataset_id} no longer exists"),
                )
            })?;
        if !selected.available {
            return Err(IpcError::new(
                IpcErrorCode::InvalidArgument,
                selected
                    .diagnostic
                    .clone()
                    .unwrap_or_else(|| "Selected Catalog dataset is unavailable".to_owned()),
            ));
        }
        let bar_type = selected.bar_type.as_deref().ok_or_else(|| {
            IpcError::new(
                IpcErrorCode::InvalidArgument,
                "Selected Catalog entry has no resolved BarType",
            )
        })?;

        let candidate = load_origin_candidate(
            &self.inner.catalog_path,
            bar_type,
            enable_structure,
        )
        .map_err(|error| {
            IpcError::new(
                IpcErrorCode::Internal,
                format!("Origin Load failed: {error}"),
            )
        })?;

        // Build all frontend metadata before entering the single publication
        // critical section. A failed candidate leaves the previous Origin intact.
        let record = OriginRecord {
            dataset: candidate,
            catalog_path: self.inner.catalog_path.clone(),
            enable_structure,
        };
        self.publish_origin(record)
    }

    fn publish_origin(&self, record: OriginRecord) -> Result<OriginDatasetDto, IpcError> {
        let dto = record.to_dto();
        let mut datasets = self.inner.datasets.lock().map_err(|_| {
            IpcError::new(
                IpcErrorCode::Internal,
                "Application dataset state is unavailable because its lock was poisoned",
            )
        })?;
        datasets.current_origin = Some(record);
        // A successful Origin replacement invalidates a Test derived from the old Origin.
        datasets.current_test = None;
        Ok(dto)
    }

    pub(crate) fn current_origin(&self) -> Result<Option<OriginDatasetDto>, IpcError> {
        let datasets = self.inner.datasets.lock().map_err(|_| {
            IpcError::new(
                IpcErrorCode::Internal,
                "Application dataset state is unavailable because its lock was poisoned",
            )
        })?;
        Ok(datasets.current_origin.as_ref().map(OriginRecord::to_dto))
    }

    pub(crate) fn create_test_dataset(
        &self,
        start_sbar_id: &str,
        end_sbar_id: &str,
    ) -> Result<TestDatasetDto, IpcError> {
        let _permit = self.acquire_mutation_permit()?;
        self.ensure_no_owned_run()?;

        let mut datasets = self.inner.datasets.lock().map_err(|_| {
            IpcError::new(
                IpcErrorCode::Internal,
                "Application dataset state is unavailable because its lock was poisoned",
            )
        })?;
        let origin = datasets.current_origin.as_ref().ok_or_else(|| {
            IpcError::new(
                IpcErrorCode::InvalidState,
                "Load and validate an Origin Dataset before creating a Test Dataset",
            )
        })?;
        let test = TestDataset::create(&origin.dataset, start_sbar_id, end_sbar_id).map_err(|error| {
            IpcError::new(
                IpcErrorCode::InvalidArgument,
                format!("Test Dataset selection rejected: {error}"),
            )
        })?;
        let record = TestRecord { dataset: test };
        let dto = record.to_dto();
        datasets.current_test = Some(record);
        Ok(dto)
    }

    pub(crate) fn current_test_dataset(&self) -> Result<Option<TestDatasetDto>, IpcError> {
        let datasets = self.inner.datasets.lock().map_err(|_| {
            IpcError::new(
                IpcErrorCode::Internal,
                "Application dataset state is unavailable because its lock was poisoned",
            )
        })?;
        Ok(datasets.current_test.as_ref().map(TestRecord::to_dto))
    }

    pub(crate) fn compare_snapshots(
        &self,
        baseline_snapshot_id: &str,
        candidate_snapshot_id: &str,
    ) -> Result<SnapshotCompareResult, CompareRejection> {
        let artifacts = discover_snapshot_artifacts(&self.inner.snapshot_root).map_err(|message| {
            CompareRejection {
                category: CompareRejectCategory::SnapshotUnreadable,
                message: format!("Snapshot discovery failed: {message}"),
            }
        })?;
        // Resolve published artifacts by their filename identity as well as
        // the decoded Manifest. If a published SQLite file is unreadable, its
        // Manifest may be unavailable; still pass that file to the typed reader
        // so Compare reports SnapshotUnreadable instead of misclassifying it as
        // a missing/incomplete Snapshot.
        let find_published = |snapshot_id: &str| {
            artifacts.iter().find(|artifact| {
                matches!(
                    &artifact.kind,
                    crate::snapshot_store::SnapshotArtifactKind::Complete
                        | crate::snapshot_store::SnapshotArtifactKind::InvalidPublished
                ) && (
                    artifact.snapshot_id.as_deref() == Some(snapshot_id)
                        || artifact.file_name.strip_suffix(".snapshot.sqlite") == Some(snapshot_id)
                )
            }).map(|artifact| artifact.path.clone())
        };
        let baseline_path = find_published(baseline_snapshot_id).ok_or_else(|| CompareRejection {
            category: CompareRejectCategory::SnapshotIncomplete,
            message: format!("Baseline Snapshot is not a published artifact: {baseline_snapshot_id}"),
        })?;
        let candidate_path = find_published(candidate_snapshot_id).ok_or_else(|| CompareRejection {
            category: CompareRejectCategory::SnapshotIncomplete,
            message: format!("Candidate Snapshot is not a published artifact: {candidate_snapshot_id}"),
        })?;
        compare_snapshot_paths(baseline_path, candidate_path)
    }

    pub(crate) fn discover_snapshots(&self) -> Result<Vec<SnapshotArtifact>, IpcError> {
        discover_snapshot_artifacts(&self.inner.snapshot_root).map_err(|error| {
            IpcError::new(IpcErrorCode::Internal, format!("Snapshot discovery failed: {error}"))
        })
    }

    /// Resolves an immutable Snapshot Reference against its original Catalog input,
    /// independently of whichever Origin Dataset is currently loaded in the UI.
    pub(crate) fn snapshot_reference(&self, snapshot_id: &str) -> Result<SnapshotReferenceDto, IpcError> {
        let artifacts = discover_snapshot_artifacts(&self.inner.snapshot_root).map_err(|error| {
            IpcError::new(IpcErrorCode::Internal, format!("Snapshot discovery failed: {error}"))
        })?;
        let artifact = artifacts.iter().find(|artifact| {
            artifact.kind == SnapshotArtifactKind::Complete
                && (artifact.snapshot_id.as_deref() == Some(snapshot_id)
                    || artifact.file_name.strip_suffix(".snapshot.sqlite") == Some(snapshot_id))
        }).ok_or_else(|| IpcError::new(
            IpcErrorCode::NotFound,
            format!("No complete, published Snapshot exists for {snapshot_id}"),
        ))?;

        let (manifest, checkpoints) = read_complete_snapshot_typed(&artifact.path).map_err(|error| {
            IpcError::new(IpcErrorCode::InvalidState, format!("Snapshot Reference rejected: {error}"))
        })?;
        if manifest.snapshot_id != snapshot_id
            && artifact.file_name.strip_suffix(".snapshot.sqlite") != Some(snapshot_id)
        {
            return Err(IpcError::new(IpcErrorCode::InvalidState,
                "Snapshot identity changed while resolving the reference"));
        }

        // Re-read the full exact BarType from Catalog. The persisted Snapshot
        // fingerprint is only accepted after recomputing it over the exact
        // inclusive input slice; a current Origin or matching time range alone
        // is never treated as proof of market-data identity.
        let catalog_projection = load_origin_candidate(
            &self.inner.catalog_path,
            &manifest.bar_type,
            false,
        ).map_err(|error| {
            IpcError::new(IpcErrorCode::Internal,
                format!("Resolve and validate Snapshot Catalog input through Struxis failed: {error}"))
        })?;
        let catalog_bars = &catalog_projection.bars;
        let start = catalog_bars.iter().position(|bar| bar.ts_event.to_string() == manifest.input_start_sbar_id)
            .ok_or_else(|| IpcError::new(IpcErrorCode::NotFound,
                format!("Snapshot input start SBar {} is absent from Catalog", manifest.input_start_sbar_id)))?;
        let end = catalog_bars.iter().position(|bar| bar.ts_event.to_string() == manifest.input_end_sbar_id)
            .ok_or_else(|| IpcError::new(IpcErrorCode::NotFound,
                format!("Snapshot input end SBar {} is absent from Catalog", manifest.input_end_sbar_id)))?;
        if end < start {
            return Err(IpcError::new(IpcErrorCode::InvalidState,
                "Snapshot input boundaries are reversed in the current Catalog sequence"));
        }
        let bars = &catalog_bars[start..=end];
        if bars.len() != manifest.input_bar_count
            || bars.first().map(|bar| bar.ts_event.to_string()).as_deref() != Some(manifest.input_start_ts_event.as_str())
            || bars.last().map(|bar| bar.ts_event.to_string()).as_deref() != Some(manifest.input_end_ts_event.as_str())
        {
            return Err(IpcError::new(IpcErrorCode::InvalidState,
                "Catalog Snapshot input count or boundary timestamps do not match the Manifest"));
        }
        let state_key = catalog_projection.state_key;
        if state_key.instrument_id.to_string() != manifest.instrument_id {
            return Err(IpcError::new(IpcErrorCode::InvalidState,
                "Catalog instrument identity does not match the Snapshot Manifest"));
        }
        let actual_fingerprint = sequence_fingerprint(state_key, bars).map_err(|error| {
            IpcError::new(IpcErrorCode::Internal,
                format!("Calculate Snapshot Catalog input fingerprint failed: {error}"))
        })?;
        if actual_fingerprint != manifest.sbar_sequence_fingerprint {
            return Err(IpcError::new(IpcErrorCode::InvalidState,
                "Catalog SBar sequence fingerprint does not match the Snapshot; historical chart is unavailable"));
        }

        let structure_timeline = checkpoints.iter().map(|checkpoint| {
            let mut structure = serde_json::from_str::<serde_json::Value>(&checkpoint.state_data).map_err(|error| {
                IpcError::new(IpcErrorCode::InvalidState,
                    format!("Decode Snapshot structure state at checkpoint {} failed: {error}", checkpoint.checkpoint_index))
            })?;
            let keyzones = structure.as_object_mut().and_then(|state| state.remove("keyzones"));
            Ok(SnapshotStructureCheckpointDto {
                sbar_id: checkpoint.sbar_id.clone(),
                keyzones,
                structure,
            })
        }).collect::<Result<Vec<_>, IpcError>>()?;
        let keyzones = structure_timeline.last().and_then(|checkpoint| checkpoint.keyzones.clone());
        let structure = structure_timeline.last().map(|checkpoint| checkpoint.structure.clone())
            .ok_or_else(|| IpcError::new(
                IpcErrorCode::InvalidState, "Complete Snapshot contains no checkpoint records"))?;
        Ok(SnapshotReferenceDto {
            snapshot_id: manifest.snapshot_id,
            run_id: manifest.run_id,
            instrument_id: manifest.instrument_id,
            bar_type: manifest.bar_type,
            timeframe: state_key.timeframe.to_string(),
            snapshot_generated_at: manifest.snapshot_generated_at,
            sbar_sequence_fingerprint: manifest.sbar_sequence_fingerprint,
            bars: bars.iter().map(sbar_to_dto).collect(),
            structure,
            structure_timeline,
            keyzones,
        })
    }

    fn acquire_mutation_permit(&self) -> Result<MutationPermit<'_>, IpcError> {
        self.inner
            .mutation_active
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| {
                IpcError::new(
                    IpcErrorCode::Conflict,
                    "Another dataset mutation or Run creation is already active",
                )
            })?;
        Ok(MutationPermit(&self.inner.mutation_active))
    }

    fn ensure_no_owned_run(&self) -> Result<(), IpcError> {
        let manager = self.inner.replay_manager.try_lock().map_err(|error| {
            let message = match error {
                std::sync::TryLockError::WouldBlock => {
                    "Dataset mutation rejected: a Replay command is active"
                }
                std::sync::TryLockError::Poisoned(_) => {
                    "Dataset mutation rejected: ReplayManager lock is poisoned"
                }
            };
            IpcError::new(IpcErrorCode::Conflict, message)
        })?;
        if manager.has_owned_run() {
            return Err(IpcError::new(
                IpcErrorCode::Conflict,
                "Dataset mutation rejected: an active Run still owns the Origin or Test Dataset; stop or reset Replay first",
            ));
        }
        Ok(())
    }

    fn prepare_run(&self) -> Result<ReplayWorkerConfig, IpcError> {
        let test = {
            let datasets = self.inner.datasets.lock().map_err(|_| {
                IpcError::new(IpcErrorCode::Internal, "Application dataset state lock is poisoned")
            })?;
            datasets.current_test.as_ref().map(|record| record.dataset.clone()).ok_or_else(|| {
                IpcError::new(IpcErrorCode::InvalidState, "Create a Test Dataset before starting a Run")
            })?
        };
        let input = LoadedInput::from_test(&test).map_err(|error| {
            IpcError::new(IpcErrorCode::InvalidArgument, format!("Replay input rejected: {error}"))
        })?;
        let instrument_filter = input.state_key.instrument_id.to_string();
        let catalog = ParquetDataCatalog::new(&self.inner.catalog_path, None, None, None, None);
        let instruments = catalog.query_instruments(Some(std::slice::from_ref(&instrument_filter)))
            .map_err(|error| IpcError::new(IpcErrorCode::Internal, format!("Load Replay instrument from Catalog: {error}")))?;
        let instrument: InstrumentAny = instruments.into_iter()
            .find(|instrument| instrument.id().to_string() == instrument_filter)
            .ok_or_else(|| IpcError::new(IpcErrorCode::NotFound,
                format!("Catalog has no instrument metadata for {}", input.state_key.instrument_id)))?;
        let run_id = uuid::Uuid::new_v4().to_string();
        Ok(ReplayWorkerConfig { run_id, input, instrument })
    }

    pub(crate) fn start_run(&self) -> Result<RunState, IpcError> {
        let _permit = self.acquire_mutation_permit()?;
        let config = self.prepare_run()?;
        self.with_replay_manager(|manager| manager.start_interactive(config))
    }

    pub(crate) fn restart_run(&self) -> Result<RunState, IpcError> {
        let _permit = self.acquire_mutation_permit()?;
        let config = self.prepare_run()?;
        self.with_replay_manager(|manager| manager.restart_interactive(config))
    }

    pub(crate) fn restart_to_sbar(
        &self,
        target_sbar_id: String,
    ) -> Result<ReplayStepResult, IpcError> {
        let _permit = self.acquire_mutation_permit()?;
        let config = self.prepare_run()?;
        if !config
            .input
            .bars
            .iter()
            .any(|bar| bar.ts_event.to_string() == target_sbar_id)
        {
            return Err(IpcError::new(
                IpcErrorCode::InvalidArgument,
                format!(
                    "Restart to SBar rejected: target {target_sbar_id} is not in the current Test Dataset"
                ),
            ));
        }
        self.with_replay_manager(|manager| manager.restart_to_sbar(config, target_sbar_id))
    }

    pub(crate) fn replay_state(&self) -> Result<Option<RunState>, IpcError> {
        self.with_replay_manager(ReplayManager::state)
    }

    pub(crate) fn replay_inspector(&self) -> Result<Option<ReplayInspectorProjection>, IpcError> {
        self.with_replay_manager(ReplayManager::inspector)
    }

    pub(crate) fn replay_step(&self) -> Result<ReplayStepResult, IpcError> {
        self.with_replay_manager(ReplayManager::step_checkpoint)
    }

    pub(crate) fn replay_play(&self) -> Result<RunState, IpcError> {
        self.with_replay_manager(ReplayManager::play)
    }

    pub(crate) fn replay_pause(&self) -> Result<RunState, IpcError> {
        self.with_replay_manager(ReplayManager::pause)
    }

    pub(crate) fn replay_stop(&self) -> Result<RunState, IpcError> {
        self.with_replay_manager(ReplayManager::stop)
    }

    pub(crate) fn replay_dispose(&self) -> Result<RunState, IpcError> {
        self.with_replay_manager(ReplayManager::dispose)
    }

    pub(crate) fn replay_reset(&self) -> Result<(), IpcError> {
        self.with_replay_manager(ReplayManager::reset)
    }

    /// Explicitly persists a completed Run's owned trajectory as a new Snapshot.
    /// The manager lock is released after exporting the immutable data, before
    /// SQLite I/O and publication begin.
    pub(crate) fn save_run_snapshot(&self) -> Result<String, IpcError> {
        let data = self.with_replay_manager(ReplayManager::snapshot_data)?;
        SnapshotWriter::save_completed(
            &self.inner.snapshot_root,
            &data.input,
            &data.instrument_id,
            &data.state,
            &data.effective_config,
            &data.checkpoints,
        )
        .map_err(|error| IpcError::new(
            IpcErrorCode::Internal,
            format!("Save Run Snapshot failed: {error}"),
        ))
    }

    fn with_replay_manager<T>(
        &self,
        operation: impl FnOnce(&mut ReplayManager) -> Result<T, String>,
    ) -> Result<T, IpcError> {
        let mut manager = self.inner.replay_manager.try_lock().map_err(|error| {
            let message = match error {
                std::sync::TryLockError::WouldBlock => "Replay command rejected: another command is active",
                std::sync::TryLockError::Poisoned(_) => "ReplayManager lock is poisoned",
            };
            IpcError::new(IpcErrorCode::Conflict, message)
        })?;
        operation(&mut manager).map_err(|error| {
            IpcError::new(IpcErrorCode::InvalidState, error)
        })
    }

    #[cfg(test)]
    #[must_use]
    pub(crate) fn catalog_path(&self) -> &std::path::Path {
        &self.inner.catalog_path
    }
}


fn configured_snapshot_root() -> PathBuf {
    if let Some(path) = std::env::var_os("CAPITUS_STRUXIS_DEBUGGER_SNAPSHOT_DIR") {
        return PathBuf::from(path);
    }
    if let Some(path) = std::env::var_os("XDG_DATA_HOME") {
        return PathBuf::from(path).join("capitus/struxis-debugger/snapshots");
    }
    if let Some(home) = std::env::var_os("HOME") {
        return PathBuf::from(home).join(".local/share/capitus/struxis-debugger/snapshots");
    }
    std::env::temp_dir().join("capitus/struxis-debugger/snapshots")
}

struct MutationPermit<'a>(&'a AtomicBool);

impl Drop for MutationPermit<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OriginDatasetDto {
    pub(crate) origin_dataset_id: String,
    pub(crate) source_catalog: String,
    pub(crate) enable_structure: bool,
    pub(crate) instrument_id: String,
    pub(crate) bar_type: String,
    pub(crate) timeframe: String,
    pub(crate) sbar_sequence_fingerprint: String,
    pub(crate) sbar_count: usize,
    pub(crate) first_sbar_id: String,
    pub(crate) last_sbar_id: String,
    pub(crate) first_ts_event: String,
    pub(crate) last_ts_event: String,
    pub(crate) bars: Vec<SBarDto>,
    pub(crate) structure: Option<StructureCheckpoint>,
    pub(crate) keyzones: Option<crate::checkpoint::KeyZoneCheckpoint>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SnapshotReferenceDto {
    pub(crate) snapshot_id: String,
    pub(crate) run_id: String,
    pub(crate) instrument_id: String,
    pub(crate) bar_type: String,
    pub(crate) timeframe: String,
    pub(crate) snapshot_generated_at: String,
    pub(crate) sbar_sequence_fingerprint: String,
    pub(crate) bars: Vec<SBarDto>,
    pub(crate) structure: serde_json::Value,
    pub(crate) structure_timeline: Vec<SnapshotStructureCheckpointDto>,
    pub(crate) keyzones: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SnapshotStructureCheckpointDto {
    pub(crate) keyzones: Option<serde_json::Value>,
    pub(crate) sbar_id: String,
    pub(crate) structure: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TestDatasetDto {
    pub(crate) test_dataset_id: String,
    pub(crate) origin_dataset_id: String,
    pub(crate) instrument_id: String,
    pub(crate) bar_type: String,
    pub(crate) timeframe: String,
    pub(crate) start_sbar_id: String,
    pub(crate) end_sbar_id: String,
    pub(crate) sbar_count: usize,
    pub(crate) sbar_sequence_fingerprint: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SBarDto {
    pub(crate) sbar_id: String,
    pub(crate) bar_type: String,
    pub(crate) ts_event: String,
    pub(crate) ts_init: String,
    pub(crate) open: String,
    pub(crate) high: String,
    pub(crate) low: String,
    pub(crate) close: String,
    pub(crate) volume: String,
}

impl TestRecord {
    fn to_dto(&self) -> TestDatasetDto {
        let dataset = &self.dataset;
        TestDatasetDto {
            test_dataset_id: dataset.test_dataset_id().to_string(),
            origin_dataset_id: dataset.origin_dataset_id().to_string(),
            instrument_id: dataset.state_key().instrument_id.to_string(),
            bar_type: dataset.bar_type().to_owned(),
            timeframe: dataset.state_key().timeframe.to_string(),
            start_sbar_id: dataset.start_sbar_id().to_owned(),
            end_sbar_id: dataset.end_sbar_id().to_owned(),
            sbar_count: dataset.bars().len(),
            sbar_sequence_fingerprint: dataset.sbar_sequence_fingerprint().to_owned(),
        }
    }
}

impl OriginRecord {
    fn to_dto(&self) -> OriginDatasetDto {
        let dataset = &self.dataset;
        let bars = dataset.bars.iter().map(sbar_to_dto).collect::<Vec<_>>();
        let first = bars.first();
        let last = bars.last();
        OriginDatasetDto {
            origin_dataset_id: dataset.origin_dataset_id.to_string(),
            source_catalog: self.catalog_path.display().to_string(),
            enable_structure: self.enable_structure,
            instrument_id: dataset.state_key.instrument_id.to_string(),
            bar_type: dataset.bar_type.clone(),
            timeframe: dataset.state_key.timeframe.to_string(),
            sbar_sequence_fingerprint: dataset.sbar_sequence_fingerprint.clone(),
            sbar_count: bars.len(),
            first_sbar_id: first.map_or_else(String::new, |bar| bar.sbar_id.clone()),
            last_sbar_id: last.map_or_else(String::new, |bar| bar.sbar_id.clone()),
            first_ts_event: first.map_or_else(String::new, |bar| bar.ts_event.clone()),
            last_ts_event: last.map_or_else(String::new, |bar| bar.ts_event.clone()),
            bars,
            structure: dataset.structure.clone(),
            keyzones: dataset.keyzones.clone(),
        }
    }
}

fn sbar_to_dto(bar: &Bar) -> SBarDto {
    SBarDto {
        sbar_id: bar.ts_event.to_string(),
        bar_type: bar.bar_type.to_string(),
        ts_event: bar.ts_event.to_string(),
        ts_init: bar.ts_init.to_string(),
        open: bar.open.to_string(),
        high: bar.high.to_string(),
        low: bar.low.to_string(),
        close: bar.close.to_string(),
        volume: bar.volume.to_string(),
    }
}


#[cfg(test)]
mod tests {
    use super::{AppState, OriginRecord};
    use crate::{
        catalog::OriginLoad,
        dataset::sequence_fingerprint,
        ipc::IpcErrorCode,
    };
    use capitus_struxis::StruxisStateKey;
    use nautilus_model::{
        data::{Bar, BarType},
        types::{Price, Quantity},
    };
    use std::{path::PathBuf, str::FromStr};
    use uuid::Uuid;

    fn fixture_bar(ts_event: u64, open: &str) -> Bar {
        Bar::new(
            BarType::from_str("AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL")
                .expect("fixture BarType should parse"),
            Price::from(open),
            Price::from("12.00"),
            Price::from("9.00"),
            Price::from("11.00"),
            Quantity::from("100"),
            ts_event.into(),
            ts_event.into(),
        )
    }

    fn fixture_origin() -> OriginLoad {
        let bars = vec![
            fixture_bar(100, "10.00"),
            fixture_bar(200, "10.50"),
            fixture_bar(300, "10.75"),
        ];
        let bar_type = bars[0].bar_type;
        let state_key = StruxisStateKey::from_bar_type(&bar_type);
        let fingerprint = sequence_fingerprint(state_key, &bars)
            .expect("fixture fingerprint should compute");
        OriginLoad {
            keyzones: None,
            origin_dataset_id: Uuid::new_v4(),
            state_key,
            sbar_sequence_fingerprint: fingerprint,
            bar_type: bar_type.to_string(),
            bars,
            structure: None,
        }
    }

    fn app_with_origin(catalog_path: PathBuf) -> AppState {
        let app = AppState::new(catalog_path);
        let record = OriginRecord {
            dataset: fixture_origin(),
            catalog_path: app.catalog_path().to_path_buf(),
            enable_structure: true,
        };
        app.publish_origin(record)
            .expect("fixture Origin should publish");
        app
    }

    #[test]
    fn creates_test_from_exact_inclusive_sbar_id_range() {
        let app = app_with_origin(PathBuf::from("/unused/catalog"));
        let origin = app
            .current_origin()
            .expect("Origin lookup should succeed")
            .expect("fixture Origin should exist");

        let test = app
            .create_test_dataset("200", "300")
            .expect("valid inclusive selection should create Test");

        assert_eq!(test.origin_dataset_id, origin.origin_dataset_id);
        assert_eq!(origin.timeframe, "5m", "Origin DTO must preserve the BarSpecification unit");
        assert_eq!(test.timeframe, "5m", "Test DTO must preserve the BarSpecification unit");
        assert_eq!(test.start_sbar_id, "200");
        assert_eq!(test.end_sbar_id, "300");
        assert_eq!(test.sbar_count, 2);
        assert_eq!(
            test.sbar_sequence_fingerprint,
            app.current_test_dataset()
                .expect("Test lookup should succeed")
                .expect("Test should be published")
                .sbar_sequence_fingerprint
        );
    }

    #[test]
    fn rejects_test_creation_without_a_loaded_origin() {
        let app = AppState::new(PathBuf::from("/unused/catalog"));
        let error = app
            .create_test_dataset("100", "200")
            .expect_err("Test creation without Origin must fail");
        assert_eq!(error.code, IpcErrorCode::InvalidState);
    }

    #[test]
    fn invalid_selection_does_not_replace_existing_test() {
        let app = app_with_origin(PathBuf::from("/unused/catalog"));
        let first = app
            .create_test_dataset("100", "200")
            .expect("first Test should be created");
        assert!(
            app.create_test_dataset("300", "100").is_err(),
            "reversed selection must be rejected"
        );
        let current = app
            .current_test_dataset()
            .expect("Test lookup should succeed")
            .expect("the previously published Test must remain");
        assert_eq!(current.test_dataset_id, first.test_dataset_id);
    }

    #[test]
    fn successful_origin_replacement_clears_test_but_failed_load_preserves_it() {
        let app = app_with_origin(PathBuf::from("/definitely/missing/catalog"));
        let first_origin_id = app
            .current_origin()
            .expect("Origin lookup should succeed")
            .expect("Origin should exist")
            .origin_dataset_id;
        let first_test = app
            .create_test_dataset("100", "200")
            .expect("Test should be created");

        assert!(app.load_origin("missing-dataset", true).is_err());
        assert_eq!(
            app.current_origin()
                .expect("Origin lookup should succeed after failed Load")
                .expect("failed Load must preserve Origin")
                .origin_dataset_id,
            first_origin_id
        );
        assert_eq!(
            app.current_test_dataset()
                .expect("Test lookup should succeed")
                .expect("failed Load must preserve Test")
                .test_dataset_id,
            first_test.test_dataset_id
        );

        let replacement = OriginRecord {
            dataset: fixture_origin(),
            catalog_path: app.catalog_path().to_path_buf(),
            enable_structure: false,
        };
        app.publish_origin(replacement)
            .expect("successful Origin publication should succeed");
        assert!(
            app.current_test_dataset()
                .expect("Test lookup should succeed")
                .is_none(),
            "Test derived from the previous Origin must be invalidated"
        );
    }

    #[test]
    fn test_dataset_dto_uses_camel_case_and_lossless_string_ids() {
        let app = app_with_origin(PathBuf::from("/unused/catalog"));
        let test = app
            .create_test_dataset("100", "200")
            .expect("Test should be created");
        let value = serde_json::to_value(&test).expect("Test DTO should serialize");

        assert_eq!(value["startSbarId"], "100");
        assert_eq!(value["endSbarId"], "200");
        assert_eq!(value["sbarCount"], 2);
        assert!(value.get("testDatasetId").is_some());
        assert!(value.get("test_dataset_id").is_none());
    }

    #[test]
    fn origin_load_and_test_creation_share_a_mutation_guard() {
        let app = app_with_origin(PathBuf::from("/unused/catalog"));
        app.inner.mutation_active.store(true, std::sync::atomic::Ordering::Release);
        let test_error = app
            .create_test_dataset("100", "200")
            .expect_err("concurrent Test creation must be rejected");
        let load_error = app
            .load_origin("any-dataset", true)
            .expect_err("concurrent Origin Load must be rejected");
        app.inner.mutation_active.store(false, std::sync::atomic::Ordering::Release);
        assert_eq!(test_error.code, IpcErrorCode::Conflict);
        assert_eq!(load_error.code, IpcErrorCode::Conflict);
    }
}
