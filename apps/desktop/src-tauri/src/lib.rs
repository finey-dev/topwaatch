use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                set_splash_status(&handle, "Checking for updates…");

                if let Err(error) = run_startup_update(&handle).await {
                    log::warn!("startup update check failed: {error}");
                    set_splash_status(&handle, "Starting TopWaatch…");
                }

                close_splash_and_show_main(&handle);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn set_splash_status(app: &tauri::AppHandle, message: &str) {
    let Some(splash) = app.get_webview_window("splash") else {
        return;
    };

    let script = format!(
        "window.setStatus({});",
        serde_json::to_string(message).unwrap_or_else(|_| "\"Starting TopWaatch…\"".to_string())
    );
    let _ = splash.eval(&script);
}

fn close_splash_and_show_main(app: &tauri::AppHandle) {
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

async fn run_startup_update(app: &tauri::AppHandle) -> tauri_plugin_updater::Result<()> {
    use tauri_plugin_updater::UpdaterExt;

    let updater = app.updater()?;
    let Some(update) = updater.check().await? else {
        set_splash_status(app, "Starting TopWaatch…");
        return Ok(());
    };

    log::info!("update {} available, installing", update.version);
    set_splash_status(app, &format!("Downloading update {}…", update.version));

    let mut downloaded = 0u64;
    let app_for_progress = app.clone();
    let app_for_install = app.clone();

    update
        .download_and_install(
            move |chunk_length, content_length| {
                downloaded += chunk_length as u64;
                if let Some(total) = content_length {
                    if total > 0 {
                        let percent =
                            ((downloaded as f64 / total as f64) * 100.0).round() as u64;
                        set_splash_status(
                            &app_for_progress,
                            &format!("Downloading update {percent}%…"),
                        );
                    }
                }
            },
            move || {
                set_splash_status(&app_for_install, "Installing update…");
            },
        )
        .await?;

    set_splash_status(app, "Restarting TopWaatch…");
    app.restart();
}
