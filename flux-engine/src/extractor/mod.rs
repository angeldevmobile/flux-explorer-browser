// ============================================================
//  EXTRACTOR — Extrae metadata y contenido de un DOM arena
//
//  Dado un DOM ya parseado, recorre el árbol y extrae:
//  - título: <title> o <meta property="og:title">
//  - descripción: <meta name="description"> o <meta property="og:description">
//  - imagen: <meta property="og:image">
//  - texto principal: contenido de <h1>, <h2>, <h3>, <p>, <li>
// ============================================================

use crate::dom::{Arena, NodeData, NodeId};

/// Resultado de la extracción de una página web.
#[derive(Debug, Default)]
pub struct PageData {
    pub title:       Option<String>,
    pub description: Option<String>,
    pub image:       Option<String>,
    pub text:        String,
}

/// Extrae metadata y texto principal del DOM arena.
pub fn extract(dom: &Arena<'_>) -> PageData {
    let mut data = PageData::default();
    let mut text_parts: Vec<String> = Vec::new();

    extract_node(dom, dom.root(), &mut data, &mut text_parts);

    data.text = text_parts
        .into_iter()
        .filter(|s| !s.trim().is_empty())
        .collect::<Vec<_>>()
        .join(" ");

    data
}

fn extract_node<'a>(
    dom:        &'a Arena<'a>,
    id:         NodeId,
    data:       &mut PageData,
    text_parts: &mut Vec<String>,
) {
    let node = dom.get(id);

    match &node.data {
        NodeData::Document => {
            for &child in &node.children {
                extract_node(dom, child, data, text_parts);
            }
        }

        NodeData::Element { tag, attrs } => {
            match *tag {
                //  <title> 
                "title" => {
                    if data.title.is_none() {
                        let text = collect_text(dom, id);
                        if !text.is_empty() {
                            data.title = Some(text);
                        }
                    }
                }

                //<meta> 
                "meta" => {
                    let name     = find_attr(attrs, "name").unwrap_or("");
                    let property = find_attr(attrs, "property").unwrap_or("");
                    let content  = find_attr(attrs, "content").unwrap_or("");

                    if !content.is_empty() {
                        match (name, property) {
                            ("description", _) | (_, "og:description") => {
                                if data.description.is_none() {
                                    data.description = Some(content.to_string());
                                }
                            }
                            (_, "og:title") => {
                                if data.title.is_none() {
                                    data.title = Some(content.to_string());
                                }
                            }
                            (_, "og:image") => {
                                if data.image.is_none() {
                                    data.image = Some(content.to_string());
                                }
                            }
                            _ => {}
                        }
                    }
                }

                // head: bajamos para encontrar title y meta, sin extraer texto
                "head" => {
                    for &child in &node.children {
                        extract_node(dom, child, data, text_parts);
                    }
                }

                // Tags ignorados completamente 
                "script" | "style" | "noscript" | "svg" | "iframe" => {}

                //Contenido relevante 
                "h1" | "h2" | "h3" | "p" | "li" => {
                    let text = collect_text(dom, id);
                    if !text.trim().is_empty() {
                        text_parts.push(text);
                    }
                    // no bajamos: collect_text ya capturó el texto
                }

                _ => {
                    for &child in &node.children {
                        extract_node(dom, child, data, text_parts);
                    }
                }
            }
        }

        NodeData::Text(_) => {}
    }
}

/// Recoge todo el texto dentro de un nodo como String.
fn collect_text<'a>(dom: &'a Arena<'a>, id: NodeId) -> String {
    let mut out = String::new();
    collect_inner(dom, id, &mut out);
    out
}

fn collect_inner<'a>(dom: &'a Arena<'a>, id: NodeId, out: &mut String) {
    let node = dom.get(id);
    match &node.data {
        NodeData::Text(t) => {
            let t = t.trim();
            if !t.is_empty() {
                if !out.is_empty() { out.push(' '); }
                out.push_str(t);
            }
        }
        NodeData::Element { tag, .. } => {
            if matches!(*tag, "script" | "style" | "svg") { return; }
            for &child in &node.children {
                collect_inner(dom, child, out);
            }
        }
        NodeData::Document => {
            for &child in &node.children {
                collect_inner(dom, child, out);
            }
        }
    }
}

/// Busca un atributo por nombre (case-insensitive).
fn find_attr<'a>(attrs: &'a [(&str, &str)], name: &str) -> Option<&'a str> {
    attrs.iter()
        .find(|(k, _)| k.eq_ignore_ascii_case(name))
        .map(|(_, v)| *v)
}
