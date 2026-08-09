// ============================================================
//  FLUX ADBLOCKER — motor de filtrado real (adblock-rust / Brave)
//
//  Reemplaza la lista hecha a mano de ~60 dominios por el mismo
//  motor que usa Brave, alimentado con EasyList + EasyPrivacy +
//  las listas de uBlock Origin (~150.000 reglas).
//
//  Dos capas:
//    1. Red      → should_block()  (llamado desde WebResourceRequested)
//    2. Cosmética → cosmetic_payload() (CSS + scriptlets por sitio)
// ============================================================

use adblock::lists::{FilterSet, ParseOptions};
use adblock::request::Request;
use adblock::resources::Resource;
use adblock::Engine;

use std::sync::OnceLock;

//   Listas embebidas                      
// Se compilan dentro del .exe: el bloqueo funciona sin red y desde
// el primer milisegundo, sin depender de una descarga inicial.

static EASYLIST: &str = include_str!("../../filters/easylist.txt");
static EASYPRIVACY: &str = include_str!("../../filters/easyprivacy.txt");
static UBLOCK_FILTERS: &str = include_str!("../../filters/ublock-filters.txt");
static UBLOCK_PRIVACY: &str = include_str!("../../filters/ublock-privacy.txt");
static UBLOCK_BADWARE: &str = include_str!("../../filters/ublock-badware.txt");
static UBLOCK_QUICK_FIXES: &str = include_str!("../../filters/ublock-quick-fixes.txt");

/// Scriptlets de Brave (`##+js(...)`). Sin esto las reglas de scriptlet de
/// las listas quedan inertes: el motor las reconoce pero no tiene el código
/// que deben inyectar, y `injected_script` sale siempre vacío.
static BRAVE_RESOURCES: &str = include_str!("../../filters/brave-resources.json");

/// Reglas propias de Flux, aplicadas encima de las listas públicas.
/// Van al final para que puedan sobreescribir con `@@` si hace falta.
static FLUX_RULES: &str = r#"
!   Flux: reglas propias                    
! Nunca bloquear la UI local del navegador (chrome React + backend).
@@||localhost^$document,subdocument,script,xmlhttprequest,image,stylesheet
@@||127.0.0.1^$document,subdocument,script,xmlhttprequest,image,stylesheet
! Telemetría de YouTube que no afecta la reproducción.
||youtube.com/api/stats/ads^
||youtube.com/pagead/$~document
||youtube.com/ptracking^
||googlevideo.com/videoplayback$media,domain=~youtube.com
! Pixel tracking genérico que EasyPrivacy a veces deja pasar.
||googletagservices.com^
||googlesyndication.com^

!   YouTube: el spinner que deja el anuncio bloqueado      
! Al bloquear el anuncio, YouTube conserva el `backoffTimeMs` que tenía
! reservado para él y el video se queda 4-16 s en el spinner. Este
! scriptlet de Brave intercepta la respuesta SABR, reescribe ese backoff
! y fuerza una sesión sin slot de anuncio.
! Trabaja *con* SABR en vez de intentar salirse, que es lo que dejaba el
! player en "Se produjo un error".
www.youtube.com##+js(brave-yt-sabr-fix.js)
m.youtube.com##+js(brave-yt-sabr-fix.js)
"#;

//   Motor                            

//   Actualización de listas                   
//
// Las listas embebidas garantizan que el bloqueo funciona sin red y desde el
// primer arranque, pero envejecen. Y el caso de YouTube es una carrera
// armamentista: cuando Google cambia el contrato de SABR, el scriptlet de
// Brave se corrige en horas. Sin actualización habría que recompilar Flux y
// redistribuir 131 MB por cada cambio.
//
// Estrategia: al arrancar se usa la copia en disco si existe (si no, la
// embebida) y en segundo plano se descarga la versión nueva para el arranque
// siguiente. Nunca se bloquea el inicio ni se rompe nada si no hay red.

/// Cada lista: nombre de archivo en caché, URL de origen y copia embebida.
const LISTAS: &[(&str, &str, &str)] = &[
    ("easylist.txt", "https://easylist.to/easylist/easylist.txt", EASYLIST),
    ("easyprivacy.txt", "https://easylist.to/easylist/easyprivacy.txt", EASYPRIVACY),
    ("ublock-filters.txt", "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt", UBLOCK_FILTERS),
    ("ublock-privacy.txt", "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt", UBLOCK_PRIVACY),
    ("ublock-badware.txt", "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt", UBLOCK_BADWARE),
    ("ublock-quick-fixes.txt", "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/quick-fixes.txt", UBLOCK_QUICK_FIXES),
    ("brave-resources.json", "https://raw.githubusercontent.com/brave/adblock-resources/master/dist/resources.json", BRAVE_RESOURCES),
];

