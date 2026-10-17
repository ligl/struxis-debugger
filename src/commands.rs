//! Thin Tauri command handlers. Application work stays in AppState services.

use tauri::State;

use crate::{
    app::{AppState, OriginDatasetDto},
    discovery::CatalogDatasetEntry,
    ipc::{IpcError, IpcErrorCode},
};

#[tauri::command]
pub async fn list_catalog_datasets(
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
pub async fn load_origin(
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
pub async fn get_current_origin(
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
