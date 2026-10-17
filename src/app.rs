//! Application services and session-owned Origin state for Struxis Debugger.

use std::{
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
};

use nautilus_model::data::Bar;
use serde::Serialize;

use crate::{
    catalog::{OriginLoad, load_origin as load_origin_candidate},
    discovery::{CatalogDatasetEntry, configured_catalog_root, discover_catalog_datasets},
    ipc::{IpcError, IpcErrorCode},
};

/// Tauri-managed application state. Nautilus runtime objects are deliberately
/// not retained: Origin stores only the owned result produced after Engine
/// disposal and complete Struxis SBar validation.
#[derive(Clone)]
pub struct AppState {
    inner: Arc<AppStateInner>,
}

struct AppStateInner {
    catalog_path: PathBuf,
    current_origin: Mutex<Option<OriginRecord>>,
    load_active: AtomicBool,
}

#[derive(Clone)]
struct OriginRecord {
    dataset: OriginLoad,
    catalog_path: PathBuf,
    enable_structure: bool,
}

impl AppState {
    #[must_use]
    pub fn new(catalog_path: PathBuf) -> Self {
        Self {
            inner: Arc::new(AppStateInner {
                catalog_path,
                current_origin: Mutex::new(None),
                load_active: AtomicBool::new(false),
            }),
        }
    }

    #[must_use]
    pub fn with_configured_catalog() -> Self {
        Self::new(configured_catalog_root())
    }

    pub fn discover_datasets(&self) -> Result<Vec<CatalogDatasetEntry>, IpcError> {
        discover_catalog_datasets(&self.inner.catalog_path).map_err(|error| {
            IpcError::new(
                IpcErrorCode::Internal,
                format!("Catalog discovery failed: {error}"),
            )
        })
    }

    pub fn load_origin(
        &self,
        dataset_id: &str,
        enable_structure: bool,
    ) -> Result<OriginDatasetDto, IpcError> {
        self.inner
            .load_active
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| {
                IpcError::new(
                    IpcErrorCode::Conflict,
                    "An Origin Load operation is already active",
                )
            })?;
        let _permit = LoadPermit(&self.inner.load_active);

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
        let dto = record.to_dto();
        let mut current = self.inner.current_origin.lock().map_err(|_| {
            IpcError::new(
                IpcErrorCode::Internal,
                "Origin state is unavailable because its lock was poisoned",
            )
        })?;
        *current = Some(record);
        Ok(dto)
    }

    pub fn current_origin(&self) -> Result<Option<OriginDatasetDto>, IpcError> {
        let current = self.inner.current_origin.lock().map_err(|_| {
            IpcError::new(
                IpcErrorCode::Internal,
                "Origin state is unavailable because its lock was poisoned",
            )
        })?;
        Ok(current.as_ref().map(OriginRecord::to_dto))
    }

    #[must_use]
    pub fn catalog_path(&self) -> &Path {
        &self.inner.catalog_path
    }
}

struct LoadPermit<'a>(&'a AtomicBool);

impl Drop for LoadPermit<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OriginDatasetDto {
    pub origin_dataset_id: String,
    pub source_catalog: String,
    pub enable_structure: bool,
    pub instrument_id: String,
    pub bar_type: String,
    pub timeframe: String,
    pub sbar_sequence_fingerprint: String,
    pub sbar_count: usize,
    pub first_sbar_id: String,
    pub last_sbar_id: String,
    pub first_ts_event: String,
    pub last_ts_event: String,
    pub bars: Vec<SBarDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SBarDto {
    pub sbar_id: String,
    pub bar_type: String,
    pub ts_event: String,
    pub ts_init: String,
    pub open: String,
    pub high: String,
    pub low: String,
    pub close: String,
    pub volume: String,
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
            timeframe: format!("{}s", dataset.state_key.timeframe.duration().as_secs()),
            sbar_sequence_fingerprint: dataset.sbar_sequence_fingerprint.clone(),
            sbar_count: bars.len(),
            first_sbar_id: first.map_or_else(String::new, |bar| bar.sbar_id.clone()),
            last_sbar_id: last.map_or_else(String::new, |bar| bar.sbar_id.clone()),
            first_ts_event: first.map_or_else(String::new, |bar| bar.ts_event.clone()),
            last_ts_event: last.map_or_else(String::new, |bar| bar.ts_event.clone()),
            bars,
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
