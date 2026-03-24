// build.rs — Copia yt-dlp.exe al directorio de salida al compilar orion-browser.
// Así queda junto al ejecutable en target/debug/ y target/release/

use std::path::PathBuf;

fn main() {
    // Ruta del ejecutable bundleado
    let bin_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin");
    let ytdlp_src = bin_dir.join("yt-dlp.exe");

    if ytdlp_src.exists() {
        // OUT_DIR apunta a target/<profile>/build/…, pero el exe va a target/<profile>/
        // Obtenemos target/<profile>/ subiendo desde OUT_DIR
        let out_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap());
        // out_dir = target/<profile>/build/orion-engine-xxx/out
        // Subimos 3 niveles para llegar a target/<profile>/
        let profile_dir = out_dir
            .ancestors()
            .nth(3)
            .unwrap_or(&out_dir)
            .to_path_buf();

        let ytdlp_dst = profile_dir.join("yt-dlp.exe");

        if let Err(e) = std::fs::copy(&ytdlp_src, &ytdlp_dst) {
            println!("cargo:warning=No se pudo copiar yt-dlp.exe: {e}");
        } else {
            println!("cargo:warning=yt-dlp.exe copiado a {}", ytdlp_dst.display());
        }

        // Re-ejecutar build.rs si yt-dlp.exe cambia
        println!("cargo:rerun-if-changed=bin/yt-dlp.exe");
    } else {
        println!(
            "cargo:warning=yt-dlp.exe no encontrado en {}. \
             Descárgalo de https://github.com/yt-dlp/yt-dlp/releases \
             y colócalo en orion-engine/bin/yt-dlp.exe",
            bin_dir.display()
        );
    }
}