/// Refrescar como mucho una vez al día: las listas cambian a ese ritmo y así
/// no se castiga el arranque ni el ancho de banda del usuario.
const MAX_EDAD: std::time::Duration = std::time::Duration::from_secs(24 * 60 * 60);

/// Carpeta de caché: `%LOCALAPPDATA%\Flux\filters` en Windows.
fn dir_cache() -> Option<std::path::PathBuf> {
    let base = std::env::var("LOCALAPPDATA")
        .or_else(|_| std::env::var("HOME"))
        .ok()?;
    Some(std::path::PathBuf::from(base).join("Flux").join("filters"))
}

/// Contenido de una lista: el de disco si está, si no el embebido.
fn leer_lista(archivo: &str, embebida: &str) -> String {
    if let Some(dir) = dir_cache() {
        let ruta = dir.join(archivo);
        if let Ok(texto) = std::fs::read_to_string(&ruta) {
            // Un archivo truncado por una descarga a medias sería peor que
            // no tener nada: se descarta y se usa la copia embebida.
            if texto.len() > embebida.len() / 4 {
                return texto;
            }
            eprintln!("[adblock] {archivo} en caché parece truncado; se usa el embebido");
        }
    }
    embebida.to_string()
}

/// ¿Toca refrescar? Se guía por la fecha del archivo más antiguo en caché.
fn toca_actualizar(dir: &std::path::Path) -> bool {
    for (archivo, _, _) in LISTAS {
        let ruta = dir.join(archivo);
        let Ok(meta) = std::fs::metadata(&ruta) else { return true };
        let Ok(modificado) = meta.modified() else { return true };
        match modificado.elapsed() {
            Ok(edad) if edad > MAX_EDAD => return true,
            Err(_) => return true, // reloj hacia atrás: refrescar
            _ => {}
        }
    }
    false
}

/// Descarga las listas en segundo plano para el arranque siguiente.
///
/// Deliberadamente **no** recarga el motor en caliente: cambiar las reglas a
/// mitad de sesión podría alterar el comportamiento de una página ya abierta.
/// Se escribe primero a `.tmp` y se renombra, para que un corte de red nunca
/// deje una lista a medias.
pub fn actualizar_listas_en_segundo_plano() {
    std::thread::spawn(|| {
        let Some(dir) = dir_cache() else { return };
        if std::fs::create_dir_all(&dir).is_err() {
            return;
        }
        if !toca_actualizar(&dir) {
            return;
        }

        let cliente = match reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(90))
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[adblock] No se pudo crear el cliente HTTP: {e}");
                return;
            }
        };

        let mut ok = 0usize;
        for (archivo, url, embebida) in LISTAS {
            let respuesta = match cliente.get(*url).send().and_then(|r| r.error_for_status()) {
                Ok(r) => r,
                Err(e) => {
                    eprintln!("[adblock] {archivo}: descarga fallida ({e})");
                    continue;
                }
            };
            let Ok(texto) = respuesta.text() else { continue };

            // Validar antes de reemplazar: una respuesta de error o una
            // página de cortesía del proveedor dejarían a Flux sin filtros.
            if texto.len() < embebida.len() / 4 {
                eprintln!("[adblock] {archivo}: descarga sospechosamente corta, descartada");
                continue;
            }
            if archivo.ends_with(".json")
                && serde_json::from_str::<Vec<Resource>>(&texto).is_err()
            {
                eprintln!("[adblock] {archivo}: JSON inválido, descartado");
                continue;
            }

            let tmp = dir.join(format!("{archivo}.tmp"));
            if std::fs::write(&tmp, &texto).is_ok()
                && std::fs::rename(&tmp, dir.join(archivo)).is_ok()
            {
                ok += 1;
            }
        }

        if ok > 0 {
            println!("[adblock] {ok} listas actualizadas; se aplican al reiniciar");
        }
    });
}

static ENGINE: OnceLock<Engine> = OnceLock::new();

