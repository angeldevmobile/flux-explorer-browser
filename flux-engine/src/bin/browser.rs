// Oculta la consola en builds de release (Windows GUI app).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Flux Browser — punto de entrada del navegador nativo.
//
// La ventana es un WebView2 de chrome (React UI) encima de uno o más
// WebViews de contenido (uno por pestaña). La comunicación va por IPC wry.
//
// IPC React => Rust: navigate, reload, stop, zoom, minimize, maximize, close,
//   drag_window, chrome_height, new_tab, close_tab, download_media, set_mute,
//   show_in_folder, permission_decision, ai_panel
//
// Eventos Rust → React (via evaluate_script / CustomEvent):
//   flux:urlchange, flux:focusaddressbar,
//   flux:download:started, flux:download:progress, flux:download:done,
//   flux:permission:requested

use tao::{
    dpi::{LogicalPosition, LogicalSize},
    event::{ElementState, Event, WindowEvent},
    event_loop::{ControlFlow, EventLoopBuilder},
    keyboard::{KeyCode, ModifiersState},
    window::{Icon, WindowBuilder},
};
use wry::{Rect, WebViewBuilder};
use std::sync::Arc;
use flux_engine::security::{SecurityLayer, UrlDecision};

// UI React embebida — activa solo con: cargo build --release --features bundle-ui
// Requiere ejecutar `npm run build` antes para generar dist/
#[cfg(feature = "bundle-ui")]
include!(concat!(env!("OUT_DIR"), "/ui_embed.rs"));

// Backend Node.js compilado embebido — activa solo con: --features bundle-backend
// Requiere compilar con: cd flux-backend && npx pkg . -o ../flux-engine/bin/flux-backend.exe
#[cfg(feature = "bundle-backend")]
static BACKEND_EXE_BYTES: &[u8] = include_bytes!("../../bin/flux-backend.exe");

#[cfg(has_ytdlp)]
static YTDLP_BYTES: &[u8] = include_bytes!("../../bin/yt-dlp.exe");

static ICON_BYTES: &[u8] = include_bytes!("../../../assets/logo_flux.ico");

fn load_icon() -> Option<Icon> {
    let img = image::load_from_memory(ICON_BYTES).ok()?.into_rgba8();
    let (w, h) = img.dimensions();
    Icon::from_rgba(img.into_raw(), w, h).ok()
}

/// Puerto del engine HTTP (búsqueda + ranking)
const ENGINE_PORT: u16 = 4000;

/// URL de la UI en desarrollo (Vite dev server)
const UI_URL_DEV: &str = "http://localhost:8082";
/// URL de la UI en producción (custom protocol con UI embebida)
const UI_URL_PROD: &str = "flux://localhost/";

/// Devuelve el MIME type correcto para una extensión de archivo.
fn mime_for_ext(ext: &str) -> &'static str {
    match ext {
        "html"            => "text/html; charset=utf-8",
        "js" | "mjs"      => "application/javascript; charset=utf-8",
        "css"             => "text/css; charset=utf-8",
        "json" | "map"    => "application/json",
        "png"             => "image/png",
        "jpg" | "jpeg"    => "image/jpeg",
        "gif"             => "image/gif",
        "svg"             => "image/svg+xml",
        "ico"             => "image/x-icon",
        "webp"            => "image/webp",
        "woff"            => "font/woff",
        "woff2"           => "font/woff2",
        "ttf"             => "font/ttf",
        "otf"             => "font/otf",
        _                 => "application/octet-stream",
    }
}

/// Extrae el backend embebido a %LOCALAPPDATA%\Flux\ y lo lanza.
/// Se extrae solo si no existe o si el tamaño cambió (actualización).
#[cfg(feature = "bundle-backend")]
fn spawn_embedded_backend() -> Option<std::process::Child> {
    let app_dir = std::env::var("LOCALAPPDATA")
        .map(|p| std::path::PathBuf::from(p).join("Flux"))
        .unwrap_or_else(|_| std::env::temp_dir().join("flux"));

    if let Err(e) = std::fs::create_dir_all(&app_dir) {
        println!("[flux-backend] No se pudo crear {}: {e}", app_dir.display());
        return None;
    }

    let backend_path = app_dir.join("flux-backend.exe");
    let needs_write = !backend_path.exists() || {
        std::fs::metadata(&backend_path)
            .map(|m| m.len() != BACKEND_EXE_BYTES.len() as u64)
            .unwrap_or(true)
    };

    if needs_write {
        println!("[flux-backend] Extrayendo a {}…", backend_path.display());
        if let Err(e) = std::fs::write(&backend_path, BACKEND_EXE_BYTES) {
            println!("[flux-backend] Error al extraer: {e}");
            return None;
        }
    }

    match std::process::Command::new(&backend_path)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
    {
        Ok(child) => {
            println!("[flux-backend] Iniciado desde {} (PID {})", backend_path.display(), child.id());
            Some(child)
        }
        Err(e) => {
            println!("[flux-backend] No se pudo iniciar: {e}");
            None
        }
    }
}

/// Extrae yt-dlp embebido a %LOCALAPPDATA%\Flux\ y devuelve su ruta.
/// Se extrae solo si no existe o si el tamaño cambió (actualización).
#[cfg(has_ytdlp)]
fn extract_ytdlp() -> std::path::PathBuf {
    let app_dir = std::env::var("LOCALAPPDATA")
        .map(|p| std::path::PathBuf::from(p).join("Flux"))
        .unwrap_or_else(|_| std::env::temp_dir().join("flux"));

    let _ = std::fs::create_dir_all(&app_dir);
    let ytdlp_path = app_dir.join("yt-dlp.exe");

    let needs_write = !ytdlp_path.exists() || {
        std::fs::metadata(&ytdlp_path)
            .map(|m| m.len() != YTDLP_BYTES.len() as u64)
            .unwrap_or(true)
    };

    if needs_write {
        println!("[flux-ytdl] Extrayendo yt-dlp a {}…", ytdlp_path.display());
        let _ = std::fs::write(&ytdlp_path, YTDLP_BYTES);
    }

    ytdlp_path
}

