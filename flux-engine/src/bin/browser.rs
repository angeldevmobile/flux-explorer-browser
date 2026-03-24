// ============================================================
//  ORION BROWSER — Punto de entrada del navegador nativo
//
//  Arquitectura de seguridad:
//    - SecurityLayer se aplica en el navigation_handler (sync, en-proceso)
//    - WebView2 carga páginas con su origen real → cookies y sesiones funcionan
//    - El engine HTTP (:4000) sigue para búsqueda + ranking BM25
//    - window.open() / target="_blank" → NavigateDirect (sin bloqueo)
//
//  IPC commands (chrome React → Rust):
//    navigate, reload, stop, zoom, minimize, maximize, close, drag_window,
//    chrome_height, search, download_media, cancel_download, show_in_folder,
//    set_mute
//
//  Eventos (Rust → chrome React, via evaluate_script):
//    orion:urlchange           — URL actual cambió (link click / redirect)
//    orion:focusaddressbar     — Ctrl+L pulsado
//    orion:download:started    — descarga iniciada (nativa o yt-dlp)
//    orion:download:progress   — progreso de descarga
//    orion:download:done       — descarga terminada
// ============================================================

use tao::{
    dpi::{LogicalPosition, LogicalSize},
    event::{ElementState, Event, WindowEvent},
    event_loop::{ControlFlow, EventLoopBuilder},
    keyboard::{KeyCode, ModifiersState},
    window::{Icon, WindowBuilder},
};
use wry::{Rect, WebViewBuilder};
use std::sync::Arc;
use orion_engine::security::{SecurityLayer, UrlDecision};

static ICON_BYTES: &[u8] = include_bytes!("../../../public/favicon.ico");

fn load_icon() -> Option<Icon> {
    let img = image::load_from_memory(ICON_BYTES).ok()?.into_rgba8();
    let (w, h) = img.dimensions();
    Icon::from_rgba(img.into_raw(), w, h).ok()
}

/// URL de la UI React (chrome del browser)
const UI_URL: &str = "http://localhost:8082";

/// Puerto del engine HTTP (búsqueda + ranking)
const ENGINE_PORT: u16 = 4000;

/// Altura de reserva hasta que React mida y envíe el valor real vía IPC.
const CHROME_HEIGHT: f64 = 110.0;

/// User-Agent compatible con sitios modernos
const USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OrionBrowser/0.1";

#[derive(Debug)]
enum UserEvent {
    WindowMinimize,
    WindowMaximize,
    WindowClose,
    WindowDrag,
    /// Navegación desde la barra de direcciones o un link interno.
    Navigate(String),
    /// Navegación directa sin seguridad extra: window.open() / target="_blank" / OAuth.
    NavigateDirect(String),
    /// Solo actualiza la barra de direcciones en React.
    UpdateAddressBar(String),
    ChromeHeight(f64),
    /// Recargar la página actual.
    Reload,
    /// Detener la carga.
    StopLoad,
    /// Cambiar el nivel de zoom (porcentaje: 100 = normal).
    SetZoom(f64),
    /// Decirle a React que enfoque la barra de direcciones.
    FocusAddressBar,
    /// Notificar a React que empezó una descarga nativa.
    DownloadStarted { id: String, url: String, filename: String, path: String },
    /// Notificar a React que terminó una descarga nativa.
    DownloadCompleted { id: String, url: String, path: String, success: bool },
    /// Iniciar descarga con yt-dlp (ya con ID generado).
    MediaDownload { id: String, url: String, format: String, quality: String },
    /// Progreso de descarga yt-dlp.
    MediaDownloadProgress {
        id: String,
        url: String,
        filename: String,
        percent: f64,
        speed_bps: u64,
        received: u64,
        total: u64,
    },
    /// Fin de descarga yt-dlp.
    MediaDownloadDone {
        id: String,
        url: String,
        filename: String,
        path: String,
        success: bool,
    },
    /// Silenciar / restaurar audio de la pestaña activa.
    SetMute(bool),
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Localiza yt-dlp en este orden de prioridad:
///   1. Junto al ejecutable de Orion  (bundleado, producción)
///   2. En <raíz_proyecto>/orion-engine/bin/  (desarrollo)
///   3. En el PATH del sistema  (instalación manual del usuario)
fn find_ytdlp() -> std::path::PathBuf {
    // 1. Junto al ejecutable de Orion (yt-dlp.exe en la misma carpeta)
    if let Ok(exe) = std::env::current_exe() {
        let bundled = exe
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .join("yt-dlp.exe");
        if bundled.exists() {
            println!("[orion-ytdl] yt-dlp encontrado (bundleado): {}", bundled.display());
            return bundled;
        }
    }

    // 2. Carpeta bin/ relativa al workspace (útil en desarrollo con `cargo run`)
    // Sube hasta encontrar Cargo.toml raíz → orion-engine/bin/yt-dlp.exe
    if let Ok(exe) = std::env::current_exe() {
        // target/debug|release/orion-browser.exe → subir 3 niveles
        let candidates = [
            exe.parent().and_then(|p| p.parent()).and_then(|p| p.parent())
               .map(|p| p.join("bin").join("yt-dlp.exe")),
            exe.parent().and_then(|p| p.parent()).and_then(|p| p.parent()).and_then(|p| p.parent())
               .map(|p| p.join("orion-engine").join("bin").join("yt-dlp.exe")),
        ];
        for candidate in candidates.iter().flatten() {
            if candidate.exists() {
                println!("[orion-ytdl] yt-dlp encontrado (dev/bin): {}", candidate.display());
                return candidate.clone();
            }
        }
    }

    // 3. Fallback: PATH del sistema
    println!("[orion-ytdl] yt-dlp buscando en PATH del sistema…");
    std::path::PathBuf::from("yt-dlp")
}

/// Genera un ID único a partir de la URL (para descargas nativas).
fn url_to_id(url: &str) -> String {
    let hash: u64 = url
        .bytes()
        .fold(0u64, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u64));
    format!("dl-{hash}")
}

