use base64::Engine;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;

// ─── OAuth ────────────────────────────────────────────────────────────────────

/// Opens the system browser, starts a local HTTP server on `port`,
/// and returns the raw query-string from the OAuth redirect.
#[tauri::command]
async fn start_oauth(auth_url: String, port: u16) -> Result<String, String> {
    let listener = TcpListener::bind(format!("127.0.0.1:{}", port))
        .await
        .map_err(|e| format!("Não foi possível abrir porta {}: {}", port, e))?;

    open_browser(&auth_url)?;

    let (stream, _) = tokio::time::timeout(
        std::time::Duration::from_secs(120),
        listener.accept(),
    )
    .await
    .map_err(|_| "Tempo esgotado aguardando autorização do Google".to_string())?
    .map_err(|e| e.to_string())?;

    let mut reader = BufReader::new(stream);
    let mut request_line = String::new();
    reader.read_line(&mut request_line).await.map_err(|e| e.to_string())?;

    // Extract query string from the request line
    let line = request_line.trim();
    let query_string = if let Some(path_start) = line.find('/') {
        let path_part = &line[path_start..];
        if let Some(path_end) = path_part.find(' ') {
            let full_path = &path_part[..path_end];
            full_path.find('?').map(|q| full_path[q + 1..].to_string())
        } else {
            None
        }
    } else {
        None
    };

    // Check if the redirect contains an error (e.g. user cancelled)
    let is_error = query_string
        .as_deref()
        .map(|q| q.contains("error="))
        .unwrap_or(true);

    let html_body = if is_error {
        r#"<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"><title>Password Keeper</title>
  <style>
    body{font-family:system-ui,sans-serif;display:flex;justify-content:center;
         align-items:center;height:100vh;margin:0;background:#0a0a16;color:#e2e8f0}
    .card{background:#14142e;padding:2.5rem;border-radius:1.5rem;
          text-align:center;border:1px solid #2a2a5a}
    h1{color:#ef4444;margin:0 0 .5rem}p{color:#94a3b8;margin:0}
    .icon{font-size:3rem;display:block;margin-bottom:1rem}
  </style>
</head>
<body>
  <div class="card">
    <span class="icon">❌</span>
    <h1>Autorização cancelada</h1>
    <p>Você pode fechar esta aba e voltar ao Password Keeper.</p>
  </div>
</body>
</html>"#
    } else {
        r#"<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"><title>Password Keeper</title>
  <style>
    body{font-family:system-ui,sans-serif;display:flex;justify-content:center;
         align-items:center;height:100vh;margin:0;background:#0a0a16;color:#e2e8f0}
    .card{background:#14142e;padding:2.5rem;border-radius:1.5rem;
          text-align:center;border:1px solid #2a2a5a}
    h1{color:#eab308;margin:0 0 .5rem}p{color:#94a3b8;margin:0}
    .check{font-size:3rem;display:block;margin-bottom:1rem}
  </style>
</head>
<body>
  <div class="card">
    <span class="check">✅</span>
    <h1>Autenticado com sucesso!</h1>
    <p>Você pode fechar esta aba e voltar ao Password Keeper.</p>
  </div>
</body>
</html>"#
    };

    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html_body.len(),
        html_body
    );
    reader.get_mut().write_all(response.as_bytes()).await.map_err(|e| e.to_string())?;

    if is_error {
        return Err("Autorização cancelada pelo usuário".to_string());
    }

    match query_string {
        Some(qs) => Ok(qs),
        None => Err("Não foi possível extrair o código de autorização".to_string()),
    }
}

fn open_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let result = std::process::Command::new("xdg-open").arg(url).spawn();
        if result.is_err() {
            for browser in &["firefox", "google-chrome", "chromium", "chromium-browser"] {
                if std::process::Command::new(browser).arg(url).spawn().is_ok() {
                    return Ok(());
                }
            }
            return Err("Não foi possível abrir o navegador".to_string());
        }
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(url).spawn().map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", url])
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[allow(unreachable_code)]
    Err("Plataforma não suportada".to_string())
}

// ─── File I/O ─────────────────────────────────────────────────────────────────

/// Open a native file dialog to pick a PNG/JPG image and return it as a
/// base64 data-URL (e.g. "data:image/png;base64,...").
#[tauri::command]
async fn pick_and_read_image() -> Result<Option<String>, String> {
    let path = tokio::task::spawn_blocking(|| {
        rfd::FileDialog::new()
            .add_filter("Imagens (PNG, JPG)", &["png", "jpg", "jpeg"])
            .pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    match path {
        None => Ok(None),
        Some(p) => {
            let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("jpg").to_lowercase();
            let mime = if ext == "png" { "image/png" } else { "image/jpeg" };
            let data = tokio::fs::read(&p).await.map_err(|e| e.to_string())?;
            let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
            Ok(Some(format!("data:{};base64,{}", mime, b64)))
        }
    }
}

/// Write text content to a file path.
#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    tokio::fs::write(&path, content.as_bytes()).await.map_err(|e| e.to_string())
}

/// Read text content from a file path.
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path).await.map_err(|e| e.to_string())
}

// ─── Entry point ─────────────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            start_oauth,
            write_file,
            read_file,
            pick_and_read_image,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar o Password Keeper");
}
