use std::{collections::HashMap, env, fs, path::PathBuf, sync::Mutex};

mod db_editor;
mod github;
mod knowledge_vault;
mod project_workspace;

#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri::{AppHandle, Emitter, Manager};

const DEFAULT_QUICK_CAPTURE_SHORTCUT: &str = "Alt+Space";
const QUICK_CAPTURE_OPEN_EVENT: &str = "quick-capture:open";

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeConfig {
    supabase_url: String,
    supabase_anon_key: String,
    loaded: bool,
    source_path: Option<String>,
}

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PersistedDevice {
    id: String,
    name: String,
    last_seen_at: String,
    app_version: Option<String>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct QuickCaptureShortcutStatus {
    registered: bool,
    shortcut: String,
    supported: bool,
    error: Option<String>,
}

impl QuickCaptureShortcutStatus {
    fn unsupported() -> Self {
        Self {
            registered: false,
            shortcut: DEFAULT_QUICK_CAPTURE_SHORTCUT.to_string(),
            supported: false,
            error: None,
        }
    }
}

type QuickCaptureShortcutState = Mutex<QuickCaptureShortcutStatus>;

fn normalize_env_value(value: &str) -> String {
    let trimmed = value.trim();

    if trimmed.len() >= 2 {
        let first = trimmed.as_bytes()[0];
        let last = trimmed.as_bytes()[trimmed.len() - 1];

        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            return trimmed[1..trimmed.len() - 1].to_string();
        }
    }

    trimmed.to_string()
}

fn parse_env(contents: &str) -> HashMap<String, String> {
    let mut values = HashMap::new();

    for raw_line in contents.lines() {
        let line = raw_line.trim();

        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        let line = line.strip_prefix("export ").unwrap_or(line).trim();

        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim();

            if !key.is_empty() {
                values.insert(key.to_string(), normalize_env_value(value));
            }
        }
    }

    values
}

fn first_env_value(values: &HashMap<String, String>, keys: &[&str]) -> String {
    keys.iter()
        .find_map(|key| values.get(*key))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_default()
}

fn runtime_env_candidates(app: &AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(explicit_path) = env::var("YEONSIK_NOTE_ENV") {
        let path = PathBuf::from(explicit_path.trim());

        if !path.as_os_str().is_empty() {
            candidates.push(path);
        }
    }

    if let Ok(config_dir) = app.path().app_config_dir() {
        candidates.push(config_dir.join(".env"));
        candidates.push(config_dir.join("yeonsik-note.env"));
    }

    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join(".env"));
            candidates.push(exe_dir.join("yeonsik-note.env"));
        }
    }

    if let Ok(current_dir) = env::current_dir() {
        candidates.push(current_dir.join(".env"));
    }

    candidates
}

fn config_from_values(
    values: HashMap<String, String>,
    source_path: Option<String>,
) -> RuntimeConfig {
    RuntimeConfig {
        supabase_url: first_env_value(&values, &["SUPABASE_URL", "VITE_SUPABASE_URL"]),
        supabase_anon_key: first_env_value(
            &values,
            &["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"],
        ),
        loaded: source_path.is_some(),
        source_path,
    }
}

#[tauri::command]
fn load_runtime_config(app: AppHandle) -> RuntimeConfig {
    for candidate in runtime_env_candidates(&app) {
        if !candidate.is_file() {
            continue;
        }

        if let Ok(contents) = fs::read_to_string(&candidate) {
            return config_from_values(
                parse_env(&contents),
                Some(candidate.to_string_lossy().to_string()),
            );
        }
    }

    config_from_values(HashMap::new(), None)
}

fn persisted_device_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|config_dir| config_dir.join("device.json"))
        .map_err(|error| format!("App config directory is unavailable: {error}"))
}

#[tauri::command]
fn load_persisted_device(app: AppHandle) -> Option<PersistedDevice> {
    let path = persisted_device_path(&app).ok()?;
    let contents = fs::read_to_string(path).ok()?;

    serde_json::from_str::<PersistedDevice>(&contents).ok()
}

#[tauri::command]
fn save_persisted_device(app: AppHandle, device: PersistedDevice) -> Result<(), String> {
    let path = persisted_device_path(&app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "Device storage path has no parent directory.".to_string())?;
    let contents = serde_json::to_string_pretty(&device)
        .map_err(|error| format!("Device serialization failed: {error}"))?;

    fs::create_dir_all(parent)
        .map_err(|error| format!("Device storage directory creation failed: {error}"))?;
    fs::write(path, contents).map_err(|error| format!("Device storage write failed: {error}"))
}

#[tauri::command]
fn quick_capture_shortcut_status(
    status: tauri::State<'_, QuickCaptureShortcutState>,
) -> QuickCaptureShortcutStatus {
    status
        .lock()
        .map(|current_status| current_status.clone())
        .unwrap_or_else(|_| QuickCaptureShortcutStatus::unsupported())
}

#[tauri::command]
fn show_quick_capture(app: AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        show_quick_capture_panel(&app);
        Ok(())
    }

    #[cfg(not(desktop))]
    {
        let _ = app;
        Err("Quick Capture native entry is desktop-only.".to_string())
    }
}

#[cfg(desktop)]
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg(desktop)]
fn hide_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[cfg(desktop)]
fn show_quick_capture_panel(app: &tauri::AppHandle) {
    show_main_window(app);
    let _ = app.emit(QUICK_CAPTURE_OPEN_EVENT, ());
}

#[cfg(desktop)]
fn set_quick_capture_shortcut_status(app: &tauri::AppHandle, status: QuickCaptureShortcutStatus) {
    let state = app.state::<QuickCaptureShortcutState>();

    match state.lock() {
        Ok(mut current_status) => {
            *current_status = status;
        }
        Err(_) => {}
    };
}

