// ============================================================
//  API — Servidor HTTP con axum
//
//  Endpoint principal:
//    POST /process
//    Body: { "query": "rust programming", "urls": ["url1", "url2", ...] }
//    Response: { "results": [{ url, title, description, image, score }] }
//
//  El backend Node llama aquí después de obtener URLs de SearXNG.
//  Orion Engine procesa cada URL con su propio parser y las rankea.
// ============================================================

use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use std::collections::HashMap;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tower_http::cors::{Any, CorsLayer};
use std::sync::Arc;

use crate::fetcher;
use crate::ranker::{self, Document};

/// Estado compartido entre handlers.
pub struct AppState {
    pub client: Client,
}

/// Body del request POST /process
#[derive(Deserialize)]
pub struct ProcessRequest {
    pub query: String,
    pub urls:  Vec<String>,
}

/// Un resultado rankeado serializable a JSON.
#[derive(Serialize)]
pub struct ResultItem {
    pub url:         String,
    pub title:       String,
    pub description: String,
    pub image:       Option<String>,
    pub score:       f64,
}

/// Response de POST /process
#[derive(Serialize)]
pub struct ProcessResponse {
    pub query:   String,
    pub results: Vec<ResultItem>,
    pub engine:  String,
}

/// POST /process — pipeline principal de Orion Engine
async fn process(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ProcessRequest>,
) -> impl IntoResponse {
    if req.urls.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "Se requiere al menos una URL"
        }))).into_response();
    }

    // Limitar a 10 URLs por request para no saturar
    let urls: Vec<String> = req.urls.into_iter().take(10).collect();

    // Fetch paralelo de todas las URLs
    let fetch_tasks: Vec<_> = urls.iter().map(|url| {
        let client = state.client.clone();
        let url    = url.clone();
        tokio::spawn(async move {
            fetcher::fetch_and_extract(&client, &url).await
                .ok()
                .map(|(final_url, page, _security)| Document::from_page(final_url, page))
        })
    }).collect();

    // Esperar todos los fetches
    let mut documents: Vec<Document> = Vec::new();
    for task in fetch_tasks {
        if let Ok(Some(doc)) = task.await {
            documents.push(doc);
        }
    }

    // Rankear con BM25
    let ranked = ranker::rank(&req.query, documents);

    let results: Vec<ResultItem> = ranked.into_iter().map(|r| ResultItem {
        url:         r.url,
        title:       r.title,
        description: r.description,
        image:       r.image,
        score:       r.score,
    }).collect();

    let response = ProcessResponse {
        query:   req.query,
        results,
        engine:  "Orion Engine v0.1".to_string(),
    };

    (StatusCode::OK, Json(response)).into_response()
}

/// GET /render?url= — proxy del engine con SecurityLayer + base href injection
/// El browser carga este endpoint en el content_view en lugar de la URL directa.
/// Así la SecurityLayer (HTTPS upgrade, ad blocker, CSP) se aplica en todas las páginas.
async fn render_page(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> Response {
    let url = match params.get("url") {
        Some(u) if !u.is_empty() => u.clone(),
        _ => {
            return Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
                .body(Body::from("<html><body><h1>Falta el parámetro url</h1></body></html>"))
                .unwrap();
        }
    };

    eprintln!("[orion-render] Solicitando: {}", url);

    match fetcher::fetch_html(&state.client, &url).await {
        Ok((final_url, html)) => {
            eprintln!("[orion-render] OK: {}", final_url);
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
                .header("Access-Control-Allow-Origin", "*")
                .body(Body::from(html))
                .unwrap()
        }
        Err(fetcher::FetchError::Blocked(reason)) => {
            eprintln!("[orion-render] Bloqueado: {}", reason);
            Response::builder()
                .status(StatusCode::FORBIDDEN)
                .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
                .body(Body::from(format!(
                    "<html><body style='font-family:sans-serif;padding:2rem'>\
                     <h1>🛡️ Bloqueado por Orion</h1><p>{}</p></body></html>",
                    reason
                )))
                .unwrap()
        }
        Err(e) => {
            eprintln!("[orion-render] Error: {}", e);
            Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
                .body(Body::from(format!(
                    "<html><body style='font-family:sans-serif;padding:2rem'>\
                     <h1>Error cargando la página</h1><p>{}</p></body></html>",
                    e
                )))
                .unwrap()
        }
    }
}

/// GET /health — verificar que el engine está vivo
async fn health() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "engine": "Orion Engine",
        "version": env!("CARGO_PKG_VERSION")
    }))
}

/// Construye el router axum con todos los endpoints.
pub fn build_router(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin("http://localhost:3000".parse::<HeaderValue>().unwrap())
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any);

    Router::new()
        .route("/health", get(health))
        .route("/process", post(process))
        .route("/render", get(render_page))
        .layer(cors)
        .with_state(state)
}
