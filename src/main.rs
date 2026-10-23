mod app;
mod catalog;
mod compare;
mod commands;
mod dataset;
mod discovery;
mod ipc;
mod run;
mod replay;
mod checkpoint;
mod diagnostics;
mod worker;
mod manager;
mod snapshot;
mod snapshot_writer;
mod snapshot_store;
mod effective_config;

#[tauri::command]
fn open_devtools(window: tauri::WebviewWindow) {
    window.open_devtools();
}

fn main() {
    tauri::Builder::default()
        .manage(app::AppState::with_configured_catalog())
        .invoke_handler(tauri::generate_handler![
            open_devtools,
            commands::list_catalog_datasets,
            commands::load_origin,
            commands::get_current_origin,
            commands::create_test_dataset,
            commands::get_current_test_dataset,
            commands::list_snapshots,
            commands::get_snapshot_reference,
            commands::save_run_snapshot,
            commands::compare_snapshots,
            commands::start_run,
            commands::restart_run,
            commands::restart_to_sbar,
            commands::get_run_state,
            commands::get_replay_inspector,
            commands::step_run,
            commands::play_run,
            commands::pause_run,
            commands::stop_run,
            commands::dispose_run,
            commands::reset_run,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Struxis Debugger");
}

#[cfg(test)]
mod tests;
