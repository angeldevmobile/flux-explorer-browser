// ============================================================
//  RANKER — Algoritmo BM25 simplificado
//
//  BM25 es el estándar de la industria para ranking de búsqueda
//
//  Dado un query y una lista de documentos (PageData + URL),
//  devuelve los documentos ordenados por relevancia.
//
//  Parámetros BM25:
//    k1 = 1.5  — saturación de frecuencia de término
//    b  = 0.75 — penalización por longitud de documento
// ============================================================

use crate::extractor::PageData;

const K1: f64 = 1.5;
const B:  f64 = 0.75;

/// Documento listo para rankear.
pub struct Document {
    pub url:         String,
    pub title:       Option<String>,
    pub description: Option<String>,
    pub image:       Option<String>,
    pub text:        String,
}

impl Document {
    pub fn from_page(url: String, page: PageData) -> Self {
        Document {
            url,
            title:       page.title,
            description: page.description,
            image:       page.image,
            text:        page.text,
        }
    }
}

/// Resultado rankeado listo para enviar al frontend.
#[derive(Debug)]
pub struct RankedResult {
    pub url:         String,
    pub title:       String,
    pub description: String,
    pub image:       Option<String>,
    pub score:       f64,
}

/// Rankea una lista de documentos contra un query usando BM25.
/// Devuelve los resultados ordenados de mayor a menor score.
pub fn rank(query: &str, docs: Vec<Document>) -> Vec<RankedResult> {
    if docs.is_empty() {
        return vec![];
    }

    let terms = tokenize_query(query);
    if terms.is_empty() {
        // Sin términos: devolver en orden original con score 0
        return docs.into_iter().map(|d| to_result(d, 0.0)).collect();
    }

    // Longitud promedio de documentos (en palabras)
    let avg_len: f64 = docs.iter()
        .map(|d| doc_length(d) as f64)
        .sum::<f64>() / docs.len() as f64;

    let n = docs.len() as f64;

    let mut scored: Vec<(f64, Document)> = docs.into_iter().map(|doc| {
        let score = bm25_score(&terms, &doc, n, avg_len);
        (score, doc)
    }).collect();

    // Ordenar de mayor a menor score
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

    scored.into_iter()
        .map(|(score, doc)| to_result(doc, score))
        .collect()
}

fn bm25_score(terms: &[String], doc: &Document, n: f64, avg_len: f64) -> f64 {
    let field = build_field(doc);
    let doc_len = field.split_whitespace().count() as f64;

    terms.iter().map(|term| {
        let tf = term_frequency(term, &field) as f64;
        if tf == 0.0 { return 0.0; }

        // IDF simplificado: log((N + 1) / (df + 0.5))
        // Como no tenemos corpus global, usamos df = 1 (el doc actual)
        let idf = ((n + 1.0) / 1.5_f64).ln().max(0.0);

        // Numerador BM25
        let numerator   = tf * (K1 + 1.0);
        let denominator = tf + K1 * (1.0 - B + B * doc_len / avg_len.max(1.0));

        // Boost si el término aparece en el título
        let title_boost = if title_contains_term(doc, term) { 2.0 } else { 1.0 };

        idf * (numerator / denominator) * title_boost
    }).sum()
}

/// Cuenta cuántas veces aparece un término en el texto.
fn term_frequency(term: &str, text: &str) -> usize {
    text.split_whitespace()
        .filter(|w| {
            let lower: String = w.to_lowercase();
            lower == term
        })
        .count()
}

/// Verifica si el término aparece en el título.
fn title_contains_term(doc: &Document, term: &str) -> bool {
    let title = doc.title.as_ref().map(|s| s.as_str()).unwrap_or("");
    let lower: String = title.to_lowercase();
    lower.contains(term)
}

/// Combina título + descripción + texto para calcular el score.
fn build_field(doc: &Document) -> String {
    let title = doc.title.as_ref().map(|s| s.as_str()).unwrap_or("");
    let desc  = doc.description.as_ref().map(|s| s.as_str()).unwrap_or("");
    format!("{title} {title} {desc} {}", doc.text) // título x2 = más peso
}

/// Total de palabras del documento.
fn doc_length(doc: &Document) -> usize {
    build_field(doc).split_whitespace().count()
}

/// Tokeniza el query: minúsculas, split por espacios, filtra vacíos.
fn tokenize_query(query: &str) -> Vec<String> {
    query.split_whitespace()
        .map(|w| w.to_lowercase())
        .filter(|w| w.len() > 1)
        .collect()
}

fn to_result(doc: Document, score: f64) -> RankedResult {
    RankedResult {
        title:       doc.title.unwrap_or_else(|| doc.url.clone()),
        description: doc.description.unwrap_or_default(),
        image:       doc.image,
        url:         doc.url,
        score,
    }
}
