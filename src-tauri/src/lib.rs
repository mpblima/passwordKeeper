use base64::Engine;

// ─── HTTP via Java/JNI (Android) ──────────────────────────────────────────────
//
// No Android, código NDK não consegue fazer DNS nem sockets TCP para a internet:
//   - getaddrinfo → EAI_NONAME  (não configurado em threads tokio)
//   - UDP porta 53 → EPERM      (bloqueado pelo kernel Android)
//   - InetAddress via JNI → UnknownHostException (threads JNI-attached têm restrições)
//
// Solução definitiva: fazer o HTTP inteiramente em Kotlin (NativeHttp.kt),
// que usa HttpURLConnection do Android — DNS, TLS e routing funcionam corretamente.
// O JavaVM é obtido via ndk-context, inicializado pelo wry/Tauri.

#[cfg(target_os = "android")]
async fn android_http_request(
    method: String,
    url: String,
    headers: std::collections::HashMap<String, String>,
    body: Option<String>,
) -> Result<String, String> {
    use jni::{
        objects::{JClass, JObject, JString, JValue},
        JavaVM,
    };

    let headers_json =
        serde_json::to_string(&headers).map_err(|e| format!("headers: {}", e))?;

    tokio::task::spawn_blocking(move || -> Result<String, String> {
        let android_ctx = unsafe { ndk_context::android_context() };
        let vm = unsafe { JavaVM::from_raw(android_ctx.vm().cast()) }
            .map_err(|e| format!("JavaVM: {}", e))?;
        let mut env = vm.attach_current_thread()
            .map_err(|e| format!("attach: {}", e))?;

        // Threads JNI-nativas usam o bootstrap ClassLoader do Android, que não conhece
        // classes do app. Precisamos usar o ClassLoader do Context do app.
        let ctx_obj = unsafe {
            JObject::from_raw(android_ctx.context() as jni::sys::jobject)
        };
        let loader = env.call_method(
            &ctx_obj, "getClassLoader", "()Ljava/lang/ClassLoader;", &[],
        ).map_err(|e| { let _ = env.exception_clear(); format!("getClassLoader: {}", e) })?
        .l().map_err(|e| e.to_string())?;

        let class_name = env.new_string("com.passwordkeeper.app.NativeHttp")
            .map_err(|e| e.to_string())?;
        let loaded = env.call_method(
            &loader, "loadClass", "(Ljava/lang/String;)Ljava/lang/Class;",
            &[JValue::Object(&*class_name)],
        ).map_err(|e| { let _ = env.exception_clear(); format!("loadClass: {}", e) })?
        .l().map_err(|e| e.to_string())?;
        let native_http_class = JClass::from(loaded);

        let jmethod  = env.new_string(&method).map_err(|e| e.to_string())?;
        let jurl     = env.new_string(&url).map_err(|e| e.to_string())?;
        let jheaders = env.new_string(&headers_json).map_err(|e| e.to_string())?;
        let jbody    = env.new_string(body.as_deref().unwrap_or(""))
            .map_err(|e| e.to_string())?;
        let has_body: u8 = if body.is_some() { 1 } else { 0 };

        let result = env.call_static_method(
            &native_http_class,
            "request",
            "(Landroid/content/Context;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Z)Ljava/lang/String;",
            &[
                JValue::Object(&ctx_obj),
                JValue::Object(&*jmethod),
                JValue::Object(&*jurl),
                JValue::Object(&*jheaders),
                JValue::Object(&*jbody),
                JValue::Bool(has_body),
            ],
        );

        match result {
            Ok(r) => {
                let jobj = r.l().map_err(|e| e.to_string())?;
                let s: String = env.get_string(&JString::from(jobj))
                    .map_err(|e| e.to_string())?
                    .into();
                Ok(s)
            }
            Err(e) => {
                let msg = if env.exception_check().unwrap_or(false) {
                    if let Ok(exc) = env.exception_occurred() {
                        let _ = env.exception_clear();
                        env.call_method(&exc, "toString", "()Ljava/lang/String;", &[])
                            .ok()
                            .and_then(|v| v.l().ok())
                            .filter(|o| !o.is_null())
                            .and_then(|o| {
                                let js = JString::from(o);
                                env.get_string(&js).ok().map(String::from)
                            })
                            .unwrap_or_else(|| e.to_string())
                    } else {
                        e.to_string()
                    }
                } else {
                    e.to_string()
                };
                Err(format!("NativeHttp: {}", msg))
            }
        }
    })
    .await
    .map_err(|e| format!("spawn_blocking: {}", e))?
}