/// Timestamp en milisegundos.
fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Parsea tamaños como "45.3MiB", "1.2GiB", "512KiB" → bytes.
fn parse_size_bytes(s: &str) -> Option<u64> {
    let s = s.trim();
    if let Some(n) = s.strip_suffix("GiB").and_then(|n| n.trim().parse::<f64>().ok()) {
        return Some((n * 1_073_741_824.0) as u64);
    }
    if let Some(n) = s.strip_suffix("MiB").and_then(|n| n.trim().parse::<f64>().ok()) {
        return Some((n * 1_048_576.0) as u64);
    }
    if let Some(n) = s.strip_suffix("KiB").and_then(|n| n.trim().parse::<f64>().ok()) {
        return Some((n * 1_024.0) as u64);
    }
    if let Some(n) = s.strip_suffix('B').and_then(|n| n.trim().parse::<f64>().ok()) {
        return Some(n as u64);
    }
    None
}

/// Parsea una línea de progreso de yt-dlp:
/// "[download]  45.3% of  100.00MiB at  2.50MiB/s ETA 00:15"
/// Devuelve (percent, speed_bps, received_bytes, total_bytes).
fn parse_ytdlp_progress(line: &str) -> Option<(f64, u64, u64, u64)> {
    if !line.starts_with("[download]") || !line.contains('%') {
        return None;
    }
    let parts: Vec<&str> = line.split_whitespace().collect();

    // Buscar token que termine en '%'
    let pct_str = parts.iter().find(|p| p.ends_with('%'))?;
    let percent: f64 = pct_str.trim_end_matches('%').parse().ok()?;

    // Total: token después de "of"
    let of_idx = parts.iter().position(|p| *p == "of")?;
    let total = parse_size_bytes(parts.get(of_idx + 1)?)?;

    let received = (percent / 100.0 * total as f64) as u64;

    // Speed: token después de "at", quitar "/s"
    let speed = parts
        .iter()
        .position(|p| *p == "at")
        .and_then(|i| parts.get(i + 1))
        .and_then(|s| parse_size_bytes(s.trim_end_matches("/s")))
        .unwrap_or(0);

    Some((percent, speed, received, total))
}

