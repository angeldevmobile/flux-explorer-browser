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

use std::os::windows::process::CommandExt;
const CREATE_NO_WINDOW: u32 = 0x08000000;

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

//   WebView2 COM — acceso directo para WebResourceRequested          
#[cfg(target_os = "windows")]
use webview2_com::{
    Microsoft::Web::WebView2::Win32::{
        ICoreWebView2,
        ICoreWebView2_2,
        ICoreWebView2WebResourceRequest,
        ICoreWebView2WebResourceRequestedEventArgs,
        COREWEBVIEW2_WEB_RESOURCE_CONTEXT,
        COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
    },
    WebResourceRequestedEventHandler,
};
#[cfg(target_os = "windows")]
use windows::core::{HSTRING, Interface};
#[cfg(target_os = "windows")]
use windows::Win32::System::WinRT::EventRegistrationToken;

// UI React embebida — activa solo con: cargo build --release --features bundle-ui
// Requiere ejecutar `npm run build` antes para generar dist/
#[cfg(feature = "bundle-ui")]
include!(concat!(env!("OUT_DIR"), "/ui_embed.rs"));

// Backend Node.js compilado embebido — activa solo con: --features bundle-backend
// Requiere compilar con: cd flux-backend && npx pkg . -o ../flux-engine/bin/flux-backend.exe
#[cfg(feature = "bundle-backend")]
static BACKEND_EXE_BYTES: &[u8] = include_bytes!("../../bin/flux-backend.exe");

// Addon nativo de SQLite — debe extraerse junto al backend
#[cfg(feature = "bundle-backend")]
static SQLITE_NODE_BYTES: &[u8] = include_bytes!("../../../flux-backend/node_modules/better-sqlite3/build/Release/better_sqlite3.node");

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