// ─── OAuth ────────────────────────────────────────────────────────────────────
//
// Estratégia multiplataforma:
//   1. Abre Chrome/browser externo com a URL de autorização do Google.
//   2. Google redireciona para http://localhost:PORT?code=...
//   3. Servimos uma página HTML para o Chrome que:
//        a. Usa fetch() do Chrome (que tem acesso total à rede) para trocar o
//           código pelo token em oauth2.googleapis.com  ← bypassa restrições do app
//        b. Faz POST do token JSON de volta para http://localhost:PORT/token
//        c. Redireciona para passwordkeeper://oauth-complete (traz app ao foco)
//   4. Rust lê o token do segundo request TCP e retorna ao JS.
//
// Isso é necessário no Android porque TODO código nativo do app (reqwest NDK,
// JNI HttpURLConnection) falha com UnknownHostException / DNS errors enquanto
// o Chrome tem acesso irrestrito à internet.

#[tauri::command]
#[allow(clippy::too_many_arguments)]
async fn start_oauth(
    app: tauri::AppHandle,
    auth_url: String,
    port: u16,
    code_verifier: String,
    client_id: String,
    client_secret: String,
    redirect_uri: String,
) -> Result<String, String> {
    use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
    use tokio::net::TcpListener;

    let listener = TcpListener::bind(format!("127.0.0.1:{}", port))
        .await
        .map_err(|e| format!("Não foi possível abrir porta {}: {}", port, e))?;

    open_url_with_opener(&app, &auth_url)?;

    // ── Passo 1: recebe o redirect do Google (code) ───────────────────────────

    let (stream1, _) = tokio::time::timeout(
        std::time::Duration::from_secs(120),
        listener.accept(),
    )
    .await
    .map_err(|_| "Tempo esgotado aguardando autorização do Google".to_string())?
    .map_err(|e| e.to_string())?;

    let mut r1 = BufReader::new(stream1);
    let mut req_line = String::new();
    r1.read_line(&mut req_line).await.map_err(|e| e.to_string())?;
    // consome os headers HTTP para liberar a conexão
    loop {
        let mut h = String::new();
        r1.read_line(&mut h).await.map_err(|e| e.to_string())?;
        if h == "\r\n" || h.is_empty() { break; }
    }

    // extrai query string de "GET /?code=...&state=... HTTP/1.1"
    let path = req_line.split_whitespace().nth(1).unwrap_or("/");
    let query_string = path.find('?').map(|i| path[i + 1..].to_string());
    let is_error = query_string.as_deref().map(|q| q.contains("error=")).unwrap_or(true);

    // extrai o código de autorização
    let code = query_string.as_deref().and_then(|qs| {
        qs.split('&')
            .find_map(|p| p.strip_prefix("code=").map(str::to_string))
    });

    let html_body = if is_error || code.is_none() {
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
</html>"#.to_string()
    } else {
        // Dados necessários para o token exchange — embutidos como JSON no HTML
        // para evitar qualquer problema de escape em strings JavaScript.
        // O client_secret aqui é tão seguro quanto no binário do app (é um app instalado).
        let payload = serde_json::json!({
            "code":          code.as_deref().unwrap_or(""),
            "code_verifier": code_verifier,
            "client_id":     client_id,
            "client_secret": client_secret,
            "redirect_uri":  redirect_uri,
            "callback":      format!("http://localhost:{}/token", port),
        });
        format!(r#"<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"><title>Password Keeper</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{{font-family:system-ui,sans-serif;display:flex;justify-content:center;
         align-items:center;height:100vh;margin:0;background:#0a0a16;color:#e2e8f0}}
    .card{{background:#14142e;padding:2rem;border-radius:1.5rem;
          text-align:center;border:1px solid #2a2a5a;max-width:300px;width:90%}}
    h1{{margin:0 0 .5rem;font-size:1.1rem}}
    p{{color:#94a3b8;margin:.6rem 0 0;font-size:.85rem;line-height:1.6}}
    .icon{{font-size:2.5rem;display:block;margin-bottom:.8rem}}
  </style>
</head>
<body>
  <div class="card" id="card">
    <span class="icon">⏳</span>
    <h1 style="color:#4ade80">Autenticado com sucesso!</h1>
    <p>Finalizando…</p>
  </div>
  <script type="application/json" id="d">{}</script>
  <script>
  (async function() {{
    const d = JSON.parse(document.getElementById('d').textContent);
    try {{
      // Chrome tem acesso total à rede — faz o token exchange aqui
      const resp = await fetch('https://oauth2.googleapis.com/token', {{
        method: 'POST',
        headers: {{'Content-Type': 'application/x-www-form-urlencoded'}},
        body: new URLSearchParams({{
          client_id:     d.client_id,
          client_secret: d.client_secret,
          redirect_uri:  d.redirect_uri,
          grant_type:    'authorization_code',
          code:          d.code,
          code_verifier: d.code_verifier,
        }}).toString()
      }});
      const token = await resp.json();
      // Envia token ao servidor local, depois volta ao app
      await fetch(d.callback, {{
        method: 'POST',
        headers: {{'Content-Type': 'application/json'}},
        body: JSON.stringify(token)
      }});
      document.getElementById('card').innerHTML =
        '<span class="icon">✅</span><h1 style="color:#4ade80">Pronto!</h1><p>Voltando ao Password Keeper…</p>';
      window.location.href = 'passwordkeeper://oauth-complete';
    }} catch(e) {{
      // Envia erro e volta ao app
      try {{
        await fetch(d.callback, {{
          method: 'POST',
          headers: {{'Content-Type': 'application/json'}},
          body: JSON.stringify({{error: String(e)}})
        }});
      }} catch(_) {{}}
      document.getElementById('card').innerHTML =
        '<span class="icon">❌</span><h1 style="color:#ef4444">Erro</h1><p>' + e + '</p>';
      setTimeout(() => {{ window.location.href = 'passwordkeeper://oauth-complete'; }}, 2000);
    }}
  }})();
  </script>
</body>
</html>"#, payload)
    };

    let resp1 = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html_body.len(), html_body
    );
    r1.get_mut().write_all(resp1.as_bytes()).await.map_err(|e| e.to_string())?;
    drop(r1);

    if is_error || code.is_none() {
        return Err("Autorização cancelada pelo usuário".to_string());
    }

    // ── Passo 2: recebe o token JSON que o Chrome postou em /token ────────────
    // Lê request do Chrome — pode vir um OPTIONS (CORS preflight) antes do POST real
    let token_json = loop {
        let (s, _) = tokio::time::timeout(
            std::time::Duration::from_secs(90),
            listener.accept(),
        )
        .await
        .map_err(|_| "Timeout aguardando token do browser".to_string())?
        .map_err(|e| e.to_string())?;

        let mut r2 = BufReader::new(s);
        let mut req_line2 = String::new();
        r2.read_line(&mut req_line2).await.map_err(|e| e.to_string())?;

        let mut content_length: usize = 0;
        loop {
            let mut h = String::new();
            r2.read_line(&mut h).await.map_err(|e| e.to_string())?;
            if h.to_ascii_lowercase().starts_with("content-length:") {
                content_length = h.splitn(2, ':').nth(1)
                    .unwrap_or("0").trim().parse().unwrap_or(0);
            }
            if h == "\r\n" || h.is_empty() { break; }
        }

        // Só processa o POST /token — ignora GET (favicon, etc.) e OPTIONS (preflight)
        if !req_line2.starts_with("POST") {
            let resp = if req_line2.starts_with("OPTIONS") {
                b"HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: POST\r\nAccess-Control-Allow-Headers: Content-Type\r\nConnection: close\r\n\r\n" as &[u8]
            } else {
                b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            };
            r2.get_mut().write_all(resp).await.ok();
            continue;
        }

        let mut body = vec![0u8; content_length];
        r2.read_exact(&mut body).await.map_err(|e| format!("Erro ao ler token: {}", e))?;
        let json = String::from_utf8(body).map_err(|e| e.to_string())?;

        r2.get_mut()
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n")
            .await.ok();

        break json;
    };

    // verifica se o Chrome reportou erro no token exchange
    let parsed: serde_json::Value = serde_json::from_str(&token_json)
        .map_err(|e| format!("Token inválido: {}", e))?;
    if let Some(err) = parsed.get("error") {
        return Err(format!("Falha no token exchange: {} — {}",
            err,
            parsed.get("error_description").and_then(|v| v.as_str()).unwrap_or("")
        ));
    }

    Ok(token_json)
}

/// Faz requisições HTTP pelo lado nativo.
/// Android: usa HttpURLConnection via JNI (DNS/sockets NDK não funcionam).
/// Desktop: usa reqwest diretamente.
#[tauri::command]
async fn native_fetch(
    method: String,
    url: String,
    headers: std::collections::HashMap<String, String>,
    body: Option<String>,
) -> Result<String, String> {
    // Android: delega para o Kotlin (HttpURLConnection) e retorna o JSON direto
    #[cfg(target_os = "android")]
    return android_http_request(method, url, headers, body).await;

    // Desktop: usa reqwest
    #[cfg(not(target_os = "android"))]
    {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| format!("{:?}", e))?;

    let req = match method.to_uppercase().as_str() {
        "GET"    => client.get(&url),
        "POST"   => client.post(&url),
        "PUT"    => client.put(&url),
        "PATCH"  => client.patch(&url),
        "DELETE" => client.delete(&url),
        m        => return Err(format!("Método não suportado: {}", m)),
    };
    let req = headers.iter().fold(req, |r, (k, v)| r.header(k, v));
    let req = if let Some(b) = body { req.body(b) } else { req };

    let res = req.send().await.map_err(|e| format!("{:?}", e))?;
    let status = res.status().as_u16();
    let text = res.text().await.map_err(|e| format!("{:?}", e))?;

    Ok(serde_json::json!({ "status": status, "body": text }).to_string())
    } // end #[cfg(not(target_os = "android"))]
}

/// Abre uma URL no browser padrão do sistema usando tauri-plugin-opener.
#[tauri::command]
fn open_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    open_url_with_opener(&app, &url)
}

fn open_url_with_opener(app: &tauri::AppHandle, url: &str) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

// ─── File I/O (desktop only) ──────────────────────────────────────────────────

/// Abre diálogo para selecionar imagem e retorna como data-URL base64.
/// Não disponível no Android (sem suporte a rfd).
#[cfg(not(target_os = "android"))]
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

/// Stub para Android — sem file picker nativo via rfd.
#[cfg(target_os = "android")]
#[tauri::command]
async fn pick_and_read_image() -> Result<Option<String>, String> {
    Ok(None)
}

/// Escreve conteúdo de texto em um arquivo.
#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    tokio::fs::write(&path, content.as_bytes()).await.map_err(|e| e.to_string())
}

/// Lê conteúdo de texto de um arquivo.
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path).await.map_err(|e| e.to_string())
}

/// Encerra o processo imediatamente.
#[tauri::command]
fn exit_app() {
    std::process::exit(0);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_deep_link::init());

    let builder = builder.invoke_handler(tauri::generate_handler![
        start_oauth,
        open_url,
        native_fetch,
        write_file,
        read_file,
        pick_and_read_image,
        exit_app,
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar o Password Keeper");
}