/// Altura de reserva hasta que React mida y envíe el valor real vía IPC.
const CHROME_HEIGHT: f64 = 110.0;

/// User-Agent compatible con sitios modernos
const USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OrionBrowser/0.1";

/// Script de bloqueo de anuncios inyectado en cada página antes de que cargue
/// cualquier script del sitio. Actualmente cubre YouTube con tres capas:
///   1. Parchea ytInitialPlayerResponse para eliminar adPlacements/playerAds
///   2. CSS cosmético para ocultar elementos residuales de anuncios
///   3. Intercepta fetch/XHR para bloquear peticiones de tracking de anuncios
const ADBLOCK_INIT_SCRIPT: &str = r#"(function() {
  'use strict';

  /* ── YouTube Ad Blocker ─────────────────────────────────── */
  if (!location.hostname.includes('youtube.com')) return;

  // 1. Patch ytInitialPlayerResponse — elimina anuncios del objeto del player
  //    Se ejecuta ANTES que los scripts de YouTube, así que el setter
  //    intercepta el valor cuando YouTube lo asigna.
  var _ytIPR;
  function _stripYtAds(v) {
    if (v && typeof v === 'object') {
      v.adPlacements             = [];
      v.playerAds                = [];
      v.adSlots                  = [];
      v.adBreakHeartbeatParams   = undefined;
    }
    return v;
  }
  Object.defineProperty(window, 'ytInitialPlayerResponse', {
    get: function() { return _ytIPR; },
    set: function(v) { _ytIPR = _stripYtAds(v); },
    configurable: true,
  });

  // 2. CSS cosmético — oculta elementos residuales de anuncios
  var _adStyle = document.createElement('style');
  _adStyle.textContent = [
    '.ad-showing .video-ads',
    '.ad-interrupting',
    '#player-ads',
    '.ytp-ad-module',
    '.ytp-ad-overlay-container',
    '.ytp-ad-text-overlay',
    'ytd-action-companion-ad-renderer',
    'ytd-display-ad-renderer',
    'ytd-promoted-video-renderer',
    'ytd-search-pyv-renderer',
    'ytd-video-masthead-ad-v3-renderer',
    'ytd-promoted-sparkles-web-renderer',
    '#masthead-ad',
    '.ytd-banner-promo-renderer',
  ].join(',') + '{ display:none !important; }';
  var _injectAdStyle = function() {
    (document.head || document.documentElement).appendChild(_adStyle);
  };
  if (document.head) { _injectAdStyle(); }
  else { document.addEventListener('DOMContentLoaded', _injectAdStyle, { once: true }); }

  // 3. Intercepta fetch/XHR para bloquear URLs de tracking de anuncios
  var AD_URLS = ['/api/stats/ads', '/pagead/', '/ptracking'];
  var _origFetch = window.fetch;
  window.fetch = function(input) {
    var url = (typeof input === 'string') ? input : (input && input.url) || '';
    for (var i = 0; i < AD_URLS.length; i++) {
      if (url.indexOf(AD_URLS[i]) !== -1) {
        return Promise.resolve(new Response('', { status: 200 }));
      }
    }
    return _origFetch.apply(this, arguments);
  };
  var _origXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string') {
      for (var i = 0; i < AD_URLS.length; i++) {
        if (url.indexOf(AD_URLS[i]) !== -1) {
          url = 'about:blank';
          break;
        }
      }
    }
    return _origXHROpen.apply(this, arguments);
  };

})();"#;

#[derive(Debug)]
enum UserEvent {
    WindowMinimize,
    WindowMaximize,
    WindowClose,
    WindowDrag,
    /// Crea un nuevo WebView nativo para una nueva pestaña.
    NewTab { native_id: String, incognito: bool },
    /// Destruye el WebView de una pestaña cerrada.
    CloseTab { native_id: String },
    /// Navegación desde la barra de direcciones o un link interno.
    Navigate { native_id: String, url: String },
    /// Navegación directa sin seguridad extra: window.open() / target="_blank" / OAuth.
    NavigateDirect { native_id: String, url: String },
    /// Actualiza la barra de direcciones en React y el estado de URL en Rust.
    UpdateAddressBar { native_id: String, url: String },
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
    /// Notificar a React que un sitio solicitó un permiso.
    PermissionRequested { origin: String, kind: String },
    /// Abrir/cerrar el panel lateral de IA (ancho en píxeles lógicos, 0 = cerrado).
    AiPanelWidth(f64),
    /// Recargar la UI del chrome cuando localhost:8082 finalmente responde.
    ReloadChrome,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Localiza flux-backend.exe en este orden de prioridad:
///   1. Junto al ejecutable de Flux (bundleado, producción)
///   2. En <raíz_proyecto>/flux-engine/bin/ (desarrollo)
///   3. En el PATH del sistema
fn find_backend() -> std::path::PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        let bundled = exe
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .join("flux-backend.exe");
        if bundled.exists() {
            println!("[flux-backend] encontrado (bundleado): {}", bundled.display());
            return bundled;
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        let candidates = [
            exe.parent().and_then(|p| p.parent()).and_then(|p| p.parent())
               .map(|p| p.join("bin").join("flux-backend.exe")),
            exe.parent().and_then(|p| p.parent()).and_then(|p| p.parent()).and_then(|p| p.parent())
               .map(|p| p.join("flux-engine").join("bin").join("flux-backend.exe")),
        ];
        for candidate in candidates.iter().flatten() {
            if candidate.exists() {
                println!("[flux-backend] encontrado (dev/bin): {}", candidate.display());
                return candidate.clone();
            }
        }
    }

    println!("[flux-backend] buscando en PATH del sistema…");
    std::path::PathBuf::from("flux-backend")
}

/// Lanza flux-backend.exe como proceso hijo y devuelve el handle.
/// Si no se encuentra el ejecutable, devuelve None (el navegador sigue funcionando
/// con funcionalidad reducida — sin historial/favoritos en base de datos).
fn spawn_backend() -> Option<std::process::Child> {
    let backend_path = find_backend();
    let backend_dir = backend_path
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .to_path_buf();
    match std::process::Command::new(&backend_path)
        .current_dir(&backend_dir)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
    {
        Ok(child) => {
            println!("[flux-backend] proceso iniciado (PID {})", child.id());
            Some(child)
        }
        Err(e) => {
            println!("[flux-backend] no se pudo iniciar (funcionalidad reducida): {e}");
            None
        }
    }
}