/// Obtiene el JWT_SECRET desde Windows Credential Manager.
/// Si no existe, genera uno nuevo de 64 bytes aleatorios y lo guarda.
fn get_or_create_jwt_secret() -> String {
    use keyring::Entry;
    use rand::Rng;

    let entry = Entry::new("FluxBrowser", "jwt_secret")
        .expect("No se pudo acceder a Windows Credential Manager");

    match entry.get_password() {
        Ok(secret) if secret.len() >= 32 => {
            println!("[flux-backend] JWT_SECRET cargado desde Credential Manager");
            secret
        }
        _ => {
            let secret: String = rand::thread_rng()
                .sample_iter(&rand::distributions::Alphanumeric)
                .take(64)
                .map(char::from)
                .collect();
            if let Err(e) = entry.set_password(&secret) {
                println!("[flux-backend] No se pudo guardar JWT_SECRET en Credential Manager: {e}");
            } else {
                println!("[flux-backend] JWT_SECRET generado y guardado en Credential Manager");
            }
            secret
        }
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

    // Extraer addon nativo de SQLite
    let sqlite_path = app_dir.join("better_sqlite3.node");
    if !sqlite_path.exists() {
        println!("[flux-backend] Extrayendo better_sqlite3.node…");
        if let Err(e) = std::fs::write(&sqlite_path, SQLITE_NODE_BYTES) {
            println!("[flux-backend] Error al extraer sqlite addon: {e}");
            return None;
        }
    }

    let db_path = app_dir.join("flux.db");
    let db_url = format!("file:{}", db_path.display());
    let jwt_secret = get_or_create_jwt_secret();

    let log_path = app_dir.join("flux-backend.log");
    let log_file = std::fs::OpenOptions::new()
        .create(true).append(true).open(&log_path)
        .ok()
        .map(std::process::Stdio::from);
    let log_file2 = std::fs::OpenOptions::new()
        .create(true).append(true).open(&log_path)
        .ok()
        .map(std::process::Stdio::from);

    match std::process::Command::new(&backend_path)
        .current_dir(&app_dir)
        .env("PORT", "3000")
        .env("NODE_ENV", "production")
        .env("DATABASE_URL", &db_url)
        .env("JWT_SECRET", &jwt_secret)
        .env("JWT_EXPIRE", "7d")
        .env("FRONTEND_URL", "http://localhost:5173")
        .env("SEARXNG_URL", "http://34.229.141.6:8080")
        .env("AI_PROXY_URL", "http://34.229.141.6:3001")
        .stdin(std::process::Stdio::null())
        .stdout(log_file.unwrap_or(std::process::Stdio::null()))
        .stderr(log_file2.unwrap_or(std::process::Stdio::null()))
        .creation_flags(CREATE_NO_WINDOW)
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
/// cualquier script del sitio. Cubre todos los sitios con cinco capas:
///   1. CSS cosmético universal (AdSense, DoubleClick, YouTube, etc.)
///   2. Intercepta fetch/XHR para bloquear peticiones de redes de anuncios
///      y parchea respuestas del player de YouTube para eliminar adPlacements
///   3. YouTube: parchea ytInitialPlayerResponse y ytInitialData
///   4. YouTube: MutationObserver + setInterval para auto‑saltar anuncios
///   5. YouTube: ocultar overlay de anuncio cada frame con requestAnimationFrame
const ADBLOCK_INIT_SCRIPT: &str = r#"(function() {
  'use strict';

  /*   1. CSS cosmético universal                ─ */
  var _cssRules = [
    /* Genérico / redes de anuncios */
    '[id*="ad-slot"]', '[id*="google_ads"]', '[id*="google_ad_"]',
    '[class*="ad-banner"]', '[class*="ad-container"]', '[class*="ad-wrapper"]',
    '[data-ad-slot]', '[data-ad-unit]', '[data-google-query-id]',
    'ins.adsbygoogle',
    'iframe[src*="doubleclick"]',
    'iframe[src*="googlesyndication"]',
    'iframe[src*="googleadservices"]',
    'div[id*="AdDiv"]', 'div[id*="ad_unit"]',
    'div[id*="adsense"]', 'div[class*="adsense"]',
    /* YouTube — clases estáticas y dinámicas */
    '#player-ads', '#masthead-ad',
    '.ytp-ad-module',
    '.ytp-ad-overlay-container',
    '.ytp-ad-text-overlay',
    '.ytp-ad-image-overlay',
    '.ytp-ad-player-overlay-layout',
    '.ytp-ad-player-overlay-instream-info',
    '.ytp-ad-action-interstitial',
    /* Los botones de saltar NO se ocultan a propósito: ocultarlos deja el
       anuncio imposible de saltar, ni por el auto-skip (un elemento con
       display:none no se puede pulsar) ni a mano por el usuario. */
    '.ytp-ad-feedback-dialog-container',
    '.ytp-ad-persistent-progress-bar-container',
    '.ad-showing .video-ads',
    '.ad-interrupting',
    '.ad-container',
    'ytd-action-companion-ad-renderer',
    'ytd-display-ad-renderer',
    'ytd-promoted-video-renderer',
    'ytd-search-pyv-renderer',
    'ytd-video-masthead-ad-v3-renderer',
    'ytd-video-masthead-ad-advertiser-info-renderer',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-promoted-sparkles-text-search-renderer',
    'ytd-banner-promo-renderer',
    'ytd-in-feed-ad-layout-renderer',
    'ytd-statement-banner-renderer',
    'ytd-ad-slot-renderer',
    'yt-mealbar-promo-renderer',
    'ytd-primetime-promo-renderer',
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
    /* Banners de suscripción a YouTube Premium */
    'ytd-membership-offer-promo-renderer',
    'ytd-compact-promoted-video-renderer',
  ];
  var _adCSS = _cssRules.join(',') + '{ display:none !important; visibility:hidden !important; pointer-events:none !important; }';

  function _injectCSS() {
    var s = document.getElementById('_flux_adblock_css');
    if (!s) {
      s = document.createElement('style');
      s.id = '_flux_adblock_css';
    }
    s.textContent = _adCSS;
    (document.head || document.documentElement).appendChild(s);
  }
  _injectCSS();
  document.addEventListener('DOMContentLoaded', _injectCSS, { once: true });

  /*   1b. Colapsar lo que el filtro de red bloqueó          ─
     Cuando se cancela una petición el elemento sigue en el DOM con su
     espacio reservado, y se ve un bloque blanco donde estaba el anuncio.
     Los eventos 'error' no burbujean, así que hay que escuchar en captura. */
  document.addEventListener('error', function(ev) {
    var el = ev.target;
    if (!el || !el.tagName) return;
    var tag = el.tagName.toLowerCase();
    if (tag !== 'img' && tag !== 'iframe' && tag !== 'embed' && tag !== 'object') return;

    el.style.setProperty('display', 'none', 'important');

    /* Si el contenedor existía sólo para reservarle sitio al anuncio,
       queda un hueco igual. Colapsarlo si no le queda nada visible. */
    var p = el.parentElement;
    if (p && p.children.length === 1 && !(p.textContent || '').trim()) {
      p.style.setProperty('display', 'none', 'important');
    }
  }, true);

  /*   2. Interceptar fetch/XHR — bloquear redes de anuncios  ─ */
  var BLOCKED_PATTERNS = [
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
    'googletagmanager.com', 'googletag.com', 'googletagservices.com',
    '/pagead/', '/ads/get', '/ptracking', '/adview',
    'adservice.google.', 'adnxs.com', 'criteo.', 'criteo.net',
    'amazon-adsystem.com', 'outbrain.com', 'taboola.com',
    'pubmatic.com', 'openx.net', 'rubiconproject.com',
    'moatads.com', 'adsafeprotected.com',
    /* YouTube ad tracking (no el player principal) */
    'youtube.com/api/stats/ads',
    'youtube.com/pagead',
    'youtube.com/get_video_info?adformat',
    '/api/stats/ads',
    '/pcs/activeview', '/pagead/lvz',
  ];

  function _isBlockedUrl(url) {
    if (!url || typeof url !== 'string') return false;
    for (var i = 0; i < BLOCKED_PATTERNS.length; i++) {
      if (url.indexOf(BLOCKED_PATTERNS[i]) !== -1) return true;
    }
    return false;
  }

  /* Parche de respuesta para /youtubei/v1/player: elimina adPlacements */
  function _isYtPlayerApi(url) {
    return typeof url === 'string' &&
      (url.indexOf('/youtubei/v1/player') !== -1 ||
       url.indexOf('/youtubei/v2/player') !== -1 ||
       url.indexOf('/youtubei/v1/next') !== -1 ||
       url.indexOf('/youtubei/v1/browse') !== -1 ||
       url.indexOf('/youtubei/v1/search') !== -1 ||
       url.indexOf('/youtubei/v1/reel/reel_watch_sequence') !== -1);
  }

  /* Claves que YouTube usa para entregar anuncios. Se vacían (las de tipo
     array) o se eliminan (los renderers sueltos dentro de listas). */
  var _AD_ARRAY_KEYS = [
    'adPlacements', 'playerAds', 'adSlots', 'adBreakHeartbeatParams',
  ];
  var _AD_NODE_KEYS = [
    'adPlacementRenderer', 'adSlotRenderer', 'adDurationRemaining',
    'promotedSparklesWebRenderer', 'promotedSparklesTextSearchRenderer',
    'compactPromotedVideoRenderer', 'promotedVideoRenderer',
    'displayAdRenderer', 'actionCompanionAdRenderer',
    'searchPyvRenderer', 'bannerPromoRenderer', 'statementBannerRenderer',
    'inFeedAdLayoutRenderer', 'mealbarPromoRenderer', 'primetimePromoRenderer',
    'videoMastheadAdV3Renderer', 'membershipOfferPromoRenderer',
    'brandVideoSingletonRenderer', 'brandVideoShelfRenderer',
    'adsEngagementPanelRenderer', 'playerLegacyDesktopWatchAdsRenderer',
  ];

  function _hasAdNodeKey(o) {
    for (var i = 0; i < _AD_NODE_KEYS.length; i++) {
      if (o[_AD_NODE_KEYS[i]] !== undefined) return true;
    }
    return false;
  }

  /* Recorrido recursivo. Reemplaza al regex anterior, que no podía atravesar
     objetos anidados y en la práctica no eliminaba nada. */
  function _stripAds(node, depth) {
    if (!node || typeof node !== 'object' || depth > 40) return node;

    if (Array.isArray(node)) {
      var out = [];
      for (var i = 0; i < node.length; i++) {
        var el = node[i];
        /* Descartar entradas de lista que sean contenedores de anuncios:
           así desaparecen del feed sin dejar huecos. */
        if (el && typeof el === 'object' && !Array.isArray(el) && _hasAdNodeKey(el)) continue;
        out.push(_stripAds(el, depth + 1));
      }
      return out;
    }

    for (var k in node) {
      if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
      if (_AD_ARRAY_KEYS.indexOf(k) !== -1) {
        /* Vaciar, no borrar: el player consulta estas claves y si faltan
           por completo algunas rutas de código tiran excepción. */
        node[k] = [];
        continue;
      }
      if (_AD_NODE_KEYS.indexOf(k) !== -1) {
        try { delete node[k]; } catch(e) {}
        continue;
      }
      node[k] = _stripAds(node[k], depth + 1);
    }
    return node;
  }

  /* Salir de SABR (server-side ad insertion).
     Con SABR, YouTube cose el anuncio dentro del mismo stream y por el mismo
     dominio que el video, así que ningún filtro de red puede separarlos.
     Quitando serverAbrStreamingUrl el player vuelve a adaptiveFormats
     clásicos, donde el anuncio sí viaja aparte y se puede bloquear.

     Sólo se hace si quedan formatos utilizables: si no, es preferible ver el
     anuncio a quedarse sin video. */
  /* Interruptor de seguridad. Si el opt-out rompe la reproducción, se activa
     y ya no se vuelve a intentar en toda la sesión: reproducir siempre pesa
     más que bloquear el anuncio. */
  var _SABR_OFF_KEY = '_flux_sabr_off';

  function _sabrOptOutApagado() {
    try { return sessionStorage.getItem(_SABR_OFF_KEY) === '1'; } catch(e) { return true; }
  }

  function _apagarSabrOptOut() {
    try { sessionStorage.setItem(_SABR_OFF_KEY, '1'); } catch(e) {}
  }

  function _optOutOfSabr(sd) {
    if (_sabrOptOutApagado()) return;
    if (!sd || typeof sd !== 'object') return;
    if (!sd.serverAbrStreamingUrl) return;

    /* En vivo no tiene formatos progresivos equivalentes: quitarle SABR
       lo deja sin nada que reproducir. */
    if (sd.hlsManifestUrl || sd.dashManifestUrl) return;

    /* Sólo cuenta una URL directa. signatureCipher exige descifrado con la
       función del player y suele venir estrangulado — si nos apoyamos en eso
       el video falla con "Se produjo un error". */
    var formats = [].concat(sd.adaptiveFormats || [], sd.formats || []);
    var directas = 0;
    for (var i = 0; i < formats.length; i++) {
      if (formats[i] && formats[i].url) directas++;
    }
    if (directas === 0) return;

    try { delete sd.serverAbrStreamingUrl; } catch(e) {}
  }

  function _stripAdsFromPlayerJson(json) {
    try {
      var isString = typeof json === 'string';
      var obj = isString ? JSON.parse(json) : json;
      obj = _stripAds(obj, 0);
      if (obj && obj.streamingData) _optOutOfSabr(obj.streamingData);
      return isString ? JSON.stringify(obj) : obj;
    } catch(e) { return json; }
  }

  /* fetch wrapper */
  var _origFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = (typeof input === 'string') ? input
            : (input && input.url) ? input.url : '';
    if (_isBlockedUrl(url)) {
      return Promise.resolve(new Response('{}', { status: 200,
        headers: { 'Content-Type': 'application/json' } }));
    }
    if (_isYtPlayerApi(url)) {
      return _origFetch.apply(this, arguments).then(function(resp) {
        var clone = resp.clone();
        return clone.text().then(function(text) {
          var patched = _stripAdsFromPlayerJson(text);
          return new Response(patched, {
            status: resp.status,
            statusText: resp.statusText,
            headers: resp.headers,
          });
        }).catch(function() { return resp; });
      });
    }
    return _origFetch.apply(this, arguments);
  };

  /* XHR wrapper */
  var _origXHROpen = XMLHttpRequest.prototype.open;
  var _origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    var args = Array.prototype.slice.call(arguments);
    this._fluxUrl = String(url || '');
    if (_isBlockedUrl(this._fluxUrl)) {
      this._fluxBlocked = true;
      args[1] = 'about:blank';
    }
    return _origXHROpen.apply(this, args);
  };
  XMLHttpRequest.prototype.send = function() {
    if (this._fluxBlocked) return;
    if (_isYtPlayerApi(this._fluxUrl || '')) {
      var _self = this;
      var _origOnLoad = this.onload;
      this.addEventListener('load', function() {
        try {
          var patched = _stripAdsFromPlayerJson(_self.responseText);
          Object.defineProperty(_self, 'responseText', { get: function(){ return patched; }, configurable: true });
          Object.defineProperty(_self, 'response',     { get: function(){ return patched; }, configurable: true });
        } catch(e) {}
      });
    }
    return _origXHRSend.apply(this, arguments);
  };

  /*   3. YouTube: patch ytInitialPlayerResponse + ytInitialData   */
  if (!location.hostname.includes('youtube.com')) return;

  /* Intercepta una variable global de YouTube y limpia lo que se le asigne.
     Debe hacerse en document-start, antes de que el HTML inline la escriba. */
  function _guardGlobal(name) {
    var _val;
    try {
      Object.defineProperty(window, name, {
        get: function() { return _val; },
        set: function(v) {
          v = _stripAds(v, 0);
          if (v && v.streamingData) _optOutOfSabr(v.streamingData);
          _val = v;
        },
        configurable: true,
      });
    } catch(e) {}
  }

  _guardGlobal('ytInitialPlayerResponse');  /* anuncios del video */
  _guardGlobal('ytInitialData');            /* feed, búsqueda, sidebar */

  /* ytplayer.config.args.player_response llega como JSON *en texto*: el
     recorrido recursivo no lo ve, hay que parsearlo aparte. */
  var _ytPlayerCfg;
  try {
    Object.defineProperty(window, 'ytplayer', {
      get: function() { return _ytPlayerCfg; },
      set: function(v) {
        try {
          if (v && v.config && v.config.args && typeof v.config.args.player_response === 'string') {
            v.config.args.player_response =
              _stripAdsFromPlayerJson(v.config.args.player_response);
          }
        } catch(e) {}
        _ytPlayerCfg = v;
      },
      configurable: true,
    });
  } catch(e) {}

  /* Silenciar y saltarse el anuncio de video lo antes posible */
  /*   4 & 5. Auto‑saltar anuncios                ─ */
  /* ¿Se puede pulsar de verdad?
     No sirve `offsetParent !== null`: da null tanto para display:none como
     para cualquier elemento con position:fixed, y YouTube pone el botón de
     saltar en contenedores fijos. Medimos la caja real. */
  function _esPulsable(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    var cs = window.getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.pointerEvents !== 'none';
  }

  function _trySkip() {
    /* Botones de saltar. El orden va de lo más específico a lo más genérico. */
    var skipSels = [
      '.ytp-skip-ad-button',
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      '.ytp-skip-ad-button__text',
      '[id^="skip-button"]',
      '[class*="skip-ad"]',
      '[class*="skipButton"]',
      'button.ytp-ad-overlay-close-button',
    ];
    for (var si = 0; si < skipSels.length; si++) {
      var btns = document.querySelectorAll(skipSels[si]);
      for (var bi = 0; bi < btns.length; bi++) {
        if (_esPulsable(btns[bi])) {
          btns[bi].click();
          return true;
        }
      }
    }

    /* Sin botón disponible todavía: adelantar el anuncio hasta el final.
       Sólo con la señal estricta — si nos equivocamos acá, saltamos el
       video que el usuario quería ver. */
    if (!_adConfirmado()) return false;

    var player = document.querySelector('#movie_player') || document;
    var video  = player.querySelector('video');
    if (!video) return false;

    video.muted  = true;
    video.volume = 0;

    /* En directos duration es Infinity, así que `isFinite` descartaba el
       salto y el anuncio se veía entero. Durante el anuncio el rango
       seekable sí termina: usamos su final. */
    var destino = 0;
    if (isFinite(video.duration) && video.duration > 0) {
      destino = video.duration;
    } else if (video.seekable && video.seekable.length > 0) {
      destino = video.seekable.end(video.seekable.length - 1);
    }
    if (destino > 0 && isFinite(destino)) {
      try { video.currentTime = destino; return true; } catch(e) {}
    }

    /* Último recurso: acelerar el anuncio al máximo permitido. */
    try { video.playbackRate = 16; return true; } catch(e) {}
    return false;
  }

  /* Ocultar overlay de anuncio en tiempo real */
  function _hideAdOverlay() {
    var overlays = document.querySelectorAll(
      '.ytp-ad-player-overlay-layout, .ytp-ad-text-overlay, ' +
      '.ytp-ad-image-overlay, .ytp-ad-action-interstitial, ' +
      '.ytp-ad-module, #player-ads'
    );
    for (var oi = 0; oi < overlays.length; oi++) {
      overlays[oi].style.setProperty('display', 'none', 'important');
    }
  }

  /* ── Bucle de reacción ──────────────────────────────────────────
     El MutationObserver es quien detecta que apareció un anuncio. Sólo
     entonces se enciende un intervalo corto, que se apaga cuando el
     anuncio termina. Antes esto era un requestAnimationFrame infinito
     (60 querySelector/s en toda página de YouTube, para siempre) más un
     setInterval permanente; con el observer alcanza y no gasta CPU
     mientras mirás un video normal. */
  var _adTimer = null;

  /* Detección amplia: sólo habilita ocultar overlays y pulsar el botón de
     saltar. Un falso positivo aquí no hace daño. */
  function _adShowing() {
    return !!document.querySelector(
      '.ad-showing, .ad-interrupting, .ytp-ad-player-overlay-layout, ' +
      '.ytp-ad-player-overlay, .ytp-skip-ad'
    );
  }

  /* Detección estricta: exigida antes de mover currentTime o playbackRate.
     Un falso positivo aquí adelantaría el video de verdad hasta el final,
     así que sólo confiamos en las clases que YouTube pone en el player
     únicamente mientras corre un anuncio. */
  function _adConfirmado() {
    var p = document.querySelector('#movie_player');
    if (!p) return false;
    return p.classList.contains('ad-showing') || p.classList.contains('ad-interrupting');
  }

  /* Devolver el player a la normalidad. Imprescindible: si _trySkip tuvo que
     acelerar el anuncio a 16x y no se restaura, el video de verdad arranca
     acelerado y con el audio desactivado. */
  function _restaurarPlayer() {
    var player = document.querySelector('#movie_player') || document;
    var video  = player.querySelector('video');
    if (!video) return;
    if (video.playbackRate !== 1) { try { video.playbackRate = 1; } catch(e) {} }
    if (video.muted && !_silenciadoPorUsuario) { try { video.muted = false; } catch(e) {} }
  }

  /* Respetar el silencio si lo puso el usuario, no el auto-skip. */
  var _silenciadoPorUsuario = false;
  document.addEventListener('volumechange', function(ev) {
    if (!_adShowing() && ev.target && ev.target.tagName === 'VIDEO') {
      _silenciadoPorUsuario = ev.target.muted;
    }
  }, true);

  function _stopAdTimer() {
    if (_adTimer !== null) { clearInterval(_adTimer); _adTimer = null; }
    _restaurarPlayer();
  }

  function _react() {
    if (!_adShowing()) { _stopAdTimer(); return; }
    _hideAdOverlay();
    _trySkip();
    if (_adTimer === null) {
      _adTimer = setInterval(function() {
        if (!_adShowing()) { _stopAdTimer(); return; }
        _hideAdOverlay();
        _trySkip();
      }, 250);
    }
  }

  var _obs = new MutationObserver(_react);

  function _startObs() {
    _obs.disconnect();
    var player = document.querySelector('#movie_player, #player-container, ytd-player');
    _obs.observe(player || document.documentElement, {
      attributes: true, attributeFilter: ['class'], childList: true, subtree: true,
    });
    _react();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _startObs, { once: true });
  } else {
    _startObs();
  }

  /* YouTube es una SPA: al pasar de un video a otro no recarga la página,
     así que hay que re-enganchar el observer al player nuevo. */
  window.addEventListener('yt-navigate-finish', _startObs);
  window.addEventListener('yt-page-data-updated', _startObs);

  /* ── Red de seguridad del opt-out de SABR ──────────────────────
     Si el player muestra "Se produjo un error", asumimos que fuimos
     nosotros: apagamos el opt-out para toda la sesión y recargamos una
     sola vez. La segunda pasada ya no toca serverAbrStreamingUrl, así
     que el video reproduce aunque vuelva el anuncio.
     El propio flag evita bucles: una vez apagado no se vuelve a entrar. */
  function _playerEnError() {
    if (document.querySelector('.ytp-error')) return true;
    var m = document.querySelector('yt-player-error-message-renderer');
    return !!(m && m.offsetParent !== null);
  }

  function _vigilarErrorDePlayer() {
    if (_sabrOptOutApagado()) return;   /* ya estamos en modo seguro */
    if (!_playerEnError()) return;
    _apagarSabrOptOut();
    location.reload();
  }

  /* Vigilar sólo durante los primeros segundos tras cargar: si el video
     arrancó bien, no hay nada que corregir y el temporizador se apaga. */
  var _vigiladas = 0;
  var _vigilante = setInterval(function() {
    _vigiladas++;
    if (_vigiladas > 20 || _sabrOptOutApagado()) { clearInterval(_vigilante); return; }
    _vigilarErrorDePlayer();
  }, 1000);

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
    /// El documento nuevo ya existe y empezó a cargar: momento correcto para
    /// inyectar el filtrado cosmético. Hacerlo en el navigation_handler no
    /// sirve — ahí todavía vive el documento anterior y el CSS se pierde
    /// cuando éste se destruye.
    PageLoadStarted { native_id: String, url: String },
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
    /// Overlay del menú de Flux sobre el contenido nativo.
    /// Cuando active=true → chrome_view se expande a pantalla completa para que
    /// el menú React aparezca por encima del content_view nativo.
    MenuOverlay(bool),
    /// Recargar la UI del chrome cuando localhost:8082 finalmente responde.
    ReloadChrome,
}