/// Función principal de descarga con yt-dlp (corre en hilo separado).
fn run_ytdlp(
    proxy: tao::event_loop::EventLoopProxy<UserEvent>,
    id: String,
    url: String,
    format: String,
    quality: String,
) {
    use std::io::{BufRead, BufReader};

    let downloads_dir = std::env::var("USERPROFILE")
        .map(|p| std::path::PathBuf::from(p).join("Downloads"))
        .unwrap_or_else(|_| std::env::temp_dir());

    let output_template = downloads_dir
        .join("%(title)s.%(ext)s")
        .to_string_lossy()
        .to_string();

    let mut args: Vec<String> = vec![
        "--newline".to_string(),
        "--progress".to_string(),
        "-o".to_string(),
        output_template,
    ];

    match format.as_str() {
        "mp3" => {
            args.extend([
                "-x".to_string(),
                "--audio-format".to_string(),
                "mp3".to_string(),
                "--audio-quality".to_string(),
                "0".to_string(),
            ]);
        }
        "m4a" => {
            args.extend([
                "-x".to_string(),
                "--audio-format".to_string(),
                "m4a".to_string(),
            ]);
        }
        _ => {
            // video (mp4)
            let height = match quality.as_str() {
                "4K" | "2160p" => "2160",
                "1440p" => "1440",
                "1080p" => "1080",
                "480p" => "480",
                _ => "720",
            };
            args.push("-f".to_string());
            args.push(format!(
                "bestvideo[height<={}]+bestaudio/best[height<={}]/best",
                height, height
            ));
            args.push("--merge-output-format".to_string());
            args.push("mp4".to_string());
        }
    }

    args.push(url.clone());

    println!("[orion-ytdl] Ejecutando: yt-dlp {}", args.join(" "));

    let ytdlp_bin = find_ytdlp();
    println!("[orion-ytdl] Usando: {}", ytdlp_bin.display());

    let mut child = match std::process::Command::new(&ytdlp_bin)
        .args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            println!("[orion-ytdl] Error al iniciar yt-dlp: {e}");
            let msg = if e.kind() == std::io::ErrorKind::NotFound {
                "yt-dlp no instalado"
            } else {
                "Error al iniciar yt-dlp"
            };
            let _ = proxy.send_event(UserEvent::MediaDownloadDone {
                id,
                url,
                filename: msg.to_string(),
                path: String::new(),
                success: false,
            });
            return;
        }
    };

    let stdout = match child.stdout.take() {
        Some(s) => s,
        None => {
            let _ = proxy.send_event(UserEvent::MediaDownloadDone {
                id,
                url,
                filename: "Error de pipe".to_string(),
                path: String::new(),
                success: false,
            });
            return;
        }
    };

    let reader = BufReader::new(stdout);
    let mut last_filename = String::from("Descargando...");
    let mut last_path = String::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        println!("[yt-dlp] {line}");

        // Detectar destino: "[download] Destination: /path/file.mp4"
        // También: "[ExtractAudio] Destination: /path/file.mp3"
        if (line.starts_with("[download]") || line.starts_with("[ExtractAudio]") || line.starts_with("[Merger]"))
            && line.contains("Destination:")
        {
            if let Some(path_part) = line.splitn(2, "Destination:").nth(1) {
                let path = path_part.trim().to_string();
                last_path = path.clone();
                last_filename = std::path::Path::new(&path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("media")
                    .to_string();

                // Notificar nombre de archivo encontrado con 0% progreso
                let _ = proxy.send_event(UserEvent::MediaDownloadProgress {
                    id: id.clone(),
                    url: url.clone(),
                    filename: last_filename.clone(),
                    percent: 0.0,
                    speed_bps: 0,
                    received: 0,
                    total: 0,
                });
            }
        }

        // Detectar progreso: "[download]  45.3% of  100.00MiB at  2.50MiB/s ETA 00:15"
        if let Some((percent, speed, received, total)) = parse_ytdlp_progress(&line) {
            let _ = proxy.send_event(UserEvent::MediaDownloadProgress {
                id: id.clone(),
                url: url.clone(),
                filename: last_filename.clone(),
                percent,
                speed_bps: speed,
                received,
                total,
            });
        }
    }

    let success = child.wait().map(|s| s.success()).unwrap_or(false);
    println!("[orion-ytdl] Finalizado (éxito={success}): {last_path}");

    let _ = proxy.send_event(UserEvent::MediaDownloadDone {
        id,
        url,
        filename: last_filename,
        path: last_path,
        success,
    });
}

// ─────────────────────────────────────────────────────────────────────────────

