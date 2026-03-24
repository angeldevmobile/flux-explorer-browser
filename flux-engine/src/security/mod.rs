// ============================================================
//  ORION SECURITY — Fase 6
//
//  Ventaja real sobre Chrome/WebView2:
//    - CSP enforcement antes de ejecutar JS
//    - HTTPS-only mode + HSTS preload
//    - Ad/tracker blocking en el fetcher
//    - JS sandbox vía QuickJS memory limits (en js/mod.rs)
//
//  Pipeline de seguridad (llamado desde fetcher):
//    URL → check_url() → (bloqueada | permitida | upgraded)
// ============================================================

// ── CSP ───────────────────────────────────────────────────────

/// Directivas CSP relevantes para el motor Orion.
#[derive(Debug, Default, Clone)]
pub struct CspPolicy {
    pub script_src:  Vec<String>,  // script-src / default-src
    pub style_src:   Vec<String>,  // style-src
    pub img_src:     Vec<String>,  // img-src
    pub connect_src: Vec<String>,  // connect-src (fetch)
    pub frame_src:   Vec<String>,  // frame-src / child-src
    pub block_all_mixed: bool,     // block-all-mixed-content
    pub upgrade_insecure: bool,    // upgrade-insecure-requests
}

impl CspPolicy {
    /// Parsea una cabecera CSP: "script-src 'self'; img-src *"
    pub fn parse(header: &str) -> Self {
        let mut p = CspPolicy::default();
        for directive in header.split(';') {
            let mut parts = directive.trim().splitn(2, ' ');
            let name  = parts.next().unwrap_or("").trim().to_lowercase();
            let value = parts.next().unwrap_or("").trim();
            let sources: Vec<String> = value.split_whitespace()
                .map(|s| s.to_string()).collect();
            match name.as_str() {
                "script-src"  => p.script_src  = sources,
                "style-src"   => p.style_src   = sources,
                "img-src"     => p.img_src      = sources,
                "connect-src" => p.connect_src  = sources,
                "frame-src" | "child-src" => p.frame_src = sources,
                "default-src" => {
                    if p.script_src.is_empty()  { p.script_src  = sources.clone(); }
                    if p.connect_src.is_empty() { p.connect_src = sources.clone(); }
                    if p.img_src.is_empty()     { p.img_src     = sources.clone(); }
                }
                "block-all-mixed-content"    => p.block_all_mixed   = true,
                "upgrade-insecure-requests"  => p.upgrade_insecure  = true,
                _ => {}
            }
        }
        p
    }

    /// ¿Permite ejecutar scripts inline?
    pub fn allows_inline_scripts(&self) -> bool {
        self.script_src.is_empty()
            || self.script_src.iter().any(|s| s == "'unsafe-inline'" || s == "*")
    }

    /// ¿Permite conectar a `url`?
    pub fn allows_connect(&self, url: &str) -> bool {
        if self.connect_src.is_empty() { return true; }
        self.connect_src.iter().any(|s| {
            s == "*" || s == "'self'" || url.contains(s.trim_matches('\''))
        })
    }
}

// ── HSTS Preload ──────────────────────────────────────────────

/// Dominios que siempre deben usar HTTPS (subset del preload list).
/// Fuente: hstspreload.org — solo dominios de nivel medio/alto tráfico.
const HSTS_PRELOAD: &[&str] = &[
    "google.com", "www.google.com",
    "youtube.com", "www.youtube.com",
    "facebook.com", "www.facebook.com",
    "twitter.com", "www.twitter.com", "x.com",
    "instagram.com", "www.instagram.com",
    "linkedin.com", "www.linkedin.com",
    "github.com", "www.github.com",
    "wikipedia.org", "en.wikipedia.org", "es.wikipedia.org",
    "reddit.com", "www.reddit.com",
    "amazon.com", "www.amazon.com",
    "apple.com", "www.apple.com",
    "microsoft.com", "www.microsoft.com",
    "mozilla.org", "www.mozilla.org",
    "cloudflare.com", "www.cloudflare.com",
    "stackoverflow.com",
    "npmjs.com", "crates.io", "docs.rs",
    "rust-lang.org", "www.rust-lang.org",
];

/// ¿Debe este dominio upgradear HTTP → HTTPS?
pub fn hsts_should_upgrade(domain: &str) -> bool {
    let d = domain.trim_start_matches("www.");
    HSTS_PRELOAD.iter().any(|&h| h == domain || h.trim_start_matches("www.") == d)
}

// ── Ad / Tracker Blocker ──────────────────────────────────────

/// Dominios de tracking y publicidad conocidos (subset EasyList/EasyPrivacy).
const BLOCKED_DOMAINS: &[&str] = &[
    // Google Ads
    "googleadservices.com", "googlesyndication.com", "doubleclick.net",
    "googletagmanager.com", "googletagservices.com", "google-analytics.com",
    "adservice.google.com",
    // Facebook tracking
    "connect.facebook.net", "facebook.com/tr", "graph.facebook.com",
    // Amazon Ads
    "amazon-adsystem.com", "amazonproduct.com",
    // Microsoft
    "bat.bing.com", "clarity.ms", "msads.net",
    // Analytics
    "analytics.twitter.com", "static.ads-twitter.com",
    "pixel.quantserve.com", "stats.g.doubleclick.net",
    "mc.yandex.ru", "counter.ok.ru",
    // Ad networks
    "adnxs.com", "adsrvr.org", "rubiconproject.com", "pubmatic.com",
    "openx.net", "casalemedia.com", "criteo.com", "criteo.net",
    "scorecardresearch.com", "omtrdc.net",
    "outbrain.com", "taboola.com", "revcontent.com",
    "moatads.com", "adsafeprotected.com",
    // CDN de tracking
    "cdn.branch.io", "app.link", "branchster.com",
    "newrelic.com", "nr-data.net",
    "sentry.io", "bugsnag.com",  // telemetría (puede desactivarse)
];

