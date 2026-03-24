// ============================================================
//  PARSER — Convierte tokens en un DOM arena
//
//  Estrategia de memoria:
//  - DOM = Vec<Node> flat (arena allocator manual)
//  - Hijos = Vec<NodeId> (índices, no punteros)
//  - Sin Box<Node> ni Rc/Arc → sin overhead de indirección
// ============================================================

use crate::dom::{Arena, NodeId, NodeData};
use crate::parsing::tokenizer::Token;

/// Parsea la lista de tokens y retorna el DOM arena.
/// Los &str de los nodos apuntan al HTML original → 0 copias.
pub fn parse<'a>(tokens: &[Token<'a>], _src: &'a str) -> Arena<'a> {
    let mut arena = Arena::new();

    // Raíz virtual que contiene todo el documento
    let root = arena.create_node(NodeData::Document);

    // Stack de NodeId = árbol de apertura actual
    let mut stack: Vec<NodeId> = Vec::with_capacity(32);
    stack.push(root);

    for token in tokens {
        match token {
            Token::Doctype | Token::Comment | Token::Eof => { /* ignorar */ }

            Token::StartTag { name, attrs, self_close } => {
                let data = NodeData::Element {
                    tag:   name,
                    attrs: attrs.iter().map(|a| (a.name, a.value)).collect(),
                };
                let parent = *stack.last().unwrap();
                let node   = arena.create_node(data);
                arena.append_child(parent, node);

                // void elements no abren un frame en el stack
                if !self_close && !is_void_element(name) {
                    stack.push(node);
                }
            }

            Token::EndTag { name } => {
                // pop hasta encontrar la etiqueta coincidente
                if let Some(pos) = stack.iter().rposition(|&id| {
                    matches!(arena.get(id).data, NodeData::Element { tag, .. } if tag == *name)
                }) {
                    stack.truncate(pos);
                }
                // si no encontramos el tag → HTML malformado, ignorar
            }

            Token::Text(text) => {
                if let Some(&parent) = stack.last() {
                    let node = arena.create_node(NodeData::Text(text));
                    arena.append_child(parent, node);
                }
            }
        }
    }

    arena
}

/// Elementos HTML que no tienen etiqueta de cierre (void elements).
#[inline]
fn is_void_element(tag: &str) -> bool {
    matches!(tag, "area" | "base" | "br" | "col" | "embed" | "hr" |
                  "img" | "input" | "link" | "meta" | "param" |
                  "source" | "track" | "wbr")
}