#[cfg(desktop)]
fn setup_global_shortcut(app: &mut tauri::App) -> tauri::Result<()> {
    use tauri_plugin_global_shortcut::{
        Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
    };

    let plugin_result = app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, shortcut, event| {
                if event.state == ShortcutState::Pressed
                    && shortcut.matches(Modifiers::ALT, Code::Space)
                {
                    show_quick_capture_panel(app);
                }
            })
            .build(),
    );

    if let Err(error) = plugin_result {
        set_quick_capture_shortcut_status(
            app.handle(),
            QuickCaptureShortcutStatus {
                registered: false,
                shortcut: DEFAULT_QUICK_CAPTURE_SHORTCUT.to_string(),
                supported: false,
                error: Some(format!("Global shortcut plugin failed: {error}")),
            },
        );
        return Ok(());
    }

    let shortcut = Shortcut::new(Some(Modifiers::ALT), Code::Space);

    match app.handle().global_shortcut().register(shortcut) {
        Ok(()) => set_quick_capture_shortcut_status(
            app.handle(),
            QuickCaptureShortcutStatus {
                registered: true,
                shortcut: DEFAULT_QUICK_CAPTURE_SHORTCUT.to_string(),
                supported: true,
                error: None,
            },
        ),
        Err(error) => set_quick_capture_shortcut_status(
            app.handle(),
            QuickCaptureShortcutStatus {
                registered: false,
                shortcut: DEFAULT_QUICK_CAPTURE_SHORTCUT.to_string(),
                supported: true,
                error: Some(format!("Alt+Space registration failed: {error}")),
            },
        ),
    }

    Ok(())
}

#[cfg(desktop)]
fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let quick_capture_item =
        MenuItem::with_id(app, "quick_capture", "Quick Capture", true, None::<&str>)?;
    let show_item = MenuItem::with_id(app, "show", "Open", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&quick_capture_item, &show_item, &hide_item, &quit_item],
    )?;

    let mut tray_builder = TrayIconBuilder::with_id("main-tray")
        .tooltip("Yeonsik's Note")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "quick_capture" => show_quick_capture_panel(app),
            "show" => show_main_window(app),
            "hide" => hide_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    tray_builder.build(app)?;

    Ok(())
}

#[tauri::command]
fn set_launcher_icon_mode(app: tauri::AppHandle, mode: String) -> Result<(), String> {
    let (window_bytes, tray_bytes): (&[u8], &[u8]) = match mode.as_str() {
        "dark" => (
            include_bytes!("../icons/launcher-v3/window-dark.png"),
            include_bytes!("../icons/launcher-v3/tray-dark.png"),
        ),
        "light" => (
            include_bytes!("../icons/launcher-v3/window-white.png"),
            include_bytes!("../icons/launcher-v3/tray-white.png"),
        ),
        _ => return Err("Unsupported launcher icon theme.".to_string()),
    };
    let window_icon = tauri::image::Image::from_bytes(window_bytes)
        .map_err(|error| error.to_string())?;
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window is unavailable.".to_string())?;
    window.set_icon(window_icon).map_err(|error| error.to_string())?;

    #[cfg(desktop)]
    {
        let tray_icon = tauri::image::Image::from_bytes(tray_bytes)
            .map_err(|error| error.to_string())?;
        let tray = app
            .tray_by_id("main-tray")
            .ok_or_else(|| "System tray icon is unavailable.".to_string())?;
        tray.set_icon(Some(tray_icon)).map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(QuickCaptureShortcutStatus::unsupported()))
        .manage(github::GitHubState::default())
        .invoke_handler(tauri::generate_handler![
            load_runtime_config,
            load_persisted_device,
            save_persisted_device,
            quick_capture_shortcut_status,
            set_launcher_icon_mode,
            show_quick_capture,
            db_editor::db_editor_pat_status,
            db_editor::db_editor_save_pat,
            db_editor::db_editor_verify_pat,
            db_editor::db_editor_delete_pat,
            db_editor::db_editor_list_projects,
            db_editor::db_editor_list_schemas,
            db_editor::db_editor_list_tables,
            db_editor::db_editor_get_table_metadata,
            db_editor::db_editor_list_rows,
            db_editor::update_db_row,
            db_editor::open_db_editor_window,
            project_workspace::open_project_workspace_window,
            github::github_config_status,
            github::github_save_config,
            github::github_delete_config,
            github::github_connection_status,
            github::github_device_flow_start,
            github::github_device_flow_poll,
            github::github_device_flow_cancel,
            github::github_disconnect,
            github::github_list_repositories,
            github::github_list_branches,
            github::github_read_repository,
            github::github_read_commit_history,
            knowledge_vault::knowledge_vault_get_config,
            knowledge_vault::knowledge_vault_set_path,
            knowledge_vault::knowledge_vault_create_document,
            knowledge_vault::knowledge_vault_write_generated_file,
            knowledge_vault::knowledge_vault_update_document,
            knowledge_vault::knowledge_vault_move_file,
            knowledge_vault::knowledge_vault_open_file,
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_autostart::MacosLauncher;

                app.handle().plugin(tauri_plugin_autostart::init(
                    MacosLauncher::LaunchAgent,
                    None::<Vec<&str>>,
                ))?;
                setup_global_shortcut(app)?;
                setup_tray(app)?;
            }

            Ok(())
        });

    #[cfg(desktop)]
    let builder = builder.on_window_event(|window, event| {
        if window.label() == "main" {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        }
    });

    builder
        .run(tauri::generate_context!())
        .expect("error while running Yeonsik's Note");
}
