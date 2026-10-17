pub mod catalog;
pub mod dataset;
pub mod ipc;

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("failed to run Struxis Debugger");
}
