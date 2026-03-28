// build.rs — Prepara los recursos para el build de flux-browser.
//
// 1. Declara los cfg personalizados para silenciar warnings.
// 2. Genera ui_embed.rs en OUT_DIR (include_dir! solo si dist/ existe).
// 3. Copia yt-dlp.exe al directorio de salida.
// 4. Si bin/flux-backend.exe existe → activa cfg(has_backend).

use std::path::PathBuf;

fn main() {
    // Embeber icono como recurso Windows → taskbar, Alt+Tab, explorador
    {
        let mut res = winres::WindowsResource::new();
        res.set_icon("../assets/logo_flux.ico");
        if let Err(e) = res.compile() {
            println!("cargo:warning=winres: no se pudo embeber icono: {e}");
        }
    }

    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let bin_dir  = manifest.join("bin");
    let out_dir  = PathBuf::from(std::env::var("OUT_DIR").unwrap());

    // 1. Declarar cfgs personalizados (evita warnings de check-cfg)
    println!("cargo::rustc-check-cfg=cfg(has_dist)");
    println!("cargo::rustc-check-cfg=cfg(has_backend)");
    println!("cargo::rustc-check-cfg=cfg(has_ytdlp)");

    // OUT_DIR → target/<profile>/
    let profile_dir = out_dir
        .ancestors()
        .nth(3)
        .unwrap_or(&out_dir)
        .to_path_buf();

    // 2. UI React (dist/) → ui_embed.rs
    // Si dist/index.html existe:  genera static DIST con include_dir! y activa has_dist.
    // Si no existe:               genera un stub vacío (modo desarrollo con Vite).
    let dist_dir = manifest.join("..").join("dist");
    let ui_embed_path = out_dir.join("ui_embed.rs");
    println!("cargo:rerun-if-changed=../dist");

    if dist_dir.join("index.html").exists() {
        // Ruta absoluta con barras normales (requerido por include_dir!)
        let abs = dist_dir
            .canonicalize()
            .unwrap_or_else(|_| dist_dir.clone());
        let path_str = abs.to_string_lossy().replace('\\', "/");
        let code = format!(
            "pub static DIST: include_dir::Dir<'static> = include_dir::include_dir!(\"{}\");",
            path_str
        );
        std::fs::write(&ui_embed_path, code).expect("No se pudo escribir ui_embed.rs");
        println!("cargo:rustc-cfg=has_dist");
        println!("cargo:warning=UI React embebida desde {}", abs.display());
    } else {
        std::fs::write(&ui_embed_path, "// sin UI embebida — modo desarrollo\n")
            .expect("No se pudo escribir ui_embed.rs (stub)");
        println!(
            "cargo:warning=dist/ no encontrada — modo desarrollo (localhost:8082). \
             Ejecuta `npm run build` antes de `cargo build --release`."
        );
    }

    // 3. yt-dlp.exe
    let ytdlp_src = bin_dir.join("yt-dlp.exe");
    if ytdlp_src.exists() {
        println!("cargo:rustc-cfg=has_ytdlp");
        println!("cargo:warning=yt-dlp.exe embebido en el binario");
        println!("cargo:rerun-if-changed=bin/yt-dlp.exe");
    } else {
        println!(
            "cargo:warning=yt-dlp.exe no encontrado en {}. \
             Descargalo de https://github.com/yt-dlp/yt-dlp/releases",
            bin_dir.display()
        );
    }

    // 4. Backend embebido (bin/flux-backend.exe)
    // Compilar con: cd flux-backend && npx pkg . -o ../flux-engine/bin/flux-backend.exe
    let backend_src = bin_dir.join("flux-backend.exe");
    if backend_src.exists() {
        println!("cargo:rustc-cfg=has_backend");
        let mb = std::fs::metadata(&backend_src)
            .map(|m| m.len() / 1_048_576)
            .unwrap_or(0);
        println!("cargo:warning=flux-backend.exe embebido ({mb} MB)");
    } else {
        println!(
            "cargo:warning=bin/flux-backend.exe no encontrado. \
             Funcionalidad reducida (sin login/historial). \
             Para incluirlo: cd flux-backend && npx pkg . -o ../flux-engine/bin/flux-backend.exe"
        );
    }
    println!("cargo:rerun-if-changed=bin/flux-backend.exe");
}
