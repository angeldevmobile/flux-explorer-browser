// ============================================================
//  INLINE FORMATTING CONTEXT — Fase 3
//
//  Implementa word wrapping, line boxes y text-align.
//  Medición de texto: aproximación proporcional sans-serif.
//  (Fase 4 reemplazará esto con fontdue para métricas reales.)
//
//  Algoritmo:
//    1. Recoger átomos inline (palabras + elementos inline-block)
//    2. Greedy line breaking (más corto que optimal, pero O(n))
//    3. Aplicar text-align por línea
//    4. Emitir LayoutBox por fragmento de texto en cada línea
// ============================================================

use crate::dom::{Arena, NodeData, NodeId};
use crate::style::{Display, StyleMap, TextAlign, ComputedStyle};
use super::{LayoutBox, LayoutTree, Dimensions};

// ── Medición de texto ────────────────────────────────────────

/// Ancho aproximado de un carácter (fuente proporcional sans-serif).
#[inline]
pub fn char_width(ch: char, font_size: f32) -> f32 {
    let ratio: f32 = match ch {
        // Muy estrechos
        'i' | 'l' | '1' | '!' | '|' | 'j' => 0.28,
        ':' | ';' | '.' | ',' | '\'' | '"' => 0.28,
        // Estrechos
        'f' | 'r' | 't' => 0.38,
        // Anchos (antes del rango general)
        'm' | 'w' | 'M' | 'W' => 0.70,
        '-' | '–' | '(' | ')' | '[' | ']' => 0.40,
        // Normales
        'a'..='z' | 'A'..='Z' | '0'..='9' => 0.55,
        // Espacio
        ' ' | '\u{00A0}' => 0.30,
        '\t' => 0.30 * 4.0,
        // Resto (emoji, unicode, etc.)
        _ => 0.60,
    };
    font_size * ratio
}

/// Mide el ancho aproximado de un string.
pub fn measure_text(text: &str, font_size: f32) -> f32 {
    text.chars().map(|c| char_width(c, font_size)).sum()
}

// ── Átomo inline ─────────────────────────────────────────────

/// Unidad mínima de contenido inline para line-breaking.
/// Puede ser una palabra, un elemento inline-block atómico, o un <br>.
struct InlineAtom {
    node_id:    NodeId,
    text:       String,     // texto de la palabra (sin espacio final)
    width:      f32,        // ancho medido
    height:     f32,        // font_size * line_height
    font_size:  f32,
    space_w:    f32,        // ancho del espacio entre palabras
    is_break:   bool,       // forzar salto de línea (<br>)
}

// ── Recolección de átomos ────────────────────────────────────

/// Recorre el subárbol inline de `node_id` y rellena `atoms`.
/// `parent_style` es el estilo heredado del contenedor (para texto heredado).
fn collect_atoms<'a>(
    dom:          &'a Arena<'a>,
    styles:       &StyleMap,
    node_id:      NodeId,
    parent_style: &ComputedStyle,
    atoms:        &mut Vec<InlineAtom>,
) {
    let node = dom.get(node_id);
    match &node.data {
        NodeData::Text(raw) => {
            let text = raw.trim_matches(|c: char| c == '\n' || c == '\r');
            if text.trim().is_empty() { return; }

            let fs  = parent_style.font_size;
            let lh  = parent_style.line_height;
            let h   = fs * lh;
            let sp  = char_width(' ', fs);

            // Dividir en palabras preservando tokens de espacio como separadores
            let mut words = text.split_whitespace().peekable();
            while let Some(word) = words.next() {
                let w = measure_text(word, fs);
                let space_after = if words.peek().is_some() { sp } else { 0.0 };
                atoms.push(InlineAtom {
                    node_id,
                    text: word.to_string(),
                    width: w,
                    height: h,
                    font_size: fs,
                    space_w: space_after,
                    is_break: false,
                });
            }
        }

        NodeData::Element { tag, .. } => {
            // <br> → salto de línea forzado
            if *tag == "br" {
                atoms.push(InlineAtom {
                    node_id,
                    text: String::new(),
                    width: 0.0,
                    height: parent_style.font_size * parent_style.line_height,
                    font_size: parent_style.font_size,
                    space_w: 0.0,
                    is_break: true,
                });
                return;
            }

            let style = styles.get(node_id);

            // Elementos inline → recursar con su estilo
            if matches!(style.display, Display::Inline | Display::InlineFlex) {
                let children: Vec<NodeId> = node.children.clone();
                for child in children {
                    collect_atoms(dom, styles, child, &style, atoms);
                }
                return;
            }

            // InlineBlock → átomo atómico (no se fragmenta)
            if style.display == Display::InlineBlock {
                let h = style.font_size * style.line_height;
                atoms.push(InlineAtom {
                    node_id,
                    text: String::new(),   // el paint lo renderiza como bloque
                    width: style.width.px_or(64.0),
                    height: h,
                    font_size: style.font_size,
                    space_w: char_width(' ', style.font_size),
                    is_break: false,
                });
                return;
            }

            // Block dentro de inline → no debería ocurrir (contenido mixto)
            // Ignoramos por ahora (Fase 4 lo manejará con anonymous boxes)
        }

        NodeData::Document => {}
    }
}