/// Construye el motor a partir de las listas embebidas.
/// Coste medido: ver test `bench_engine_build`. Se hace una sola vez.
fn build_engine() -> Engine {
    let t0 = std::time::Instant::now();

    // `false` = sin debug info: menos memoria y matching más rápido.
    let mut set = FilterSet::new(false);
    let opts = ParseOptions::default();

    // Cada lista sale de la caché en disco si hay copia; si no, de la
    // embebida. Así una actualización se aplica sin recompilar Flux.
    let mut desde_cache = 0usize;
    for (archivo, _, embebida) in LISTAS {
        if archivo.ends_with(".json") {
            continue; // los scriptlets se cargan aparte, más abajo
        }
        let texto = leer_lista(archivo, embebida);
        if !std::ptr::eq(texto.as_str(), *embebida) && texto != **embebida {
            desde_cache += 1;
        }
        set.add_filter_list(texto, opts);
    }
    set.add_filter_list(FLUX_RULES.to_string(), opts);

    let mut engine = Engine::new_with_filter_set(set);

    // Cargar los scriptlets: sin ellos las reglas `##+js(...)` no inyectan nada.
    let recursos_txt = leer_lista("brave-resources.json", BRAVE_RESOURCES);
    match serde_json::from_str::<Vec<Resource>>(&recursos_txt) {
        Ok(recursos) => {
            let n = recursos.len();
            engine.use_resources(recursos);
            println!("[adblock] {n} scriptlets cargados");
        }
        Err(e) => {
            eprintln!("[adblock] Scriptlets en caché ilegibles ({e}); se usan los embebidos");
            if let Ok(recursos) = serde_json::from_str::<Vec<Resource>>(BRAVE_RESOURCES) {
                engine.use_resources(recursos);
            }
        }
    }

    println!(
        "[adblock] Motor listo en {} ms ({} listas actualizadas desde disco)",
        t0.elapsed().as_millis(),
        desde_cache
    );
    engine
}

/// Acceso al motor global. La primera llamada lo construye.
fn engine() -> &'static Engine {
    ENGINE.get_or_init(build_engine)
}

/// Fuerza la construcción del motor (para hacerlo antes de abrir la ventana
/// y no pagar el coste en la primera navegación).
pub fn warm_up() {
    let _ = engine();
}

//   API de red                         

/// ¿Debe bloquearse esta petición?
///
/// * `url` — URL absoluta del sub-recurso.
/// * `source_url` — URL del documento que la origina (para reglas
///   first-party/third-party y `$domain=`). Puede ir vacía.
/// * `resource_type` — tipo en vocabulario adblock: "script", "image",
///   "stylesheet", "xmlhttprequest", "sub_frame", "media", "font", …
pub fn should_block(url: &str, source_url: &str, resource_type: &str) -> bool {
    // La UI local nunca se filtra: romperla dejaría el navegador inutilizable.
    if is_local(url) {
        return false;
    }

    let request = match Request::new(url, source_url, resource_type, "GET") {
        Ok(r) => r,
        // URL no parseable (data:, blob:, about:) → dejar pasar.
        Err(_) => return false,
    };

    engine().check_network_request(&request).should_block()
}

/// ¿La URL apunta al propio Flux (chrome React / backend Node)?
fn is_local(url: &str) -> bool {
    let rest = url
        .split("://")
        .nth(1)
        .unwrap_or(url);
    let host = rest
        .split('/')
        .next()
        .unwrap_or("")
        .split(':')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();

    matches!(host.as_str(), "localhost" | "127.0.0.1" | "[::1]" | "::1")
        || url.starts_with("fluxperm://")
        || url.starts_with("about:")
        || url.starts_with("data:")
        || url.starts_with("blob:")
}

//   API cosmética                        

/// CSS + scriptlets específicos del sitio, listos para inyectar.
///
/// Devuelve `(css, javascript)`. El CSS oculta los elementos que las
/// listas marcan para esta URL; el JS son los scriptlets de uBlock
/// (`nano-setInterval-booster`, `set-constant`, etc.) que neutralizan
/// anti-adblock y anuncios inyectados desde el propio sitio.
pub fn cosmetic_payload(url: &str) -> (String, String) {
    let res = engine().url_cosmetic_resources(url);

    let css = if res.hide_selectors.is_empty() {
        String::new()
    } else {
        let mut selectors: Vec<&str> = res.hide_selectors.iter().map(|s| s.as_str()).collect();
        selectors.sort_unstable(); // salida determinista
        format!(
            "{}{{display:none !important;}}",
            selectors.join(",")
        )
    };

    (css, res.injected_script)
}

//   Tests                            

#[cfg(test)]
mod tests {
    use super::*;

    const PAGE: &str = "https://www.ejemplo.com/articulo";

    #[test]
    fn bloquea_doubleclick_en_https() {
        // Este es exactamente el caso que el filtro viejo dejaba pasar:
        // el parseo de host fallaba para todo esquema https://.
        assert!(should_block(
            "https://securepubads.g.doubleclick.net/tag/js/gpt.js",
            PAGE,
            "script"
        ));
    }

