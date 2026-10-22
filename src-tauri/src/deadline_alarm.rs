#[cfg(target_os = "android")]
use tauri::{plugin::PluginHandle, Manager};
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Runtime,
};

#[cfg(target_os = "android")]
struct DeadlineAlarm<R: Runtime>(PluginHandle<R>);

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("deadline-alarm")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            _app.manage(DeadlineAlarm(_api.register_android_plugin(
                "com.yeonsik.note",
                "DeadlineAlarmPlugin",
            )?));
            Ok(())
        })
        .build()
}

#[tauri::command]
pub async fn deadline_exact_alarm_status<R: Runtime>(_app: AppHandle<R>) -> Result<bool, String> {
    #[cfg(target_os = "android")]
    {
        #[derive(serde::Deserialize)]
        struct Status {
            granted: bool,
        }
        _app.state::<DeadlineAlarm<R>>()
            .0
            .run_mobile_plugin::<Status>("status", ())
            .map(|status| status.granted)
            .map_err(|error| error.to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        Ok(false)
    }
}

#[tauri::command]
pub async fn deadline_open_exact_alarm_settings<R: Runtime>(
    _app: AppHandle<R>,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        _app.state::<DeadlineAlarm<R>>()
            .0
            .run_mobile_plugin::<serde_json::Value>("openSettings", ())
            .map(|_| ())
            .map_err(|error| error.to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        Err("정확한 예약 알림은 Android에서 지원합니다.".into())
    }
}
