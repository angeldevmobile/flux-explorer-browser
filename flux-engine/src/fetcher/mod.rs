// ============================================================
//  FETCHER — Descarga HTML de una URL y lo procesa con el
//            parser y extractor de Orion Engine
//
//  Flujo:
//    URL -> reqwest (HTTP) -> HTML String
//        -> tokenize -> parse -> DOM
//        -> extract -> PageData
// ============================================================

use reqwest::Client;
use crate::parsing;
use crate::extractor::{self, PageData};
use crate::security::{SecurityLayer, UrlDecision};

/// Error del fetcher.
#[derive(Debug)]
pub enum FetchError {
    Http(reqwest::Error),
    NotHtml,
    Blocked(String),
}

impl std::fmt::Display for FetchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FetchError::Http(e)     => write!(f, "HTTP error: {e}"),
            FetchError::NotHtml     => write!(f, "La respuesta no es HTML"),
            FetchError::Blocked(r)  => write!(f, "URL bloqueada: {r}"),
        }
    }
}

impl From<reqwest::Error> for FetchError {
    fn from(e: reqwest::Error) -> Self {
        FetchError::Http(e)
    }
}

/// Descarga una URL y extrae su PageData usando el motor Orion.
/// Devuelve la URL final, los datos de la página y el SecurityLayer
/// configurado con el CSP que reportó el servidor.
pub async fn fetch_and_extract(
    client: &Client,
    url: &str,
) -> Result<(String, PageData, SecurityLayer), FetchError> {
    // ── Fase 6: Seguridad — verificar URL antes de conectar ───
    let mut security = SecurityLayer::new();
    let fetch_url = match security.check_url(url) {
        UrlDecision::Allow          => url.to_string(),
        UrlDecision::Upgrade(https) => {
            eprintln!("[orion-security] HTTP→HTTPS upgrade: {}", https);
            https
        }
        UrlDecision::Block(reason) => {
            return Err(FetchError::Blocked(format!("{:?}", reason)));
        }
    };

    let response = client
        .get(&fetch_url)
        .header("User-Agent", "OrionBrowser/1.0")
        .header("Accept", "text/html,application/xhtml+xml")
        .send()
        .await?;

    let final_url = response.url().to_string();
    let headers   = response.headers();

    // ── Fase 6: CSP del servidor ──────────────────────────────
    // Leer Content-Security-Policy (y la variante Report-Only como fallback)
    let csp_header = headers
        .get("content-security-policy")
        .or_else(|| headers.get("content-security-policy-report-only"))
        .and_then(|v| v.to_str().ok());

    if let Some(csp) = csp_header {
        eprintln!("[orion-security] CSP recibido: {}", csp);
        security.set_csp(csp);
    }

    // Verificar que sea HTML
    let content_type = headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if !content_type.contains("text/html") && !content_type.is_empty() {
        return Err(FetchError::NotHtml);
    }

    let html = response.text().await?;

    // Pipeline Orion: tokenize -> parse -> extract
    let tokens = parsing::tokenizer::tokenize(&html);
    let dom     = parsing::parser::parse(&tokens, &html);
    let data    = extractor::extract(&dom);

    Ok((final_url, data, security))
}

/// Descarga una URL con el SecurityLayer y devuelve (url_final, html_procesado).
/// Inyecta <base href> para que URLs relativas funcionen en el WebView.
pub async fn fetch_html(
    client: &Client,
    url: &str,
) -> Result<(String, String), FetchError> {
    let mut security = SecurityLayer::new();
    let fetch_url = match security.check_url(url) {
        UrlDecision::Allow          => url.to_string(),
        UrlDecision::Upgrade(https) => {
            eprintln!("[orion-security] HTTP→HTTPS upgrade: {}", https);
            https
        }
        UrlDecision::Block(reason) => {
            return Err(FetchError::Blocked(format!("{:?}", reason)));
        }
    };

    let response = client
        .get(&fetch_url)
        .header("User-Agent", "Mozilla/5.0 (compatible; OrionBrowser/1.0)")
        .header("Accept", "text/html,application/xhtml+xml,*/*")
        .send()
        .await?;

    let final_url = response.url().to_string();
    let headers   = response.headers();

    if let Some(csp) = headers
        .get("content-security-policy")
        .and_then(|v| v.to_str().ok())
    {
        security.set_csp(csp);
    }

    let content_type = headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if !content_type.contains("text/html") && !content_type.is_empty() {
        return Err(FetchError::NotHtml);
    }

    let html = response.text().await?;
    let html_with_base = inject_base_href(&html, &final_url);

    Ok((final_url, html_with_base))
}

/// Inyecta <base href="{url}"> justo después de <head> para que
/// los recursos relativos (CSS, imágenes, scripts) se resuelvan correctamente
/// cuando WebView2 renderiza el HTML devuelto por /render.
fn inject_base_href(html: &str, base_url: &str) -> String {
    let base_tag = format!(r#"<base href="{}">"#, base_url);
    let lower = html.to_lowercase();

    // Buscar <head> y meter el base tag justo después
    if let Some(pos) = lower.find("<head>") {
        let insert_at = pos + 6;
        let mut out = String::with_capacity(html.len() + base_tag.len());
        out.push_str(&html[..insert_at]);
        out.push_str(&base_tag);
        out.push_str(&html[insert_at..]);
        return out;
    }

    // Fallback: insertar al inicio del documento
    format!("{}{}", base_tag, html)
}

/// Construye un cliente HTTP reutilizable con timeouts razonables.
pub fn build_client() -> Client {
    Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .expect("Error creando cliente HTTP")
}