fn main() {
    // ── 1. Engine HTTP en hilo secundario ─────────────────────────────────
    let engine_handle = std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new()
            .expect("No se pudo crear el runtime de Tokio");

        rt.block_on(async {
            let state = Arc::new(orion_engine::api::AppState {
                client: orion_engine::fetcher::build_client(),
            });

            let app = orion_engine::api::build_router(state);

            let addr = format!("0.0.0.0:{ENGINE_PORT}");
            let listener = tokio::net::TcpListener::bind(&addr)
                .await
                .unwrap_or_else(|e| panic!("Engine: no se pudo bindear {addr}: {e}"));

            println!("[orion-engine] Corriendo en http://localhost:{ENGINE_PORT}");
            axum::serve(listener, app)
                .await
                .expect("Error en el servidor del engine");
        });
    });

    std::thread::sleep(std::time::Duration::from_millis(300));

    // ── 2. Event loop ──────────────────────────────────────────────────────
    let event_loop = EventLoopBuilder::<UserEvent>::with_user_event().build();
    let proxy          = event_loop.create_proxy();
    let proxy_nav      = proxy.clone();
    let proxy_win      = proxy.clone();
    let proxy_dl_start = proxy.clone();
    let proxy_dl_done  = proxy.clone();
    let proxy_kbd      = proxy.clone();

    // ── 3. Ventana nativa ─────────────────────────────────────────────────
    let window = WindowBuilder::new()
        .with_title("Orion Browser")
        .with_inner_size(LogicalSize::new(1400u32, 900u32))
        .with_min_inner_size(LogicalSize::new(800u32, 600u32))
        .with_window_icon(load_icon())
        .with_decorations(false)
        .with_transparent(true)
        .build(&event_loop)
        .expect("No se pudo crear la ventana nativa");

    let scale  = window.scale_factor();
    let phys   = window.inner_size();
    let init_w = phys.width  as f64 / scale;
    let init_h = phys.height as f64 / scale;

    // ── 4a. WebView de contenido ───────────────────────────────────────────
    let content_view = WebViewBuilder::new()
        .with_url("about:blank")
        .with_user_agent(USER_AGENT)
        .with_bounds(Rect {
            position: LogicalPosition::new(0.0, CHROME_HEIGHT).into(),
            size: LogicalSize::new(init_w, init_h - CHROME_HEIGHT).into(),
        })
        .with_devtools(cfg!(debug_assertions))
        .with_navigation_handler(move |url: String| {
            if url.starts_with("about:")
                || url.starts_with("orion://")
                || url.starts_with("data:")
                || url.starts_with("blob:")
                || url.starts_with("http://localhost:")
            {
                return true;
            }

            if url.starts_with("http://") || url.starts_with("https://") {
                let security = SecurityLayer::new();
                match security.check_url(&url) {
                    UrlDecision::Block(reason) => {
                        println!("[orion-security] Bloqueado ({reason:?}): {url}");
                        return false;
                    }
                    UrlDecision::Upgrade(https_url) => {
                        println!("[orion-security] HTTP→HTTPS upgrade → {https_url}");
                        let _ = proxy_nav.send_event(UserEvent::Navigate(https_url));
                        return false;
                    }
                    UrlDecision::Allow => {
                        let _ = proxy_nav.send_event(UserEvent::UpdateAddressBar(url));
                        return true;
                    }
                }
            }

            true
        })
        .with_new_window_req_handler(move |url: String| {
            if url.starts_with("http://") || url.starts_with("https://") {
                println!("[orion-browser] Nueva ventana interceptada → {url}");
                let _ = proxy_win.send_event(UserEvent::NavigateDirect(url));
            }
            false
        })
        .with_download_started_handler(move |url: String, path: &mut std::path::PathBuf| -> bool {
            let downloads_dir = std::env::var("USERPROFILE")
                .map(|p| std::path::PathBuf::from(p).join("Downloads"))
                .unwrap_or_else(|_| std::env::temp_dir());

            let raw_name = url.split('/').last().unwrap_or("archivo");
            let filename = raw_name.split('?').next().unwrap_or("archivo");
            let filename = if filename.is_empty() { "descarga" } else { filename }.to_string();

            *path = downloads_dir.join(&filename);
            let path_str = path.display().to_string();
            let id = url_to_id(&url);

            println!("[orion-download] Iniciando: {url} → {path_str}");
            let _ = proxy_dl_start.send_event(UserEvent::DownloadStarted {
                id,
                url,
                filename,
                path: path_str,
            });
            true
        })
        .with_download_completed_handler(move |url: String, path: Option<std::path::PathBuf>, success: bool| {
            let path_str = path.map(|p| p.display().to_string()).unwrap_or_default();
            let status = if success { "OK" } else { "Error" };
            println!("[orion-download] {status}: {url} → {path_str}");
            let id = url_to_id(&url);
            let _ = proxy_dl_done.send_event(UserEvent::DownloadCompleted {
                id,
                url,
                path: path_str,
                success,
            });
        })
        .build_as_child(&window)
        .expect("No se pudo crear el WebView de contenido");

    // ── 4b. WebView del chrome — Z superior ───────────────────────────────
    let chrome_view = WebViewBuilder::new()
        .with_url(UI_URL)
        .with_transparent(true)
        .with_ipc_handler(move |msg| {
            let body = msg.body().to_string();
            println!("[orion-browser] IPC recibido: {body}");

            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&body) {
                match val.get("cmd").and_then(|c| c.as_str()) {
                    Some("minimize")    => { let _ = proxy.send_event(UserEvent::WindowMinimize); }
                    Some("maximize")    => { let _ = proxy.send_event(UserEvent::WindowMaximize); }
                    Some("close")       => { let _ = proxy.send_event(UserEvent::WindowClose); }
                    Some("drag_window") => { let _ = proxy.send_event(UserEvent::WindowDrag); }
                    Some("reload")      => { let _ = proxy.send_event(UserEvent::Reload); }
                    Some("stop")        => { let _ = proxy.send_event(UserEvent::StopLoad); }
                    Some("zoom") => {
                        if let Some(level) = val.get("level").and_then(|l| l.as_f64()) {
                            let _ = proxy.send_event(UserEvent::SetZoom(level));
                        }
                    }
                    Some("navigate") => {
                        let url = val.get("url")
                            .and_then(|u| u.as_str())
                            .unwrap_or("about:blank")
                            .to_string();
                        println!("[orion-browser] Navegación → {url}");
                        let _ = proxy.send_event(UserEvent::Navigate(url));
                    }
                    Some("chrome_height") => {
                        if let Some(h) = val.get("height").and_then(|h| h.as_f64()) {
                            println!("[orion-browser] chrome_height → {h}px");
                            let _ = proxy.send_event(UserEvent::ChromeHeight(h));
                        }
                    }
                    Some("search") => {
                        let q = val.get("q").and_then(|q| q.as_str()).unwrap_or("");
                        println!("[orion-browser] Búsqueda → {q}");
                    }
                    // ── Descarga con yt-dlp ────────────────────────────────
                    Some("download_media") => {
                        let url = val.get("url")
                            .and_then(|u| u.as_str())
                            .unwrap_or("")
                            .to_string();
                        let format = val.get("format")
                            .and_then(|f| f.as_str())
                            .unwrap_or("mp4")
                            .to_string();
                        let quality = val.get("quality")
                            .and_then(|q| q.as_str())
                            .unwrap_or("1080p")
                            .to_string();
                        let id = format!("ytdl-{}", now_ms());
                        println!("[orion-ytdl] Solicitud: {url} fmt={format} q={quality} id={id}");
                        let _ = proxy.send_event(UserEvent::MediaDownload { id, url, format, quality });
                    }
                    // ── Cancelar descarga ──────────────────────────────────
                    Some("cancel_download") => {
                        if let Some(id) = val.get("id").and_then(|i| i.as_str()) {
                            println!("[orion-browser] Cancelar descarga: {id}");
                            // Las descargas nativas WebView2 no tienen API de cancelación en wry.
                            // Las descargas yt-dlp se manejan por proceso; en futuras versiones
                            // se puede almacenar el PID y enviarlo SIGTERM.
                        }
                    }
                    // ── Mostrar en carpeta ────────────────────────────────
                    Some("show_in_folder") => {
                        if let Some(path) = val.get("path").and_then(|p| p.as_str()) {
                            let path = path.to_string();
                            std::thread::spawn(move || {
                                let _ = std::process::Command::new("explorer.exe")
                                    .args(["/select,", &path])
                                    .spawn();
                            });
                        }
                    }
                    // ── Silenciar pestaña ─────────────────────────────────
                    Some("set_mute") => {
                        if let Some(muted) = val.get("muted").and_then(|m| m.as_bool()) {
                            let _ = proxy.send_event(UserEvent::SetMute(muted));
                        }
                    }
                    Some(cmd) => println!("[orion-browser] Comando desconocido: {cmd}"),
                    None      => println!("[orion-browser] IPC sin campo 'cmd'"),
                }
            }
        })
        .with_devtools(cfg!(debug_assertions))
        .with_bounds(Rect {
            position: LogicalPosition::new(0.0, 0.0).into(),
            size: LogicalSize::new(init_w, init_h).into(),
        })
        .build_as_child(&window)
        .expect("No se pudo crear el WebView del chrome");

    println!("[orion-browser] Ventana abierta — chrome: {UI_URL}");

    let chrome_full  = std::cell::Cell::new(true);
    let chrome_h     = std::cell::Cell::new(CHROME_HEIGHT);
    let ctrl_pressed = std::cell::Cell::new(false);

    // ── 5. Event loop ──────────────────────────────────────────────────────
    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        let _ = &engine_handle;

        match event {
            Event::WindowEvent { event: WindowEvent::CloseRequested, .. } => {
                println!("[orion-browser] Cerrando…");
                *control_flow = ControlFlow::Exit;
            }

            // ── Redimensionar ──────────────────────────────────────────────
            Event::WindowEvent { event: WindowEvent::Resized(phys_size), .. } => {
                let scale = window.scale_factor();
                let w  = phys_size.width  as f64 / scale;
                let h  = phys_size.height as f64 / scale;
                let ch = chrome_h.get();

                let _ = content_view.set_bounds(Rect {
                    position: LogicalPosition::new(0.0, ch).into(),
                    size: LogicalSize::new(w, (h - ch).max(0.0)).into(),
                });

                if chrome_full.get() {
                    let _ = chrome_view.set_bounds(Rect {
                        position: LogicalPosition::new(0.0, 0.0).into(),
                        size: LogicalSize::new(w, h).into(),
                    });
                } else {
                    let _ = chrome_view.set_bounds(Rect {
                        position: LogicalPosition::new(0.0, 0.0).into(),
                        size: LogicalSize::new(w, ch).into(),
                    });
                }

                println!("[orion-browser] Resize → {w:.0}×{h:.0} lógicos");
            }

            // ── Modificadores de teclado ───────────────────────────────────
            Event::WindowEvent { event: WindowEvent::ModifiersChanged(mods), .. } => {
                ctrl_pressed.set(mods.contains(ModifiersState::CONTROL));
            }

            // ── Atajos de teclado ──────────────────────────────────────────
            Event::WindowEvent {
                event: WindowEvent::KeyboardInput { event: ref key_event, .. }, ..
            } => {
                if key_event.state != ElementState::Pressed {
                    return;
                }
                let ctrl = ctrl_pressed.get();
                match key_event.physical_key {
                    KeyCode::KeyR if ctrl => { let _ = proxy_kbd.send_event(UserEvent::Reload); }
                    KeyCode::F5           => { let _ = proxy_kbd.send_event(UserEvent::Reload); }
                    KeyCode::Escape       => { let _ = proxy_kbd.send_event(UserEvent::StopLoad); }
                    KeyCode::KeyL if ctrl => { let _ = proxy_kbd.send_event(UserEvent::FocusAddressBar); }
                    _ => {}
                }
            }

            // ── Controles de ventana ───────────────────────────────────────
            Event::UserEvent(UserEvent::WindowMinimize) => { window.set_minimized(true); }
            Event::UserEvent(UserEvent::WindowMaximize) => { window.set_maximized(!window.is_maximized()); }
            Event::UserEvent(UserEvent::WindowClose)    => { *control_flow = ControlFlow::Exit; }
            Event::UserEvent(UserEvent::WindowDrag)     => { let _ = window.drag_window(); }

            // ── Chrome height ──────────────────────────────────────────────
            Event::UserEvent(UserEvent::ChromeHeight(new_h)) => {
                chrome_h.set(new_h);
                let scale = window.scale_factor();
                let phys  = window.inner_size();
                let w  = phys.width  as f64 / scale;
                let wh = phys.height as f64 / scale;

                let _ = content_view.set_bounds(Rect {
                    position: LogicalPosition::new(0.0, new_h).into(),
                    size: LogicalSize::new(w, (wh - new_h).max(0.0)).into(),
                });

                if !chrome_full.get() {
                    let _ = chrome_view.set_bounds(Rect {
                        position: LogicalPosition::new(0.0, 0.0).into(),
                        size: LogicalSize::new(w, new_h).into(),
                    });
                }

                println!("[orion-browser] chrome_h actualizado → {new_h}px");
            }

            // ── Reload / Stop / Zoom ───────────────────────────────────────
            Event::UserEvent(UserEvent::Reload) => {
                let _ = content_view.evaluate_script("location.reload()");
                println!("[orion-browser] Recargando…");
            }

            Event::UserEvent(UserEvent::StopLoad) => {
                let _ = content_view.evaluate_script("window.stop()");
                println!("[orion-browser] Deteniendo carga…");
            }

            Event::UserEvent(UserEvent::SetZoom(level)) => {
                let js = format!("document.documentElement.style.zoom='{level}%'");
                let _ = content_view.evaluate_script(&js);
                println!("[orion-browser] Zoom → {level}%");
            }

            // ── Focus barra de direcciones ─────────────────────────────────
            Event::UserEvent(UserEvent::FocusAddressBar) => {
                let _ = chrome_view.evaluate_script(
                    "window.dispatchEvent(new CustomEvent('orion:focusaddressbar'));"
                );
            }

            // ── Silenciar pestaña ──────────────────────────────────────────
            Event::UserEvent(UserEvent::SetMute(muted)) => {
                let js = if muted {
                    "document.querySelectorAll('audio,video').forEach(el=>el.muted=true)"
                } else {
                    "document.querySelectorAll('audio,video').forEach(el=>el.muted=false)"
                };
                let _ = content_view.evaluate_script(js);
                println!("[orion-browser] SetMute → {muted}");
            }

            // ── Descarga nativa: iniciada ──────────────────────────────────
            Event::UserEvent(UserEvent::DownloadStarted { id, url, filename, path }) => {
                let t = now_ms();
                let detail = serde_json::json!({
                    "id": id,
                    "filename": filename,
                    "url": url,
                    "savePath": path,
                    "state": "progressing",
                    "receivedBytes": 0u64,
                    "totalBytes": 0u64,
                    "speed": 0u64,
                    "startTime": t,
                    "endTime": serde_json::Value::Null,
                });
                let js = format!(
                    "window.dispatchEvent(new CustomEvent('orion:download:started',{{detail:{}}}));",
                    detail
                );
                let _ = chrome_view.evaluate_script(&js);
            }

            // ── Descarga nativa: completada ────────────────────────────────
            Event::UserEvent(UserEvent::DownloadCompleted { id, url, path, success }) => {
                let t = now_ms();
                let state = if success { "completed" } else { "interrupted" };
                let filename = path.split(['/', '\\']).last().unwrap_or("archivo").to_string();
                let detail = serde_json::json!({
                    "id": id,
                    "filename": filename,
                    "url": url,
                    "savePath": path,
                    "state": state,
                    "receivedBytes": 0u64,
                    "totalBytes": 0u64,
                    "speed": 0u64,
                    "startTime": t,
                    "endTime": t,
                });
                let js = format!(
                    "window.dispatchEvent(new CustomEvent('orion:download:done',{{detail:{}}}));",
                    detail
                );
                let _ = chrome_view.evaluate_script(&js);
            }

            // ── yt-dlp: iniciar en hilo secundario ─────────────────────────
            Event::UserEvent(UserEvent::MediaDownload { id, url, format, quality }) => {
                // Notificar a React que la descarga está en cola
                let t = now_ms();
                let detail = serde_json::json!({
                    "id": id,
                    "filename": "Obteniendo información del video...",
                    "url": url,
                    "savePath": "",
                    "state": "progressing",
                    "receivedBytes": 0u64,
                    "totalBytes": 0u64,
                    "speed": 0u64,
                    "startTime": t,
                    "endTime": serde_json::Value::Null,
                });
                let js = format!(
                    "window.dispatchEvent(new CustomEvent('orion:download:started',{{detail:{}}}));",
                    detail
                );
                let _ = chrome_view.evaluate_script(&js);

                // Lanzar yt-dlp en hilo separado
                let proxy_thread = proxy_kbd.clone();
                std::thread::spawn(move || {
                    run_ytdlp(proxy_thread, id, url, format, quality);
                });
            }

            // ── yt-dlp: progreso ───────────────────────────────────────────
            Event::UserEvent(UserEvent::MediaDownloadProgress {
                id, url, filename, percent, speed_bps, received, total
            }) => {
                let t = now_ms();
                let detail = serde_json::json!({
                    "id": id,
                    "filename": filename,
                    "url": url,
                    "savePath": "",
                    "state": "progressing",
                    "receivedBytes": received,
                    "totalBytes": total,
                    "speed": speed_bps,
                    "startTime": t,
                    "endTime": serde_json::Value::Null,
                });
                let js = format!(
                    "window.dispatchEvent(new CustomEvent('orion:download:progress',{{detail:{}}}));",
                    detail
                );
                let _ = chrome_view.evaluate_script(&js);
            }

            // ── yt-dlp: completado ─────────────────────────────────────────
            Event::UserEvent(UserEvent::MediaDownloadDone {
                id, url, filename, path, success
            }) => {
                let t = now_ms();
                let state = if success { "completed" } else { "interrupted" };
                let detail = serde_json::json!({
                    "id": id,
                    "filename": filename,
                    "url": url,
                    "savePath": path,
                    "state": state,
                    "receivedBytes": 0u64,
                    "totalBytes": 0u64,
                    "speed": 0u64,
                    "startTime": t,
                    "endTime": t,
                });
                let js = format!(
                    "window.dispatchEvent(new CustomEvent('orion:download:done',{{detail:{}}}));",
                    detail
                );
                let _ = chrome_view.evaluate_script(&js);
            }

            // ── Navegación principal ───────────────────────────────────────
            Event::UserEvent(UserEvent::Navigate(url)) => {
                let scale = window.scale_factor();
                let phys  = window.inner_size();
                let w  = phys.width  as f64 / scale;
                let h  = phys.height as f64 / scale;
                let ch = chrome_h.get();

                if url.starts_with("http://") || url.starts_with("https://") {
                    let security = SecurityLayer::new();
                    let final_url = match security.check_url(&url) {
                        UrlDecision::Block(reason) => {
                            println!("[orion-security] Bloqueado ({reason:?}): {url}");
                            chrome_full.set(false);
                            let _ = chrome_view.set_bounds(Rect {
                                position: LogicalPosition::new(0.0, 0.0).into(),
                                size: LogicalSize::new(w, ch).into(),
                            });
                            let _ = content_view.set_bounds(Rect {
                                position: LogicalPosition::new(0.0, ch).into(),
                                size: LogicalSize::new(w, (h - ch).max(0.0)).into(),
                            });
                            let _ = content_view.load_html(&format!(
                                "<html><body style='font-family:sans-serif;padding:2rem;\
                                 background:#0f172a;color:#94a3b8'>\
                                 <h1 style='color:#f87171'>Bloqueado por Orion Security</h1>\
                                 <p>Esta URL ha sido bloqueada: <code>{url}</code></p>\
                                 <p>Razón: <strong>{reason:?}</strong></p></body></html>"
                            ));
                            return;
                        }
                        UrlDecision::Upgrade(https_url) => {
                            println!("[orion-security] HTTP→HTTPS upgrade → {https_url}");
                            https_url
                        }
                        UrlDecision::Allow => url.clone(),
                    };

                    chrome_full.set(false);
                    let _ = chrome_view.set_bounds(Rect {
                        position: LogicalPosition::new(0.0, 0.0).into(),
                        size: LogicalSize::new(w, ch).into(),
                    });
                    let _ = content_view.set_bounds(Rect {
                        position: LogicalPosition::new(0.0, ch).into(),
                        size: LogicalSize::new(w, (h - ch).max(0.0)).into(),
                    });

                    println!("[orion-browser] content_view → {final_url}");
                    let _ = content_view.load_url(&final_url);

                } else {
                    // orion:// → React renderiza, chrome ocupa toda la ventana
                    chrome_full.set(true);
                    let _ = chrome_view.set_bounds(Rect {
                        position: LogicalPosition::new(0.0, 0.0).into(),
                        size: LogicalSize::new(w, h).into(),
                    });
                    println!("[orion-browser] content_view → {url}");
                    let _ = content_view.load_url(&url);
                }
            }

            // ── window.open() / target="_blank" / OAuth ────────────────────
            Event::UserEvent(UserEvent::NavigateDirect(url)) => {
                let scale = window.scale_factor();
                let phys  = window.inner_size();
                let w  = phys.width  as f64 / scale;
                let h  = phys.height as f64 / scale;
                let ch = chrome_h.get();

                chrome_full.set(false);
                let _ = chrome_view.set_bounds(Rect {
                    position: LogicalPosition::new(0.0, 0.0).into(),
                    size: LogicalSize::new(w, ch).into(),
                });
                let _ = content_view.set_bounds(Rect {
                    position: LogicalPosition::new(0.0, ch).into(),
                    size: LogicalSize::new(w, (h - ch).max(0.0)).into(),
                });

                println!("[orion-browser] NavigateDirect → {url}");
                let _ = content_view.load_url(&url);
            }

            // ── Actualizar barra de direcciones en React ───────────────────
            Event::UserEvent(UserEvent::UpdateAddressBar(url)) => {
                let safe = url.replace('\\', "\\\\").replace('\'', "\\'");
                let _ = chrome_view.evaluate_script(&format!(
                    "window.dispatchEvent(new CustomEvent('orion:urlchange',\
                     {{detail:{{url:'{safe}'}}}}));"
                ));
            }

            _ => {}
        }
    });
}