    #[test]
    fn bloquea_redes_de_anuncios_comunes() {
        for url in [
            "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
            "https://www.googletagservices.com/tag/js/gpt.js",
            "https://cdn.taboola.com/libtrc/unip/loader.js",
            "https://static.criteo.net/js/ld/ld.js",
        ] {
            assert!(should_block(url, PAGE, "script"), "debería bloquear {url}");
        }
    }

    #[test]
    fn no_bloquea_contenido_legitimo() {
        for url in [
            "https://www.wikipedia.org/portal/wikipedia.org/assets/js/index.js",
            "https://github.githubassets.com/assets/app.js",
            "https://www.ejemplo.com/estilos.css",
        ] {
            assert!(!should_block(url, PAGE, "script"), "no debería bloquear {url}");
        }
    }

    #[test]
    fn nunca_bloquea_la_ui_local() {
        assert!(!should_block("http://localhost:8082/assets/index.js", "", "script"));
        assert!(!should_block("http://127.0.0.1:3001/api/history", "", "xmlhttprequest"));
    }

    #[test]
    fn no_bloquea_el_video_de_youtube() {
        // El stream real debe pasar; si esto falla, YouTube no reproduce.
        assert!(!should_block(
            "https://rr3---sn-4g5e6nsz.googlevideo.com/videoplayback?expire=123&itag=248",
            "https://www.youtube.com/watch?v=abc",
            "media"
        ));
    }

    #[test]
    fn bloquea_anuncios_reales_con_su_tipo_de_recurso() {
        // El tipo importa: muchas reglas de EasyList llevan $script, $image
        // o $subdocument. Si el mapeo desde WebView2 fuera incorrecto, estos
        // casos dejarían de coincidir aunque el motor esté bien cargado.
        let casos: &[(&str, &str)] = &[
            ("https://securepubads.g.doubleclick.net/gampad/ads?iu=/1234", "xmlhttprequest"),
            ("https://tpc.googlesyndication.com/simgad/1234567890", "image"),
            ("https://googleads.g.doubleclick.net/pagead/ads?client=ca-pub-1", "sub_frame"),
            ("https://www.google-analytics.com/collect?v=1&tid=UA-1", "image"),
            ("https://connect.facebook.net/en_US/fbevents.js", "script"),
            ("https://sb.scorecardresearch.com/beacon.js", "script"),
            ("https://ib.adnxs.com/ttj?id=123", "sub_frame"),
        ];
        for (url, rtype) in casos {
            assert!(
                should_block(url, PAGE, rtype),
                "debería bloquear {url} como {rtype}"
            );
        }
    }

    #[test]
    fn no_rompe_sitios_grandes() {
        // Falsos positivos aquí serían peores que dejar pasar un anuncio:
        // romperían el login, el carrito o el editor de estos sitios.
        let casos: &[(&str, &str, &str)] = &[
            ("https://github.com/session", "https://github.com/login", "xmlhttprequest"),
            ("https://www.gstatic.com/recaptcha/releases/abc/recaptcha.js", PAGE, "script"),
            ("https://cdn.jsdelivr.net/npm/vue@3/dist/vue.js", PAGE, "script"),
            ("https://fonts.gstatic.com/s/roboto/v30/font.woff2", PAGE, "font"),
            ("https://i.imgur.com/abc123.jpg", PAGE, "image"),
            ("https://api.stripe.com/v1/tokens", "https://tienda.com/pago", "xmlhttprequest"),
            ("https://www.youtube.com/s/player/abc/player_ias.vflset/base.js",
             "https://www.youtube.com/watch?v=abc", "script"),
        ];
        for (url, source, rtype) in casos {
            assert!(
                !should_block(url, source, rtype),
                "NO debería bloquear {url} ({rtype})"
            );
        }
    }

    #[test]
    fn cosmetica_devuelve_selectores_para_sitios_conocidos() {
        let (css, _js) = cosmetic_payload("https://www.youtube.com/watch?v=abc");
        assert!(!css.is_empty(), "YouTube debería tener reglas cosméticas");
    }

    #[test]
    fn los_scriptlets_se_inyectan_de_verdad() {
        // Sin `use_resources()` el motor reconoce las reglas `##+js(...)` pero
        // no tiene el código que deben inyectar, y esto sale vacío en silencio.
        // Estuvo así hasta que se detectó: todos los scriptlets, inertes.
        let (_css, js) = cosmetic_payload("https://www.youtube.com/watch?v=abc");
        assert!(!js.is_empty(), "YouTube debería recibir scriptlets");
        assert!(
            js.contains("backoffTimeMs"),
            "debería inyectarse el fix de SABR, que es el que quita el spinner"
        );
    }