// ── Línea ─────────────────────────────────────────────────────

/// Fragmento de una línea — varios átomos del mismo nodo fusionados.
struct LineFrag {
    node_id: NodeId,
    text:    String,
    x:       f32,
    width:   f32,
    // height y font_size se usan a través de `line.height` al emitir boxes
    #[allow(dead_code)] height:    f32,
    #[allow(dead_code)] font_size: f32,
}

/// Una línea de layout: uno o más fragmentos.
struct Line {
    frags:      Vec<LineFrag>,
    used_width: f32,   // suma de anchos de los fragmentos + espacios
    height:     f32,   // altura de la línea (mayor de los fragmentos)
}

impl Line {
    fn empty() -> Self {
        Line { frags: Vec::new(), used_width: 0.0, height: 0.0 }
    }
    fn is_empty(&self) -> bool { self.frags.is_empty() }
}

// ── Layout inline principal ──────────────────────────────────

/// Ejecuta el inline formatting context para los `children` de un bloque.
/// Emite LayoutBoxes en `tree` y avanza `cursor_y`.
pub fn layout_inline_group<'a>(
    dom:        &'a Arena<'a>,
    styles:     &StyleMap,
    children:   &[NodeId],
    container:  Dimensions,
    cursor_y:   &mut f32,
    tree:       &mut LayoutTree,
    text_align: TextAlign,
    parent_style: &ComputedStyle,
) {
    // ── 1. Recoger todos los átomos ──────────────────────────
    let mut atoms: Vec<InlineAtom> = Vec::new();
    for &child_id in children {
        collect_atoms(dom, styles, child_id, parent_style, &mut atoms);
    }
    if atoms.is_empty() { return; }

    // ── 2. Greedy line breaking ──────────────────────────────
    let avail_w = container.width;
    let mut lines: Vec<Line> = Vec::new();
    let mut cur_line = Line::empty();
    let mut cur_x    = 0.0f32; // relativo al container.x

    for atom in &atoms {
        // <br> → forzar nueva línea
        if atom.is_break {
            lines.push(std::mem::replace(&mut cur_line, Line::empty()));
            cur_x = 0.0;
            continue;
        }
        if atom.text.is_empty() { continue; }

        let atom_total = atom.width + atom.space_w;

        // Si el átomo no cabe Y ya hay algo en la línea → nueva línea
        if cur_x + atom.width > avail_w && !cur_line.is_empty() {
            lines.push(std::mem::replace(&mut cur_line, Line::empty()));
            cur_x = 0.0;
        }

        // Si el átomo tampoco cabe en una línea vacía → lo colocamos igual
        // (mejor overflow que perder contenido)

        // ── Fusionar con el frag anterior si es del mismo nodo ──
        let fused = if let Some(last) = cur_line.frags.last_mut() {
            if last.node_id == atom.node_id {
                last.text.push(' ');
                last.text.push_str(&atom.text);
                last.width += atom_total;
                true
            } else { false }
        } else { false };

        if !fused {
            cur_line.frags.push(LineFrag {
                node_id:   atom.node_id,
                text:      atom.text.clone(),
                x:         container.x + cur_x,
                width:     atom_total,
                height:    atom.height,
                font_size: atom.font_size,
            });
        }

        cur_x += atom_total;
        cur_line.used_width = cur_x;
        cur_line.height = cur_line.height.max(atom.height);
    }
    // Última línea
    if !cur_line.is_empty() { lines.push(cur_line); }

    // ── 3. Emitir LayoutBoxes ────────────────────────────────
    let mut line_y = *cursor_y;
    for line in &mut lines {
        // Offset de text-align
        let align_offset = match text_align {
            TextAlign::Left    => 0.0,
            TextAlign::Right   => (avail_w - line.used_width).max(0.0),
            TextAlign::Center  => ((avail_w - line.used_width) / 2.0).max(0.0),
            TextAlign::Justify => 0.0, // Fase 4
        };

        for frag in &mut line.frags {
            tree.boxes.push(LayoutBox {
                node:          frag.node_id,
                x:             frag.x + align_offset,
                y:             line_y,
                width:         frag.width,
                height:        line.height,
                text_fragment: Some(frag.text.clone()),
            });
        }
        line_y += line.height;
    }

    *cursor_y = line_y;
}
