//! Thin Tauri command handlers. Application work stays in AppState services.

use tauri::State;

use crate::{
    app::{AppState, OriginDatasetDto, TestDatasetDto},
    checkpoint::ReplayInspectorProjection,
    compare::{CompareRejectCategory, CompareRejection, SnapshotCompareResult},
    discovery::CatalogDatasetEntry,
    ipc::{IpcError, IpcErrorCode},
    run::RunState,
    snapshot_store::SnapshotArtifact,
};

#[tauri::command]
pub(crate) async fn list_catalog_datasets(
    state: State<'_, AppState>,
) -> Result<Vec<CatalogDatasetEntry>, IpcError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.discover_datasets())
        .await
        .map_err(|error| {
            IpcError::new(
                IpcErrorCode::Internal,
                format!("Catalog discovery worker failed: {error}"),
            )
        })?
}

#[tauri::command]
pub(crate) async fn load_origin(
    dataset_id: String,
    enable_structure: bool,
    state: State<'_, AppState>,
) -> Result<OriginDatasetDto, IpcError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        state.load_origin(&dataset_id, enable_structure)
    })
    .await
    .map_err(|error| {
        IpcError::new(
            IpcErrorCode::Internal,
            format!("Origin Load worker failed: {error}"),
        )
    })?
}

#[tauri::command]
pub(crate) async fn get_current_origin(
    state: State<'_, AppState>,
) -> Result<Option<OriginDatasetDto>, IpcError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.current_origin())
        .await
        .map_err(|error| {
            IpcError::new(
                IpcErrorCode::Internal,
                format!("Origin state worker failed: {error}"),
            )
        })?
}

#[tauri::command]
pub(crate) async fn create_test_dataset(
    start_sbar_id: String,
    end_sbar_id: String,
    state: State<'_, AppState>,
) -> Result<TestDatasetDto, IpcError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        state.create_test_dataset(&start_sbar_id, &end_sbar_id)
    })
    .await
    .map_err(|error| {
        IpcError::new(
            IpcErrorCode::Internal,
            format!("Test Dataset creation worker failed: {error}"),
        )
    })?
}

#[tauri::command]
pub(crate) async fn get_current_test_dataset(
    state: State<'_, AppState>,
) -> Result<Option<TestDatasetDto>, IpcError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.current_test_dataset())
        .await
        .map_err(|error| {
            IpcError::new(
                IpcErrorCode::Internal,
                format!("Test Dataset state worker failed: {error}"),
            )
        })?
}

#[tauri::command]
pub(crate) async fn list_snapshots(state: State<'_, AppState>) -> Result<Vec<SnapshotArtifact>, IpcError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.discover_snapshots())
        .await
        .map_err(|error| IpcError::new(IpcErrorCode::Internal, format!("Snapshot discovery worker failed: {error}")))?
}

#[tauri::command]
pub(crate) async fn save_run_snapshot(
    state: State<'_, AppState>,
) -> Result<String, IpcError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.save_run_snapshot())
        .await
        .map_err(|error| IpcError::new(
            IpcErrorCode::Internal,
            format!("Run Snapshot save worker failed: {error}"),
        ))?
}

#[tauri::command]
pub(crate) async fn compare_snapshots(
    baseline_snapshot_id: String,
    candidate_snapshot_id: String,
    state: State<'_, AppState>,
) -> Result<SnapshotCompareResult, CompareRejection> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        state.compare_snapshots(&baseline_snapshot_id, &candidate_snapshot_id)
    })
    .await
    .map_err(|error| CompareRejection {
        category: CompareRejectCategory::Unknown,
        message: format!("Snapshot Compare worker failed: {error}"),
    })?
}

#[tauri::command]
pub(crate) async fn start_run(state: State<'_, AppState>) -> Result<RunState, IpcError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.start_run())
        .await
        .map_err(|error| IpcError::new(IpcErrorCode::Internal, format!("Run Start worker failed: {error}")))?
}

#[tauri::command]
pub(crate) async fn restart_run(state: State<'_, AppState>) -> Result<RunState, IpcError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.restart_run())
        .await
        .map_err(|error| IpcError::new(IpcErrorCode::Internal, format!("Run Restart worker failed: {error}")))?
}

#[tauri::command]
pub(crate) async fn get_run_state(state: State<'_, AppState>) -> Result<Option<RunState>, IpcError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.replay_state())
        .await
        .map_err(|error| IpcError::new(IpcErrorCode::Internal, format!("Run state worker failed: {error}")))?
}

#[tauri::command]
pub(crate) async fn get_replay_inspector(
    state: State<'_, AppState>,
) -> Result<Option<ReplayInspectorProjection>, IpcError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.replay_inspector())
        .await
        .map_err(|error| IpcError::new(IpcErrorCode::Internal, format!("Replay Inspector worker failed: {error}")))?
}

#[tauri::command]
pub(crate) async fn step_run(state: State<'_, AppState>) -> Result<RunState, IpcError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.replay_step())
        .await
        .map_err(|error| IpcError::new(IpcErrorCode::Internal, format!("Run Step worker failed: {error}")))?
}

#[tauri::command]
pub(crate) async fn play_run(state: State<'_, AppState>) -> Result<RunState, IpcError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.replay_play())
        .await
        .map_err(|error| IpcError::new(IpcErrorCode::Internal, format!("Run Play worker failed: {error}")))?
}

#[tauri::command]
pub(crate) async fn pause_run(state: State<'_, AppState>) -> Result<RunState, IpcError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.replay_pause())
        .await
        .map_err(|error| IpcError::new(IpcErrorCode::Internal, format!("Run Pause worker failed: {error}")))?
}

#[tauri::command]
pub(crate) async fn stop_run(state: State<'_, AppState>) -> Result<RunState, IpcError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.replay_stop())
        .await
        .map_err(|error| IpcError::new(IpcErrorCode::Internal, format!("Run Stop worker failed: {error}")))?
}

#[tauri::command]
pub(crate) async fn dispose_run(state: State<'_, AppState>) -> Result<RunState, IpcError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.replay_dispose())
        .await
        .map_err(|error| IpcError::new(IpcErrorCode::Internal, format!("Run Dispose worker failed: {error}")))?
}