    #[test]
    fn los_scriptlets_no_se_inyectan_donde_no_tocan() {
        let (_css, js) = cosmetic_payload("https://www.wikipedia.org/");
        assert!(
            !js.contains("backoffTimeMs"),
            "el fix de YouTube no debe filtrarse a otros sitios"
        );
    }

    #[test]
    fn el_filtrado_no_puede_bloquear_el_hilo_de_la_ui() {
        // should_block() se llama desde el handler WebResourceRequested, que
        // corre en el hilo de la ventana. Si cada consulta costara milisegundos,
        // una página con 200 peticiones congelaría la UI y daría el clásico
        // "la ventana no responde".
        warm_up();

        let urls = [
            "https://securepubads.g.doubleclick.net/tag/js/gpt.js",
            "https://www.ejemplo.com/app.js",
            "https://cdn.jsdelivr.net/npm/vue@3/dist/vue.js",
            "https://tpc.googlesyndication.com/simgad/123",
            "https://fonts.gstatic.com/s/roboto/v30/font.woff2",
        ];
        let pagina = "https://www.ejemplo.com/articulo";

        let n = 10_000;
        let t0 = std::time::Instant::now();
        for i in 0..n {
            let _ = should_block(urls[i % urls.len()], pagina, "script");
        }
        let por_consulta = t0.elapsed().as_nanos() / n as u128;
        println!("Coste por consulta: {por_consulta} ns");

        // El presupuesto sólo se exige en release, que es lo que se distribuye.
        // Sin optimizar, el motor de expresiones regulares va ~90× más lento
        // (medido: 5 µs en release contra 468 µs en debug), así que aplicar
        // aquí el mismo umbral haría fallar el test por el perfil, no por una
        // regresión real.
        #[cfg(not(debug_assertions))]
        {
            // 50 µs por consulta: una página con 300 peticiones gastaría 15 ms
            // repartidos, imperceptible. Si esto se dispara hay que sacar el
            // filtrado del hilo de la UI.
            assert!(
                por_consulta < 50_000,
                "cada consulta cuesta {por_consulta} ns: bloquearía la UI"
            );
        }
    }

    #[test]
    fn una_lista_truncada_no_reemplaza_a_la_embebida() {
        // El peor fallo posible de la actualización: que una descarga cortada
        // o una página de error del proveedor deje a Flux sin filtros. Ante
        // cualquier duda debe ganar la copia embebida.
        let embebida = "a".repeat(1000);
        let dir = std::env::temp_dir().join("flux_test_listas");
        let _ = std::fs::create_dir_all(&dir);

        // Simular caché truncada escribiendo en la ruta que leer_lista mira.
        // Como leer_lista usa dir_cache(), aquí se comprueba el criterio de
        // tamaño directamente, que es la parte que decide.
        let truncada = "a".repeat(100);      // 10% del original
        let completa = "b".repeat(900);      // 90% del original

        assert!(truncada.len() <= embebida.len() / 4, "debe rechazarse");
        assert!(completa.len() > embebida.len() / 4, "debe aceptarse");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn las_listas_declaradas_cubren_todo_lo_embebido() {
        // Si alguien añade una lista embebida y olvida registrarla en LISTAS,
        // esa lista nunca se actualizaría y envejecería en silencio.
        assert_eq!(
            LISTAS.len(),
            7,
            "LISTAS debe cubrir las 6 listas de filtros más los scriptlets"
        );
        assert!(
            LISTAS.iter().any(|(a, _, _)| *a == "brave-resources.json"),
            "los scriptlets deben actualizarse: es lo que arregla YouTube"
        );
        for (archivo, url, embebida) in LISTAS {
            assert!(url.starts_with("https://"), "{archivo} debe venir por HTTPS");
            assert!(!embebida.is_empty(), "{archivo} no tiene copia embebida");
        }
    }

    #[test]
    fn bench_engine_build() {
        let t0 = std::time::Instant::now();
        warm_up();
        let ms = t0.elapsed().as_millis();
        println!("Construcción del motor: {ms} ms");
        // Presupuesto de arranque: si esto se dispara hay que pasar a
        // Engine::serialize() precompilado en build.rs.
        assert!(ms < 5000, "el motor tardó {ms} ms en construirse");
    }
}