/// ¿Debe bloquearse esta URL por ser un tracker o ad?
pub fn is_blocked(url: &str) -> bool {
    let url_lower = url.to_lowercase();
    BLOCKED_DOMAINS.iter().any(|&blocked| url_lower.contains(blocked))
}

/// Razón por la que se bloqueó una URL.
#[derive(Debug, PartialEq)]
pub enum BlockReason {
    AdTracker,
    MixedContent,
    CspViolation,
}

// ── SecurityLayer ─────────────────────────────────────────────

/// Resultado del chequeo de seguridad para una URL.
#[derive(Debug)]
pub enum UrlDecision {
    /// Permitir la URL sin cambios.
    Allow,
    /// Redirigir a la URL HTTPS correspondiente.
    Upgrade(String),
    /// Bloquear la URL.
    Block(BlockReason),
}

/// Capa de seguridad central — aplica todas las políticas.
pub struct SecurityLayer {
    pub csp:          Option<CspPolicy>,
    pub https_only:   bool,
    pub block_ads:    bool,
}

impl SecurityLayer {
    pub fn new() -> Self {
        SecurityLayer {
            csp:        None,
            https_only: true,   // HTTPS-only por defecto
            block_ads:  true,   // Bloqueo de ads/trackers por defecto
        }
    }

    /// Aplica todas las políticas de seguridad a una URL.
    pub fn check_url(&self, url: &str) -> UrlDecision {
        // 1. Bloqueo de ads/trackers
        if self.block_ads && is_blocked(url) {
            return UrlDecision::Block(BlockReason::AdTracker);
        }

        // 2. HTTPS-only: bloquear HTTP (excepto localhost/127.0.0.1)
        if self.https_only && url.starts_with("http://") {
            let no_http = &url[7..];
            if !no_http.starts_with("localhost") && !no_http.starts_with("127.0.0.1") {
                // Intentar upgrade a HTTPS
                let https_url = format!("https://{}", no_http);
                return UrlDecision::Upgrade(https_url);
            }
        }

        // 3. HSTS preload
        if url.starts_with("http://") {
            if let Some(domain) = extract_domain(url) {
                if hsts_should_upgrade(&domain) {
                    let https_url = url.replacen("http://", "https://", 1);
                    return UrlDecision::Upgrade(https_url);
                }
            }
        }

        // 4. CSP connect-src
        if let Some(csp) = &self.csp {
            if !csp.allows_connect(url) {
                return UrlDecision::Block(BlockReason::CspViolation);
            }
        }

        UrlDecision::Allow
    }

    /// Carga política CSP desde un string de cabecera.
    pub fn set_csp(&mut self, header: &str) {
        self.csp = Some(CspPolicy::parse(header));
    }

    /// ¿Permite ejecutar scripts inline según la CSP activa?
    pub fn allows_inline_scripts(&self) -> bool {
        self.csp.as_ref().map_or(true, |p| p.allows_inline_scripts())
    }
}

impl Default for SecurityLayer {
    fn default() -> Self { Self::new() }
}

/// Extrae el dominio de una URL (sin protocolo ni path).
fn extract_domain(url: &str) -> Option<String> {
    let no_proto = url.split("://").nth(1)?;
    let domain = no_proto.split('/').next()?;
    Some(domain.to_string())
}

// ── Tests ─────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_blocker_google_analytics() {
        assert!(is_blocked("https://www.google-analytics.com/analytics.js"));
        assert!(is_blocked("https://googletagmanager.com/gtm.js"));
        assert!(!is_blocked("https://www.example.com/page"));
    }

    #[test]
    fn test_hsts_upgrade() {
        assert!(hsts_should_upgrade("github.com"));
        assert!(hsts_should_upgrade("www.google.com"));
        assert!(!hsts_should_upgrade("mysite.example"));
    }

    #[test]
    fn test_csp_parse_script_src() {
        let p = CspPolicy::parse("script-src 'self' 'unsafe-inline'; img-src *");
        assert!(p.allows_inline_scripts());
        assert_eq!(p.img_src, vec!["*"]);
    }

    #[test]
    fn test_security_layer_upgrade() {
        let layer = SecurityLayer::new();
        match layer.check_url("http://github.com/rust-lang") {
            UrlDecision::Upgrade(u) => assert!(u.starts_with("https://")),
            other => panic!("Expected Upgrade, got {:?}", other),
        }
    }

    #[test]
    fn test_security_layer_block_tracker() {
        let layer = SecurityLayer::new();
        match layer.check_url("https://doubleclick.net/ads") {
            UrlDecision::Block(BlockReason::AdTracker) => {}
            other => panic!("Expected Block(AdTracker), got {:?}", other),
        }
    }
}
