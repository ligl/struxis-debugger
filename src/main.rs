pub mod app;
pub mod catalog;
pub mod compare;
pub mod commands;
pub mod dataset;
pub mod discovery;
pub mod ipc;
pub mod run;
pub mod replay;
pub mod checkpoint;
pub mod worker;
pub mod manager;
pub mod snapshot;
pub mod snapshot_writer;
pub mod snapshot_store;
pub mod effective_config;

fn main() {
    tauri::Builder::default()
        .manage(app::AppState::with_configured_catalog())
        .invoke_handler(tauri::generate_handler![
            commands::list_catalog_datasets,
            commands::load_origin,
            commands::get_current_origin,
            commands::create_test_dataset,
            commands::get_current_test_dataset,
            commands::list_snapshots,
            commands::compare_snapshots,
            commands::start_run,
            commands::restart_run,
            commands::get_run_state,
            commands::step_run,
            commands::play_run,
            commands::pause_run,
            commands::stop_run,
            commands::dispose_run,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Struxis Debugger");
}
