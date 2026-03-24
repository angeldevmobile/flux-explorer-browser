// ============================================================
//  ORION ENGINE — Servidor HTTP
//
//  Inicia el motor Orion como un servidor HTTP en el puerto 4000.
//  El backend Node (puerto 3000) llama a este servidor para
//  procesar y rankear resultados de búsqueda.
//
//  Endpoints:
//    GET  /health   — estado del engine
//    POST /process  — procesa URLs y devuelve resultados rankeados
// ============================================================

use std::sync::Arc;
use orion_engine::api::{build_router, AppState};
use orion_engine::fetcher::build_client;

#[tokio::main]
async fn main() {
    let state = Arc::new(AppState {
        client: build_client(),
    });

    let app = build_router(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:4000")
        .await
        .expect("No se pudo bindear el puerto 4000");

    println!("Orion Engine corriendo en http://localhost:4000");
    println!("   GET  /health  — estado del engine");
    println!("   POST /process — procesar y rankear URLs");

    axum::serve(listener, app)
        .await
        .expect("Error en el servidor");
}
