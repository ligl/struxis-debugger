pub mod app;
pub mod catalog;
pub mod commands;
pub mod dataset;
pub mod discovery;
pub mod ipc;

fn main() {
    tauri::Builder::default()
        .manage(app::AppState::with_configured_catalog())
        .invoke_handler(tauri::generate_handler![
            commands::list_catalog_datasets,
            commands::load_origin,
            commands::get_current_origin,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Struxis Debugger");
}