// ── Páginas de error Flux ─────────────────────────────────────────────────────

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
     .replace('<', "&lt;")
     .replace('>', "&gt;")
     .replace('"', "&quot;")
}

/// Genera una página de error branded de Flux.
/// kind: "blocked_tracker" | "blocked_security" | "offline" | "ssl" | "not_found"
fn flux_error_page(kind: &str, url: &str) -> String {
    let (icon, heading, desc, show_retry) = match kind {
        "blocked_tracker" => (
            r##"<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>"##,
            "Tracker bloqueado",
            "Flux bloqueó este sitio porque contiene rastreadores o publicidad intrusiva que violan tu privacidad.",
            false,
        ),
        "blocked_security" => (
            r##"<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>"##,
            "Bloqueado por seguridad",
            "Flux bloqueó esta página porque infringe la política de seguridad (contenido mixto o CSP).",
            false,
        ),
        "offline" => (
            r##"<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>"##,
            "Sin conexión a internet",
            "Comprueba tu conexión y vuelve a intentarlo.",
            true,
        ),
        "not_found" => (
            r##"<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>"##,
            "Página no encontrada",
            "La dirección no existe o ha sido movida.",
            false,
        ),
        _ => (
            r##"<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>"##,
            "No se pudo cargar la página",
            "Ocurrió un error inesperado al cargar esta dirección.",
            true,
        ),
    };

    let url_safe = html_escape(url);
    let retry_btn = if show_retry {
        r#"<button onclick="location.reload()">Reintentar</button>"#
    } else {
        ""
    };

    format!(r##"<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Flux — {heading}</title>
<style>
  *{{margin:0;padding:0;box-sizing:border-box}}
  body{{
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    background:#0c0c10;color:#e2e8f0;
    display:flex;align-items:center;justify-content:center;
    min-height:100vh;
  }}
  .card{{text-align:center;max-width:460px;padding:48px 32px}}
  .badge{{
    display:inline-flex;align-items:center;gap:6px;
    background:#18181f;color:#6366f1;
    font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;
    padding:5px 12px;border-radius:20px;margin-bottom:32px;
    border:1px solid #2d2d3d;
  }}
  .icon{{margin-bottom:24px}}
  h1{{font-size:22px;font-weight:600;color:#f1f5f9;margin-bottom:10px}}
  .desc{{font-size:14px;line-height:1.7;color:#64748b;margin-bottom:20px}}
  .url{{
    font-size:12px;color:#475569;word-break:break-all;
    background:#18181f;padding:8px 14px;border-radius:8px;
    border:1px solid #2d2d3d;margin-bottom:24px;
  }}
  button{{
    background:#6366f1;color:#fff;border:none;
    padding:10px 28px;border-radius:8px;font-size:14px;
    font-weight:500;cursor:pointer;transition:background .15s;
  }}
  button:hover{{background:#4f46e5}}
</style>
</head>
<body>
<div class="card">
  <div class="badge">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="#6366f1"><circle cx="12" cy="12" r="12"/></svg>
    Flux Browser
  </div>
  <div class="icon">{icon}</div>
  <h1>{heading}</h1>
  <p class="desc">{desc}</p>
  <div class="url">{url_safe}</div>
  {retry_btn}
</div>
</body>
</html>"##)
}

// ─────────────────────────────────────────────────────────────────────────────

/// Localiza yt-dlp en este orden de prioridad:
///   1. Junto al ejecutable de Orion  (bundleado, producción)
///   2. En <raíz_proyecto>/orion-engine/bin/  (desarrollo)
///   3. En el PATH del sistema  (instalación manual del usuario)
fn find_ytdlp() -> std::path::PathBuf {
    // 1. Embebido: extraer a %LOCALAPPDATA%\Flux\ y usar desde ahí
    #[cfg(has_ytdlp)]
    {
        let path = extract_ytdlp();
        if path.exists() {
            println!("[flux-ytdl] yt-dlp embebido en: {}", path.display());
            return path;
        }
    }

    // 2. Junto al ejecutable (fallback desarrollo)
    if let Ok(exe) = std::env::current_exe() {
        let bundled = exe
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .join("yt-dlp.exe");
        if bundled.exists() {
            println!("[flux-ytdl] yt-dlp encontrado (bundleado): {}", bundled.display());
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
                println!("[flux-ytdl] yt-dlp encontrado (dev/bin): {}", candidate.display());
                return candidate.clone();
            }
        }
    }

    // 3. Fallback: PATH del sistema
    println!("[flux-ytdl] yt-dlp buscando en PATH del sistema…");
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

    println!("[flux-ytdl] Ejecutando: yt-dlp {}", args.join(" "));

    let ytdlp_bin = find_ytdlp();
    println!("[flux-ytdl] Usando: {}", ytdlp_bin.display());

    let mut child = match std::process::Command::new(&ytdlp_bin)
        .args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            println!("[flux-ytdl] Error al iniciar yt-dlp: {e}");
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
    println!("[flux-ytdl] Finalizado (éxito={success}): {last_path}");

    let _ = proxy.send_event(UserEvent::MediaDownloadDone {
        id,
        url,
        filename: last_filename,
        path: last_path,
        success,
    });
}

// ─────────────────────────────────────────────────────────────────────────────

/// Crea un WebView de contenido para una pestaña específica.
/// El WebView se crea oculto (bounds 0×0); el caller lo hace visible al activarlo.
fn make_content_view(
    native_id: String,
    proxy: tao::event_loop::EventLoopProxy<UserEvent>,
    permissions: std::sync::Arc<std::sync::Mutex<std::collections::HashMap<(String, String), bool>>>,
    offline_init_script: &str,
    window: &tao::window::Window,
    incognito: bool,
) -> wry::WebView {
    let proxy_nav  = proxy.clone();
    let proxy_win  = proxy.clone();
    let proxy_dl_s = proxy.clone();
    let proxy_dl_d = proxy.clone();
    let id_nav     = native_id.clone();
    let id_win     = native_id.clone();
    let id_dl_s    = native_id.clone();
    let id_dl_d    = native_id.clone();

    WebViewBuilder::new()
        .with_url("about:blank")
        .with_incognito(incognito)
        .with_user_agent(USER_AGENT)
        // Empieza oculto; Navigate lo hace visible cuando se activa
        .with_bounds(Rect {
            position: tao::dpi::LogicalPosition::new(0.0_f64, 0.0_f64).into(),
            size:     tao::dpi::LogicalSize::new(0.0_f64, 0.0_f64).into(),
        })
        .with_devtools(true)
        .with_navigation_handler(move |url: String| {
            if url.starts_with("about:")
                || url.starts_with("flux://")
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
                        println!("[flux-security] Bloqueado ({reason:?}): {url}");
                        return false;
                    }
                    UrlDecision::Upgrade(https_url) => {
                        println!("[flux-security] HTTP→HTTPS upgrade → {https_url}");
                        let _ = proxy_nav.send_event(UserEvent::Navigate {
                            native_id: id_nav.clone(),
                            url: https_url,
                        });
                        return false;
                    }
                    UrlDecision::Allow => {
                        let _ = proxy_nav.send_event(UserEvent::UpdateAddressBar {
                            native_id: id_nav.clone(),
                            url,
                        });
                        return true;
                    }
                }
            }
            true
        })
        .with_new_window_req_handler(move |url: String| {
            if url.starts_with("http://") || url.starts_with("https://") {
                println!("[flux-browser] Nueva ventana interceptada → {url}");
                let _ = proxy_win.send_event(UserEvent::NavigateDirect {
                    native_id: id_win.clone(),
                    url,
                });
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

            println!("[flux-download] Iniciando (tab {}): {url} → {path_str}", id_dl_s);
            let _ = proxy_dl_s.send_event(UserEvent::DownloadStarted { id, url, filename, path: path_str });
            true
        })
        .with_download_completed_handler(move |url: String, path: Option<std::path::PathBuf>, success: bool| {
            let path_str = path.map(|p| p.display().to_string()).unwrap_or_default();
            let status = if success { "OK" } else { "Error" };
            println!("[flux-download] {status} (tab {}): {url} → {path_str}", id_dl_d);
            let id = url_to_id(&url);
            let _ = proxy_dl_d.send_event(UserEvent::DownloadCompleted { id, url, path: path_str, success });
        })
        .with_initialization_script(offline_init_script)
        .with_initialization_script(ADBLOCK_INIT_SCRIPT)
        .with_custom_protocol("fluxperm".into(), {
            let permissions = permissions.clone();
            let proxy_perm  = proxy.clone();
            let id_perm     = native_id.clone();
            move |_id, request: wry::http::Request<Vec<u8>>| {
                let uri = request.uri().to_string();

                let kind = uri.split("type=").nth(1)
                    .and_then(|s| s.split('&').next())
                    .unwrap_or("unknown")
                    .to_string();
                let origin = uri.split("origin=").nth(1)
                    .map(|s| s.split('&').next().unwrap_or(s))
                    .unwrap_or("unknown")
                    .to_string();
                let key = (origin.clone(), kind.clone());

                let (allowed, pending) = {
                    let store = permissions.lock().unwrap_or_else(|e| e.into_inner());
                    match store.get(&key) {
                        Some(&a) => (a, false),
                        None     => (false, true),
                    }
                };

                if pending {
                    println!("[flux-perms] tab={id_perm} {origin} solicitó '{kind}' → pendiente");
                    let _ = proxy_perm.send_event(UserEvent::PermissionRequested {
                        origin: origin.clone(),
                        kind:   kind.clone(),
                    });
                } else {
                    println!("[flux-perms] tab={id_perm} {origin} '{kind}' → {}",
                        if allowed { "permitido" } else { "denegado" });
                }

                let body = serde_json::json!({ "allowed": allowed, "pending": pending }).to_string();
                wry::http::Response::builder()
                    .header(wry::http::header::CONTENT_TYPE, "application/json")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(std::borrow::Cow::Owned(body.into_bytes()))
                    .unwrap_or_else(|_| {
                        wry::http::Response::builder()
                            .status(500)
                            .body(std::borrow::Cow::Borrowed(b"" as &[u8]))
                            .expect("fallback response siempre válido")
                    })
            }
        })
        .build_as_child(window)
        .expect("No se pudo crear WebView de contenido")
}

// ─────────────────────────────────────────────────────────────────────────────

fn main() {
    // ── 1. Engine HTTP en hilo secundario ─────────────────────────────────
    let engine_handle = std::thread::spawn(|| {
        let rt = match tokio::runtime::Runtime::new() {
            Ok(rt) => rt,
            Err(e) => {
                eprintln!("[flux-engine] No se pudo crear el runtime de Tokio: {e}");
                eprintln!("[flux-engine] La búsqueda local no estará disponible.");
                return;
            }
        };

        rt.block_on(async {
            let state = Arc::new(flux_engine::api::AppState {
                client: flux_engine::fetcher::build_client(),
            });

            let app = flux_engine::api::build_router(state);

            let addr = format!("0.0.0.0:{ENGINE_PORT}");
            let listener = match tokio::net::TcpListener::bind(&addr).await {
                Ok(l) => l,
                Err(e) => {
                    eprintln!("[flux-engine] No se pudo bindear {addr}: {e}");
                    eprintln!("[flux-engine] La búsqueda local no estará disponible.");
                    return;
                }
            };

            println!("[Flux-engine] Corriendo en http://localhost:{ENGINE_PORT}");
            if let Err(e) = axum::serve(listener, app).await {
                eprintln!("[flux-engine] El servidor de búsqueda se detuvo inesperadamente: {e}");
            }
        });
    });

    std::thread::sleep(std::time::Duration::from_millis(300));

    // ── 2. Backend Node.js ────────────────────────────────────────────────────
    // --features bundle-backend: backend embebido → extrae a %LOCALAPPDATA%\Flux\ y lanza.
    // Sin feature: busca flux-backend.exe en rutas conocidas (dev).
    #[cfg(feature = "bundle-backend")]
    let mut backend_process = spawn_embedded_backend();
    #[cfg(not(feature = "bundle-backend"))]
    let mut backend_process = spawn_backend();

    if backend_process.is_some() {
        std::thread::sleep(std::time::Duration::from_millis(1500));
    }

    // ── 3. Modo UI ────────────────────────────────────────────────────────────
    // --features bundle-ui: UI embebida → flux://localhost/
    // Sin feature: Vite dev server → http://localhost:8082
    #[cfg(feature = "bundle-ui")]
    let ui_url: &str = UI_URL_PROD;
    #[cfg(not(feature = "bundle-ui"))]
    let ui_url: &str = UI_URL_DEV;

    #[cfg(feature = "bundle-ui")]
    println!("[flux-ui] Modo produccion — UI embebida (flux://)");
    #[cfg(not(feature = "bundle-ui"))]
    println!("[flux-ui] Modo desarrollo — esperando Vite en localhost:8082");

    // ── Permission store: (origin, kind) → allow/deny ────────────────────────
    // Persiste durante la sesión. Primera petición siempre se deniega y se
    // notifica a React para que el usuario decida.
    let permissions: std::sync::Arc<std::sync::Mutex<std::collections::HashMap<(String,String), bool>>>
        = std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new()));

    // ── Script de detección offline (se inyecta en cada página cargada) ──────
    let offline_html = flux_error_page("offline", "");
    let offline_html_js = offline_html
        .replace('\\', "\\\\")
        .replace('`', "\\`")
        .replace("${", "\\${");
    let offline_init_script = format!(
        r#"(function(){{
          /* ── Offline detection ───────────────────── */
          var _fp=`{offline_html_js}`;
          window.addEventListener('offline',function(){{
            document.open('text/html');document.write(_fp);document.close();
          }});

          /* ── Permission intercept ────────────────── */
          var _origGUM = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
            ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
            : null;
          var _origGeo = (navigator.geolocation)
            ? navigator.geolocation.getCurrentPosition.bind(navigator.geolocation)
            : null;

          function _fluxCheckPerm(type) {{
            var origin = encodeURIComponent(location.origin || 'unknown');
            return fetch('fluxperm://localhost/check?type=' + type + '&origin=' + origin)
              .then(function(r){{ return r.json(); }})
              .then(function(j){{ return j; }})
              .catch(function(){{ return {{ allowed: true, pending: false }}; }});
          }}

          if (_origGUM) {{
            navigator.mediaDevices.getUserMedia = function(constraints) {{
              var type = (constraints && constraints.video) ? 'camera' : 'microphone';
              return _fluxCheckPerm(type).then(function(j) {{
                if (j.allowed) return _origGUM(constraints);
                if (j.pending) return Promise.reject(new DOMException(
                  'Flux: acepta el permiso en la barra superior e inténtalo de nuevo.', 'NotAllowedError'));
                return Promise.reject(new DOMException('Permission denied by Flux', 'NotAllowedError'));
              }});
            }};
          }}

          if (_origGeo) {{
            navigator.geolocation.getCurrentPosition = function(success, error, opts) {{
              _fluxCheckPerm('geolocation').then(function(j) {{
                if (j.allowed) {{ _origGeo(success, error, opts); }}
                else {{ if (error) error({{ code: 1, message: 'Permission denied by Flux' }}); }}
              }});
            }};
          }}
        }})();"#
    );

    let event_loop = EventLoopBuilder::<UserEvent>::with_user_event().build();
    let proxy     = event_loop.create_proxy();
    let proxy_kbd = proxy.clone();

    // Ventana nativa────
    let window = WindowBuilder::new()
        .with_title("Flux Browser")
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

    // WebViews de contenido: uno por pestaña, se crean vía IPC new_tab.
    // Cada uno empieza con bounds 0×0 y se hace visible al activarse.
    let content_views: std::cell::RefCell<std::collections::HashMap<String, wry::WebView>> =
        std::cell::RefCell::new(std::collections::HashMap::new());
    let active_native_id: std::cell::RefCell<String> = std::cell::RefCell::new(String::new());
    let loaded_urls: std::cell::RefCell<std::collections::HashMap<String, String>> =
        std::cell::RefCell::new(std::collections::HashMap::new());

    // WebView del chrome (React UI) — capa superior
    let permissions_ipc = permissions.clone();

    // Construir el chrome WebView.
    // Con bundle-ui: registra el custom protocol "flux://" que sirve la UI embebida.
    // Sin bundle-ui: carga directamente desde localhost:8082 (Vite dev server).
    let chrome_base = WebViewBuilder::new()
        .with_url(ui_url)
        .with_transparent(true);

    #[cfg(feature = "bundle-ui")]
    let chrome_base = chrome_base.with_custom_protocol("flux".into(), |_id, request| {
        let path_str = request.uri().path().trim_start_matches('/');
        let path_str = if path_str.is_empty() { "index.html" } else { path_str };
        let ext = std::path::Path::new(path_str)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        let (bytes, mime): (&[u8], &str) = match DIST.get_file(path_str) {
            Some(f) => {
                let e = f.path().extension().and_then(|e| e.to_str()).unwrap_or("");
                (f.contents(), mime_for_ext(e))
            }
            // SPA fallback: ruta desconocida → index.html para React Router
            None => match DIST.get_file("index.html") {
                Some(f) => (f.contents(), "text/html; charset=utf-8"),
                None    => (b"Not Found", "text/plain"),
            },
        };
        wry::http::Response::builder()
            .header("Content-Type", mime)
            .header("Access-Control-Allow-Origin", "*")
            .body(std::borrow::Cow::Borrowed(bytes))
            .unwrap_or_else(|_| wry::http::Response::builder()
                .status(500)
                .body(std::borrow::Cow::Borrowed(b"error" as &[u8]))
                .expect("fallback"))
    });

    let chrome_view = chrome_base
        .with_ipc_handler(move |msg| {
            let body = msg.body().to_string();
            println!("[flux-browser] IPC recibido: {body}");

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
                    Some("new_tab") => {
                        let native_id = val.get("native_id")
                            .and_then(|n| n.as_str())
                            .unwrap_or("")
                            .to_string();
                        let incognito = val.get("private")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false);
                        if !native_id.is_empty() {
                            let _ = proxy.send_event(UserEvent::NewTab { native_id, incognito });
                        }
                    }
                    Some("close_tab") => {
                        let native_id = val.get("native_id")
                            .and_then(|n| n.as_str())
                            .unwrap_or("")
                            .to_string();
                        if !native_id.is_empty() {
                            println!("[flux-browser] close_tab → {native_id}");
                            let _ = proxy.send_event(UserEvent::CloseTab { native_id });
                        }
                    }
                    Some("navigate") => {
                        let url = val.get("url")
                            .and_then(|u| u.as_str())
                            .unwrap_or("about:blank")
                            .to_string();
                        let native_id = val.get("native_id")
                            .and_then(|n| n.as_str())
                            .unwrap_or("")
                            .to_string();
                        println!("[flux-browser] navigate tab={native_id} → {url}");
                        let _ = proxy.send_event(UserEvent::Navigate { native_id, url });
                    }
                    Some("chrome_height") => {
                        if let Some(h) = val.get("height").and_then(|h| h.as_f64()) {
                            println!("[flux-browser] chrome_height → {h}px");
                            let _ = proxy.send_event(UserEvent::ChromeHeight(h));
                        }
                    }
                    Some("search") => {
                        let q = val.get("q").and_then(|q| q.as_str()).unwrap_or("");
                        println!("[flux-browser] Búsqueda → {q}");
                    }
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
                        println!("[flux-ytdl] Solicitud: {url} fmt={format} q={quality} id={id}");
                        let _ = proxy.send_event(UserEvent::MediaDownload { id, url, format, quality });
                    }
                    Some("cancel_download") => {
                        if let Some(id) = val.get("id").and_then(|i| i.as_str()) {
                            println!("[flux-browser] Cancelar descarga: {id}");
                            // Las descargas nativas WebView2 no tienen API de cancelación en wry.
                            // Las descargas yt-dlp se manejan por proceso; en futuras versiones
                            // se puede almacenar el PID y enviarlo SIGTERM.
                        }
                    }
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
                    Some("set_mute") => {
                        if let Some(muted) = val.get("muted").and_then(|m| m.as_bool()) {
                            let _ = proxy.send_event(UserEvent::SetMute(muted));
                        }
                    }
                    Some("permission_decision") => {
                        let origin = val.get("origin").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let kind   = val.get("kind").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let allow  = val.get("allow").and_then(|v| v.as_bool()).unwrap_or(false);
                        if !origin.is_empty() && !kind.is_empty() {
                            permissions_ipc.lock().unwrap_or_else(|e| e.into_inner()).insert((origin.clone(), kind.clone()), allow);
                            println!("[flux-perms] Decisión guardada — {origin} {kind}: {allow}");
                        }
                    }
                    Some("ai_panel") => {
                        let width = val.get("width").and_then(|w| w.as_f64()).unwrap_or(0.0);
                        let _ = proxy.send_event(UserEvent::AiPanelWidth(width));
                    }
                    Some(cmd) => println!("[flux-browser] Comando desconocido: {cmd}"),
                    None      => println!("[flux-browser] IPC sin campo 'cmd'"),
                }
            }
        })
        .with_devtools(true)
        .with_bounds(Rect {
            position: LogicalPosition::new(0.0, 0.0).into(),
            size: LogicalSize::new(init_w, init_h).into(),
        })
        .build_as_child(&window)
        .expect("No se pudo crear el WebView del chrome");

    // En modo dev (sin dist/), sondear localhost:8082 hasta que Vite esté listo.
    // En producción no hace falta: flux:// sirve los archivos directamente.
    #[cfg(not(feature = "bundle-ui"))]
    {
        let proxy_ui = event_loop.create_proxy();
        std::thread::spawn(move || {
            use std::net::TcpStream;
            for attempt in 1u32..=60 {
                std::thread::sleep(std::time::Duration::from_secs(1));
                if TcpStream::connect("127.0.0.1:8082").is_ok() {
                    println!("[flux-browser] Vite disponible (intento {attempt}) → recargando chrome");
                    let _ = proxy_ui.send_event(UserEvent::ReloadChrome);
                    return;
                }
            }
            println!("[flux-browser] Vite no disponible después de 60 s — ejecuta `npm run dev`");
        });
    }

    println!("[flux-browser] Ventana abierta — chrome: {ui_url}");

    let chrome_full  = std::cell::Cell::new(true);
    let chrome_h     = std::cell::Cell::new(CHROME_HEIGHT);
    let ai_panel_w   = std::cell::Cell::new(0.0_f64);
    let ctrl_pressed = std::cell::Cell::new(false);

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        let _ = &engine_handle;

        match event {
            Event::WindowEvent { event: WindowEvent::CloseRequested, .. } => {
                println!("[flux-browser] Cerrando…");
                if let Some(ref mut p) = backend_process {
                    let _ = p.kill();
                    println!("[flux-backend] proceso detenido");
                }
                *control_flow = ControlFlow::Exit;
            }

            Event::WindowEvent { event: WindowEvent::Resized(phys_size), .. } => {
                let scale = window.scale_factor();
                let w  = phys_size.width  as f64 / scale;
                let h  = phys_size.height as f64 / scale;

                // Ignorar eventos espurios de inicialización en Windows (frameless+transparent
                // dispara un Resized con tamaño casi nulo antes de llegar al tamaño real).
                // WebView2 falla al crear su render surface en dimensiones tan pequeñas.
                if w < 200.0 || h < 100.0 {
                    return;
                }

                let ch = chrome_h.get();
                let pw = ai_panel_w.get();

                // Redimensionar solo el WebView activo (los demás están a 0×0)
                if !chrome_full.get() {
                    let aid = active_native_id.borrow().clone();
                    if let Some(view) = content_views.borrow().get(&aid) {
                        let _ = view.set_bounds(Rect {
                            position: LogicalPosition::new(0.0, ch).into(),
                            size: LogicalSize::new((w - pw).max(0.0), (h - ch).max(0.0)).into(),
                        });
                    }
                }

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

                println!("[flux-browser] Resize → {w:.0}×{h:.0} lógicos");
            }

            Event::WindowEvent { event: WindowEvent::ModifiersChanged(mods), .. } => {
                ctrl_pressed.set(mods.contains(ModifiersState::CONTROL));
            }

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

            Event::UserEvent(UserEvent::ReloadChrome) => {
                let _ = chrome_view.load_url(ui_url);
                println!("[flux-browser] UI recargada → {ui_url}");
            }

            Event::UserEvent(UserEvent::WindowMinimize) => { window.set_minimized(true); }
            Event::UserEvent(UserEvent::WindowMaximize) => { window.set_maximized(!window.is_maximized()); }
            Event::UserEvent(UserEvent::WindowClose) => {
                if let Some(ref mut p) = backend_process {
                    let _ = p.kill();
                    println!("[flux-backend] proceso detenido");
                }
                *control_flow = ControlFlow::Exit;
            }
            Event::UserEvent(UserEvent::WindowDrag)     => { let _ = window.drag_window(); }

            Event::UserEvent(UserEvent::ChromeHeight(new_h)) => {
                chrome_h.set(new_h);
                let scale = window.scale_factor();
                let phys  = window.inner_size();
                let w  = phys.width  as f64 / scale;
                let wh = phys.height as f64 / scale;
                let pw = ai_panel_w.get();

                if !chrome_full.get() {
                    let aid = active_native_id.borrow().clone();
                    if let Some(view) = content_views.borrow().get(&aid) {
                        let _ = view.set_bounds(Rect {
                            position: LogicalPosition::new(0.0, new_h).into(),
                            size: LogicalSize::new((w - pw).max(0.0), (wh - new_h).max(0.0)).into(),
                        });
                    }
                    let _ = chrome_view.set_bounds(Rect {
                        position: LogicalPosition::new(0.0, 0.0).into(),
                        size: LogicalSize::new(w, new_h).into(),
                    });
                }

                println!("[flux-browser] chrome_h actualizado → {new_h}px");
            }

            Event::UserEvent(UserEvent::AiPanelWidth(new_pw)) => {
                ai_panel_w.set(new_pw);
                let scale = window.scale_factor();
                let phys  = window.inner_size();
                let w  = phys.width  as f64 / scale;
                let wh = phys.height as f64 / scale;
                let ch = chrome_h.get();

                if !chrome_full.get() {
                    let aid = active_native_id.borrow().clone();
                    if let Some(view) = content_views.borrow().get(&aid) {
                        let _ = view.set_bounds(Rect {
                            position: LogicalPosition::new(0.0, ch).into(),
                            size: LogicalSize::new((w - new_pw).max(0.0), (wh - ch).max(0.0)).into(),
                        });
                    }
                }

                println!("[flux-browser] ai_panel_w → {new_pw}px");
            }

            Event::UserEvent(UserEvent::Reload) => {
                let aid = active_native_id.borrow().clone();
                if let Some(view) = content_views.borrow().get(&aid) {
                    let _ = view.evaluate_script("location.reload()");
                }
                println!("[flux-browser] Recargando…");
            }

            Event::UserEvent(UserEvent::StopLoad) => {
                let aid = active_native_id.borrow().clone();
                if let Some(view) = content_views.borrow().get(&aid) {
                    let _ = view.evaluate_script("window.stop()");
                }
                println!("[flux-browser] Deteniendo carga…");
            }

            Event::UserEvent(UserEvent::SetZoom(level)) => {
                let js = format!("document.documentElement.style.zoom='{level}%'");
                let aid = active_native_id.borrow().clone();
                if let Some(view) = content_views.borrow().get(&aid) {
                    let _ = view.evaluate_script(&js);
                }
                println!("[flux-browser] Zoom → {level}%");
            }

            Event::UserEvent(UserEvent::FocusAddressBar) => {
                let _ = chrome_view.evaluate_script(
                    "window.dispatchEvent(new CustomEvent('orion:focusaddressbar'));"
                );
            }

            Event::UserEvent(UserEvent::PermissionRequested { origin, kind }) => {
                let label = match kind.as_str() {
                    "Camera"        => "la cámara",
                    "Microphone"    => "el micrófono",
                    "Geolocation"   => "tu ubicación",
                    "Notifications" => "enviar notificaciones",
                    "ClipboardRead" => "leer el portapapeles",
                    _               => "un permiso del sistema",
                };
                let detail = serde_json::json!({
                    "origin": origin,
                    "kind":   kind,
                    "label":  label,
                });
                let js = format!(
                    "window.dispatchEvent(new CustomEvent('orion:permission:requested',{{detail:{}}}));",
                    detail
                );
                let _ = chrome_view.evaluate_script(&js);
                println!("[flux-perms] Evento enviado a React → {origin} quiere {label}");
            }

            Event::UserEvent(UserEvent::SetMute(muted)) => {
                let js = if muted {
                    "document.querySelectorAll('audio,video').forEach(el=>el.muted=true)"
                } else {
                    "document.querySelectorAll('audio,video').forEach(el=>el.muted=false)"
                };
                let aid = active_native_id.borrow().clone();
                if let Some(view) = content_views.borrow().get(&aid) {
                    let _ = view.evaluate_script(js);
                }
                println!("[flux-browser] SetMute → {muted}");
            }

            Event::UserEvent(UserEvent::NewTab { native_id, incognito }) => {
                if !content_views.borrow().contains_key(&native_id) {
                    let new_view = make_content_view(
                        native_id.clone(),
                        proxy_kbd.clone(),
                        permissions.clone(),
                        &offline_init_script,
                        &window,
                        incognito,
                    );
                    content_views.borrow_mut().insert(native_id, new_view);
                }
            }

            Event::UserEvent(UserEvent::CloseTab { native_id }) => {
                println!("[flux-browser] Destruyendo WebView de tab {native_id}");
                content_views.borrow_mut().remove(&native_id);
                loaded_urls.borrow_mut().remove(&native_id);
                let current = active_native_id.borrow().clone();
                if current == native_id {
                    *active_native_id.borrow_mut() = String::new();
                }
                // Si era la pestaña activa y estaba mostrando web, volver a chrome_full
                if current == native_id && !chrome_full.get() {
                    let scale = window.scale_factor();
                    let phys  = window.inner_size();
                    let w = phys.width  as f64 / scale;
                    let h = phys.height as f64 / scale;
                    chrome_full.set(true);
                    let _ = chrome_view.set_bounds(Rect {
                        position: LogicalPosition::new(0.0, 0.0).into(),
                        size: LogicalSize::new(w, h).into(),
                    });
                }
            }

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

            Event::UserEvent(UserEvent::MediaDownload { id, url, format, quality }) => {
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

                let proxy_thread = proxy_kbd.clone();
                std::thread::spawn(move || {
                    run_ytdlp(proxy_thread, id, url, format, quality);
                });
            }

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

            Event::UserEvent(UserEvent::Navigate { native_id, url }) => {
                let scale = window.scale_factor();
                let phys  = window.inner_size();
                let w  = phys.width  as f64 / scale;
                let h  = phys.height as f64 / scale;
                let ch = chrome_h.get();
                let pw = ai_panel_w.get();

                // Si cambiamos de pestaña activa, ocultar la anterior
                let current_active = active_native_id.borrow().clone();
                if current_active != native_id && !current_active.is_empty() {
                    if let Some(old_view) = content_views.borrow().get(&current_active) {
                        let _ = old_view.set_bounds(Rect {
                            position: LogicalPosition::new(0.0, 0.0).into(),
                            size: LogicalSize::new(0.0, 0.0).into(),
                        });
                    }
                }
                *active_native_id.borrow_mut() = native_id.clone();

                if url.starts_with("http://") || url.starts_with("https://") {
                    let security = SecurityLayer::new();
                    let final_url = match security.check_url(&url) {
                        UrlDecision::Block(reason) => {
                            println!("[flux-security] Bloqueado ({reason:?}): {url}");
                            chrome_full.set(false);
                            let _ = chrome_view.set_bounds(Rect {
                                position: LogicalPosition::new(0.0, 0.0).into(),
                                size: LogicalSize::new(w, ch).into(),
                            });
                            let kind = match reason {
                                flux_engine::security::BlockReason::AdTracker    => "blocked_tracker",
                                flux_engine::security::BlockReason::MixedContent => "blocked_security",
                                flux_engine::security::BlockReason::CspViolation => "blocked_security",
                            };
                            if let Some(view) = content_views.borrow().get(&native_id) {
                                let _ = view.set_bounds(Rect {
                                    position: LogicalPosition::new(0.0, ch).into(),
                                    size: LogicalSize::new((w - pw).max(0.0), (h - ch).max(0.0)).into(),
                                });
                                let _ = view.load_html(&flux_error_page(kind, &url));
                            }
                            return;
                        }
                        UrlDecision::Upgrade(https_url) => {
                            println!("[flux-security] HTTP→HTTPS upgrade → {https_url}");
                            https_url
                        }
                        UrlDecision::Allow => url.clone(),
                    };

                    chrome_full.set(false);
                    let _ = chrome_view.set_bounds(Rect {
                        position: LogicalPosition::new(0.0, 0.0).into(),
                        size: LogicalSize::new(w, ch).into(),
                    });

                    if let Some(view) = content_views.borrow().get(&native_id) {
                        let _ = view.set_bounds(Rect {
                            position: LogicalPosition::new(0.0, ch).into(),
                            size: LogicalSize::new((w - pw).max(0.0), (h - ch).max(0.0)).into(),
                        });
                        // Solo recargar si la URL cambió (evitar recargas en cambio de pestaña)
                        let last = loaded_urls.borrow().get(&native_id).cloned().unwrap_or_default();
                        if last != final_url {
                            loaded_urls.borrow_mut().insert(native_id.clone(), final_url.clone());
                            println!("[flux-browser] tab={native_id} → {final_url}");
                            let _ = view.load_url(&final_url);
                        } else {
                            println!("[flux-browser] tab={native_id} ya tiene {final_url} (sin recarga)");
                        }
                    }

                } else {
                    // flux:// → React renderiza, el WebView de contenido se oculta
                    chrome_full.set(true);
                    let _ = chrome_view.set_bounds(Rect {
                        position: LogicalPosition::new(0.0, 0.0).into(),
                        size: LogicalSize::new(w, h).into(),
                    });
                    // Asegurarse de que el WebView de esta pestaña esté oculto
                    if let Some(view) = content_views.borrow().get(&native_id) {
                        let _ = view.set_bounds(Rect {
                            position: LogicalPosition::new(0.0, 0.0).into(),
                            size: LogicalSize::new(0.0, 0.0).into(),
                        });
                    }
                }
            }

            // ── window.open() / target="_blank" / OAuth ────────────────────
            Event::UserEvent(UserEvent::NavigateDirect { native_id, url }) => {
                let scale = window.scale_factor();
                let phys  = window.inner_size();
                let w  = phys.width  as f64 / scale;
                let h  = phys.height as f64 / scale;
                let ch = chrome_h.get();
                let pw = ai_panel_w.get();

                chrome_full.set(false);
                let _ = chrome_view.set_bounds(Rect {
                    position: LogicalPosition::new(0.0, 0.0).into(),
                    size: LogicalSize::new(w, ch).into(),
                });
                if let Some(view) = content_views.borrow().get(&native_id) {
                    let _ = view.set_bounds(Rect {
                        position: LogicalPosition::new(0.0, ch).into(),
                        size: LogicalSize::new((w - pw).max(0.0), (h - ch).max(0.0)).into(),
                    });
                    loaded_urls.borrow_mut().insert(native_id.clone(), url.clone());
                    println!("[flux-browser] NavigateDirect tab={native_id} → {url}");
                    let _ = view.load_url(&url);
                }
            }

            // ── Actualizar barra de direcciones en React ───────────────────
            // También actualiza loaded_urls para evitar recarga al volver a esta pestaña
            Event::UserEvent(UserEvent::UpdateAddressBar { native_id, url }) => {
                loaded_urls.borrow_mut().insert(native_id, url.clone());
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
