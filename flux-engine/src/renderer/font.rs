// ============================================================
//  FONT — Carga de fuente del sistema para fontdue
//
//  Busca la primera fuente disponible en rutas estándar del OS.
//  Fase 5: reemplazar por font-kit para selección completa.
// ============================================================

/// Rutas candidatas por plataforma, en orden de preferencia.
const FONT_PATHS: &[&str] = &[
    // Windows
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\calibri.ttf",
    r"C:\Windows\Fonts\tahoma.ttf",
    r"C:\Windows\Fonts\verdana.ttf",
    // macOS
    "/Library/Fonts/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    // Linux
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
    "/usr/share/fonts/ubuntu/Ubuntu-R.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
];

/// Carga los bytes de la primera fuente disponible en el sistema.
/// Permite override con la variable de entorno `ORION_FONT`.
pub fn load_system_font() -> Vec<u8> {
    // Override manual
    if let Ok(path) = std::env::var("ORION_FONT") {
        if let Ok(data) = std::fs::read(&path) {
            eprintln!("[orion-render] Font: {} (ORION_FONT)", path);
            return data;
        }
        eprintln!("[orion-render] WARN: ORION_FONT={} no encontrado", path);
    }

    for path in FONT_PATHS {
        if let Ok(data) = std::fs::read(path) {
            eprintln!("[orion-render] Font: {}", path);
            return data;
        }
    }

    eprintln!("[orion-render] ERROR: No se encontró ninguna fuente del sistema.");
    eprintln!("  Opciones:");
    eprintln!("    - Instala una fuente TTF en una de las rutas estándar");
    eprintln!("    - O: ORION_FONT=/ruta/a/fuente.ttf cargo run --bin orion-render");
    std::process::exit(1);
}

/// Construye un `fontdue::Font` desde bytes raw.
/// Panics si los bytes no son un .ttf válido.
pub fn build_font(data: &[u8]) -> fontdue::Font {
    fontdue::Font::from_bytes(data, fontdue::FontSettings::default())
        .expect("Error parseando la fuente TTF")
}
