use std::path::Path;

use base64::Engine;
use tauri::Manager;

#[tauri::command]
fn save_export_file(app: tauri::AppHandle, filename: String, bytes_base64: String) -> Result<String, String> {
  let file_name = Path::new(&filename)
    .file_name()
    .and_then(|value| value.to_str())
    .ok_or_else(|| "Invalid export filename".to_string())?;

  let download_dir = app.path().download_dir().map_err(|err| err.to_string())?;
  std::fs::create_dir_all(&download_dir).map_err(|err| err.to_string())?;

  let bytes = base64::engine::general_purpose::STANDARD
    .decode(bytes_base64)
    .map_err(|err| err.to_string())?;

  let path = download_dir.join(file_name);
  std::fs::write(&path, bytes).map_err(|err| err.to_string())?;
  Ok(path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![save_export_file])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