//   Helpers                                  ─

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

//   Páginas de error Flux                           ─

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

//                                       ─

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

//                                       ─

/// Crea un WebView de contenido para una pestaña específica.
/// El WebView se crea oculto (bounds 0×0); el caller lo hace visible al activarlo.
//                                       ─
// WebResourceRequested — filtrado de sub-recursos a nivel de red (estilo Brave)
// Intercepta scripts, imágenes, iframes y XHR *dentro* del proceso WebView2,
// antes de que se abra cualquier socket TCP. Más eficiente que el proxy TCP.
//                                       ─

/// Contador global de peticiones bloqueadas, para mostrarlo en la UI.
static ADS_BLOCKED: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Total de anuncios y trackers bloqueados desde que arrancó el navegador.
fn ads_blocked_count() -> u64 {
    ADS_BLOCKED.load(std::sync::atomic::Ordering::Relaxed)
}

/// Traduce el contexto de recurso de WebView2 al vocabulario de adblock-rust.
/// Los tipos importan: muchas reglas de EasyList sólo aplican a `$script`,
/// `$image` o `$subdocument`, así que mandar todo como "other" perdería match.
#[cfg(target_os = "windows")]
fn resource_type_name(ctx: COREWEBVIEW2_WEB_RESOURCE_CONTEXT) -> &'static str {
    match ctx.0 {
        1  => "sub_frame",      // iframe (la navegación principal se filtra aparte)
        2  => "stylesheet",
        3  => "image",
        4  => "media",
        5  => "font",
        6  => "script",
        7  => "xmlhttprequest",
        8  => "xmlhttprequest", // fetch()
        11 => "websocket",
        14 => "ping",
        15 => "csp_report",
        _  => "other",
    }
}

/// ¿Son `uri` y `source` el mismo documento?
///
/// Importa para no confundir la navegación principal con un iframe: si
/// el usuario escribe `https://sitio.com` WebView2 pide `https://sitio.com/`,
/// y una comparación literal fallaría. Tratar la página principal como
/// sub-recurso podría bloquear el sitio entero.
fn same_document(uri: &str, source: &str) -> bool {
    fn normalize(u: &str) -> &str {
        let no_fragment = u.split('#').next().unwrap_or(u);
        no_fragment.strip_suffix('/').unwrap_or(no_fragment)
    }
    !source.is_empty() && normalize(uri) == normalize(source)
}

/// Lee la URI de una petición WebView2 como `String`.
///
/// # Safety
/// `request` debe ser una interfaz COM válida; la llamada devuelve un PWSTR
/// asignado por WebView2 cuyo contenido copiamos antes de devolverlo.
#[cfg(target_os = "windows")]
unsafe fn request_uri(request: &ICoreWebView2WebResourceRequest) -> Option<String> {
    let mut uri = windows::core::PWSTR::null();
    request.Uri(&mut uri).ok()?;
    if uri.is_null() {
        return None;
    }
    let len = (0..).take_while(|&i| *uri.0.add(i) != 0).count();
    let slice = std::slice::from_raw_parts(uri.0, len);
    Some(String::from_utf16_lossy(slice))
}

/// Registra el filtro WebResourceRequested en el WebView2 dado.
///
/// Cada sub-recurso (script, imagen, iframe, XHR, fetch, websocket) pasa por
/// el motor adblock-rust con EasyList + EasyPrivacy + uBlock cargados.
/// Debe llamarse desde el hilo principal de la ventana, donde vive el COM.
///
/// `current_url` es la URL del documento de la pestaña: adblock-rust la usa
/// para distinguir first-party de third-party y para las reglas `$domain=`.
#[cfg(target_os = "windows")]
fn attach_adblock_filter(webview: &wry::WebView, current_url: Arc<std::sync::Mutex<String>>) {
    use wry::WebViewExtWindows;

    unsafe {
        // Obtener ICoreWebView2 desde el controlador que expone wry
        let controller = webview.controller();
        let core: ICoreWebView2 = match controller.CoreWebView2() {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[adblock-wv2] No se pudo obtener ICoreWebView2: {e}");
                return;
            }
        };

        // El entorno es quien fabrica respuestas sintéticas. Sin él no se
        // puede cancelar una petición: hace falta *darle* una respuesta.
        let environment = match core.cast::<ICoreWebView2_2>().and_then(|c| c.Environment()) {
            Ok(env) => env,
            Err(e) => {
                eprintln!("[adblock-wv2] No se pudo obtener ICoreWebView2Environment: {e}");
                eprintln!("[adblock-wv2] El bloqueo de red queda DESACTIVADO en esta pestaña.");
                return;
            }
        };

        // Registrar filtro global: interceptar TODOS los sub-recursos (*)
        let filter = HSTRING::from("*");
        if let Err(e) = core.AddWebResourceRequestedFilter(&filter, COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL) {
            eprintln!("[adblock-wv2] AddWebResourceRequestedFilter falló: {e}");
            return;
        }

        let mut token = EventRegistrationToken::default();
        let result = core.add_WebResourceRequested(
            &WebResourceRequestedEventHandler::create(Box::new(
                move |_webview, args: Option<ICoreWebView2WebResourceRequestedEventArgs>| {
                    let Some(args) = args else { return Ok(()); };

                    let request = match args.Request() {
                        Ok(r) => r,
                        Err(_) => return Ok(()),
                    };

                    let Some(uri) = request_uri(&request) else { return Ok(()); };
                    if uri.is_empty() {
                        return Ok(());
                    }

                    // Tipo de recurso — determina qué reglas de EasyList aplican.
                    let mut ctx = COREWEBVIEW2_WEB_RESOURCE_CONTEXT::default();
                    if args.ResourceContext(&mut ctx).is_err() {
                        return Ok(());
                    }
                    let rtype = resource_type_name(ctx);

                    // Documento que origina la petición.
                    let source = current_url
                        .lock()
                        .unwrap_or_else(|e| e.into_inner())
                        .clone();

                    // La navegación principal ya pasó por SecurityLayer en
                    // with_navigation_handler; no volver a filtrarla aquí.
                    if rtype == "sub_frame" && same_document(&uri, &source) {
                        return Ok(());
                    }

                    if !flux_engine::adblocker::should_block(&uri, &source, rtype) {
                        return Ok(());
                    }

                    // ── Cancelar de verdad ────────────────────────────────
                    // En WebView2, Response = null es el valor por defecto y
                    // significa "seguí a la red". Para bloquear hay que
                    // asignar una respuesta real; ésta va vacía con 403.
                    match environment.CreateWebResourceResponse(
                        None,
                        403,
                        windows::core::w!("Blocked by Flux"),
                        windows::core::w!("Access-Control-Allow-Origin: *\r\nContent-Length: 0"),
                    ) {
                        Ok(response) => {
                            if args.SetResponse(&response).is_ok() {
                                let n = ADS_BLOCKED
                                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed)
                                    + 1;
                                if cfg!(debug_assertions) {
                                    println!("[adblock] #{n} bloqueado ({rtype}): {uri}");
                                }
                            }
                        }
                        Err(e) => eprintln!("[adblock] CreateWebResourceResponse falló: {e}"),
                    }

                    Ok(())
                },
            )),
            &mut token,
        );

        if let Err(e) = result {
            eprintln!("[adblock-wv2] add_WebResourceRequested falló: {e}");
        } else {
            println!("[adblock-wv2] Filtro de red activo (EasyList + EasyPrivacy + uBlock)");
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn attach_adblock_filter(_webview: &wry::WebView, _current_url: Arc<std::sync::Mutex<String>>) {}

/// Inyecta el filtrado cosmético que las listas definen para *este* sitio.
///
/// El CSS del init script es genérico e igual para toda la web. Esto añade
/// las reglas específicas del dominio (`youtube.com##.ytd-ad-slot-renderer`)
/// más los scriptlets de uBlock, que son los que desarman los detectores de
/// adblock. Se re-inyecta en cada navegación porque los selectores cambian
/// según la URL.
fn inject_cosmetic_filters(
    views: &std::collections::HashMap<String, wry::WebView>,
    native_id: &str,
    url: &str,
) {
    let Some(view) = views.get(native_id) else { return };

    let (css, scriptlets) = flux_engine::adblocker::cosmetic_payload(url);
    if css.is_empty() && scriptlets.is_empty() {
        return;
    }

    if cfg!(debug_assertions) {
        println!(
            "[adblock] cosmética inyectada en {url} ({} bytes CSS, {} bytes JS)",
            css.len(),
            scriptlets.len()
        );
    }

    let mut js = String::new();

    if !css.is_empty() {
        // Pasar el CSS como literal JSON evita romper el script con comillas
        // o barras invertidas presentes en los selectores.
        let css_literal = serde_json::to_string(&css).unwrap_or_else(|_| "\"\"".into());
        js.push_str(&format!(
            "(function(){{var s=document.getElementById('_flux_cosmetic');\
             if(!s){{s=document.createElement('style');s.id='_flux_cosmetic';\
             (document.head||document.documentElement).appendChild(s);}}\
             s.textContent={css_literal};}})();"
        ));
    }

    if !scriptlets.is_empty() {
        // Los scriptlets se auto-encapsulan; aislarlos para que un fallo en
        // uno no impida aplicar el CSS ni rompa la página.
        js.push_str(&format!("try{{{scriptlets}}}catch(e){{}}"));
    }

    let _ = view.evaluate_script(&js);
}

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

    // URL del documento actual de esta pestaña. El filtro de anuncios la
    // necesita para decidir first-party vs third-party: sin ella, adblock-rust
    // trataría todo como third-party y bloquearía recursos propios del sitio.
    let current_url     = Arc::new(std::sync::Mutex::new(String::new()));
    let current_url_nav = current_url.clone();
    let id_win     = native_id.clone();
    let id_dl_s    = native_id.clone();
    let id_dl_d    = native_id.clone();

    let view = WebViewBuilder::new()
        .with_url("about:blank")
        .with_incognito(incognito)
        .with_user_agent(USER_AGENT)
        // Empieza oculto; Navigate lo hace visible cuando se activa
        .with_bounds(Rect {
            position: tao::dpi::LogicalPosition::new(0.0_f64, 0.0_f64).into(),
            size:     tao::dpi::LogicalSize::new(0.0_f64, 0.0_f64).into(),
        })
        .with_devtools(cfg!(debug_assertions))
        .with_navigation_handler(move |url: String| {
            // Registrar el documento antes de decidir: el filtro de red empieza
            // a ver sub-recursos en cuanto la navegación se acepta.
            if url.starts_with("http://") || url.starts_with("https://") {
                *current_url_nav.lock().unwrap_or_else(|e| e.into_inner()) = url.clone();
            }

            if url.starts_with("about:")
                || url.starts_with("flux://")
                || url.starts_with("data:")
                || url.starts_with("blob:")
                || url.starts_with("http://localhost:")
            {
                return true;
            }

            if url.starts_with("http://") || url.starts_with("https://") {
                // Ojo: aquí sólo se decide la navegación de nivel superior.
                // El bloqueo de anuncios NO debe actuar en este punto —
                // su lista hace `contains()` sobre la URL entera, así que
                // un simple `?utm_source=taboola.com` tumbaba la página y
                // dejaba al usuario en la pantalla de error. Los anuncios
                // se filtran por sub-recurso en el WebResourceRequested,
                // que sí distingue host, tipo y first/third-party.
                let mut security = SecurityLayer::new();
                security.block_ads = false;
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
        .with_on_page_load_handler({
            let proxy_load = proxy.clone();
            let id_load    = native_id.clone();
            move |event, url| {
                if matches!(event, wry::PageLoadEvent::Started) {
                    let _ = proxy_load.send_event(UserEvent::PageLoadStarted {
                        native_id: id_load.clone(),
                        url,
                    });
                }
            }
        })
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
        .expect("No se pudo crear WebView de contenido");

    // Registrar el filtro WebResourceRequested (bloqueo a nivel de red, estilo Brave).
    // Corre en el hilo principal justo después de crear el WebView2.
    attach_adblock_filter(&view, current_url);
    view
}

//                                       ─

fn main() {
    //   0. Motor de bloqueo — construirlo antes de abrir ninguna pestaña ─
    // Tarda ~200 ms parseando ~150.000 reglas. Hacerlo ahora evita que la
    // primera navegación cargue anuncios mientras el motor todavía arranca.
    flux_engine::adblocker::warm_up();

    //   1. Engine HTTP en hilo secundario                 ─
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

    //   2. Backend Node.js                           
    // --features bundle-backend: backend embebido → extrae a %LOCALAPPDATA%\Flux\ y lanza.
    // Sin feature: busca flux-backend.exe en rutas conocidas (dev).
    #[cfg(feature = "bundle-backend")]
    let mut backend_process = spawn_embedded_backend();
    #[cfg(not(feature = "bundle-backend"))]
    let mut backend_process = spawn_backend();

    if backend_process.is_some() {
        std::thread::sleep(std::time::Duration::from_millis(1500));
    }

    //   3. Modo UI                               
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

    //   Permission store: (origin, kind) → allow/deny             
    // Persiste durante la sesión. Primera petición siempre se deniega y se
    // notifica a React para que el usuario decida.
    let permissions: std::sync::Arc<std::sync::Mutex<std::collections::HashMap<(String,String), bool>>>
        = std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new()));

    //   Script de detección offline (se inyecta en cada página cargada)    
    let offline_html = flux_error_page("offline", "");
    let offline_html_js = offline_html
        .replace('\\', "\\\\")
        .replace('`', "\\`")
        .replace("${", "\\${");
    let offline_init_script = format!(
        r#"(function(){{
          /*   Offline detection           ─ */
          var _fp=`{offline_html_js}`;
          window.addEventListener('offline',function(){{
            document.open('text/html');document.write(_fp);document.close();
          }});

          /*   Permission intercept           */
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

    // Ventana nativa  
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
                    Some("menu_overlay") => {
                        let active = val.get("active").and_then(|v| v.as_bool()).unwrap_or(false);
                        let _ = proxy.send_event(UserEvent::MenuOverlay(active));
                    }
                    Some(cmd) => println!("[flux-browser] Comando desconocido: {cmd}"),
                    None      => println!("[flux-browser] IPC sin campo 'cmd'"),
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
                    // Quando il pannello AI è aperto, espandere chrome_view a tutta l'altezza
                    // così il pannello React (parte destra) è visibile sopra il content_view.
                    // La regione trasparente sinistra lascia vedere il content_view nativo.
                    let chrome_target_h = if new_pw > 0.0 { wh } else { ch };
                    let _ = chrome_view.set_bounds(Rect {
                        position: LogicalPosition::new(0.0, 0.0).into(),
                        size: LogicalSize::new(w, chrome_target_h).into(),
                    });
                }

                println!("[flux-browser] ai_panel_w → {new_pw}px");
            }

            Event::UserEvent(UserEvent::MenuOverlay(active)) => {
                let scale = window.scale_factor();
                let phys  = window.inner_size();
                let w  = phys.width  as f64 / scale;
                let wh = phys.height as f64 / scale;
                let ch = chrome_h.get();
                let pw = ai_panel_w.get();

                if !chrome_full.get() {
                    let aid = active_native_id.borrow().clone();
                    if active {
                        // Menú abierto → chrome_view a pantalla completa para que
                        // el overlay React quede por encima del content_view nativo.
                        let _ = chrome_view.set_bounds(Rect {
                            position: LogicalPosition::new(0.0, 0.0).into(),
                            size: LogicalSize::new(w, wh).into(),
                        });
                        // IMPORTANTE: ocultar el content_view (WebView2 tiene mayor z-order
                        // por ser creado después; expandir chrome_view no basta para cubrirlo).
                        if let Some(view) = content_views.borrow().get(&aid) {
                            let _ = view.set_bounds(Rect {
                                position: LogicalPosition::new(0.0, 0.0).into(),
                                size: LogicalSize::new(0.0, 0.0).into(),
                            });
                        }
                    } else {
                        // Menú cerrado → restaurar chrome_view a su altura correcta
                        // (full si hay panel IA abierto, header‑only si no).
                        let restore_h = if pw > 0.0 { wh } else { ch };
                        let _ = chrome_view.set_bounds(Rect {
                            position: LogicalPosition::new(0.0, 0.0).into(),
                            size: LogicalSize::new(w, restore_h).into(),
                        });
                        // Restaurar el content_view a sus bounds originales.
                        if let Some(view) = content_views.borrow().get(&aid) {
                            let _ = view.set_bounds(Rect {
                                position: LogicalPosition::new(0.0, ch).into(),
                                size: LogicalSize::new((w - pw).max(0.0), (wh - ch).max(0.0)).into(),
                            });
                        }
                    }
                }
                println!("[flux-browser] menu_overlay → {active}");
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

                // Sólo en builds de desarrollo: FLUX_TEST_URL reemplaza la
                // página inicial, para poder verificar el filtrado contra un
                // sitio concreto sin tocar la UI. Nunca se compila en release.
                #[cfg(debug_assertions)]
                let url = if url == "about:blank" {
                    std::env::var("FLUX_TEST_URL").unwrap_or(url)
                } else { url };

                if url.starts_with("http://") || url.starts_with("https://") {
                    // Mismo criterio que en el navigation_handler: no tirar la
                    // navegación entera por un match de anuncios. Aquí además
                    // se cargaba la página de error "blocked_tracker", que es
                    // lo que dejaba al usuario con "recargá la pantalla".
                    let mut security = SecurityLayer::new();
                    security.block_ads = false;
                    let final_url = match security.check_url(&url) {
                        UrlDecision::Block(reason) => {
                            println!("[flux-security] Bloqueado ({reason:?}): {url}");
                            chrome_full.set(false);
                            let chrome_target_h = if pw > 0.0 { h } else { ch };
                            let _ = chrome_view.set_bounds(Rect {
                                position: LogicalPosition::new(0.0, 0.0).into(),
                                size: LogicalSize::new(w, chrome_target_h).into(),
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
                    let chrome_target_h = if pw > 0.0 { h } else { ch };
                    let _ = chrome_view.set_bounds(Rect {
                        position: LogicalPosition::new(0.0, 0.0).into(),
                        size: LogicalSize::new(w, chrome_target_h).into(),
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

            //   window.open() / target="_blank" / OAuth           
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

            //   Actualizar barra de direcciones en React          ─
            // También actualiza loaded_urls para evitar recarga al volver a esta pestaña
            Event::UserEvent(UserEvent::PageLoadStarted { native_id, url }) => {
                // Filtrado cosmético específico del sitio (EasyList + uBlock).
                // El CSS estático del init script cubre lo genérico; esto añade
                // las reglas que sólo aplican a este dominio y los scriptlets
                // que neutralizan detectores de adblock.
                inject_cosmetic_filters(&content_views.borrow(), &native_id, &url);
            }

            Event::UserEvent(UserEvent::UpdateAddressBar { native_id, url }) => {
                loaded_urls.borrow_mut().insert(native_id, url.clone());
                let safe = url.replace('\\', "\\\\").replace('\'', "\\'");
                let _ = chrome_view.evaluate_script(&format!(
                    "window.dispatchEvent(new CustomEvent('orion:urlchange',\
                     {{detail:{{url:'{safe}'}}}}));"
                ));

                // Contador acumulado de bloqueos, para el escudo de la UI.
                let _ = chrome_view.evaluate_script(&format!(
                    "window.dispatchEvent(new CustomEvent('flux:adblock',\
                     {{detail:{{blocked:{}}}}}));",
                    ads_blocked_count()
                ));
            }

            _ => {}
        }
    });
}

// ── Tests ─────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn documento_principal_se_reconoce_pese_a_la_barra_final() {
        // WebView2 normaliza "https://sitio.com" a "https://sitio.com/".
        // Sin esto, la página principal se trataría como iframe y podría
        // bloquearse entera.
        assert!(same_document("https://sitio.com/", "https://sitio.com"));
        assert!(same_document("https://sitio.com", "https://sitio.com/"));
        assert!(same_document("https://sitio.com/a#seccion", "https://sitio.com/a"));
    }

    #[test]
    fn un_iframe_no_es_el_documento_principal() {
        assert!(!same_document(
            "https://ads.ejemplo.com/frame.html",
            "https://sitio.com/"
        ));
        // Sin documento conocido no se puede afirmar que sean el mismo.
        assert!(!same_document("https://sitio.com/", ""));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn los_tipos_de_recurso_se_mapean_al_vocabulario_de_easylist() {
        use webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_WEB_RESOURCE_CONTEXT as Ctx;
        // Muchas reglas sólo aplican a $script o $image; un mapeo incorrecto
        // haría que esas reglas nunca coincidan.
        assert_eq!(resource_type_name(Ctx(6)), "script");
        assert_eq!(resource_type_name(Ctx(3)), "image");
        assert_eq!(resource_type_name(Ctx(2)), "stylesheet");
        assert_eq!(resource_type_name(Ctx(1)), "sub_frame");
        assert_eq!(resource_type_name(Ctx(8)), "xmlhttprequest");
        assert_eq!(resource_type_name(Ctx(99)), "other");
    }
}
