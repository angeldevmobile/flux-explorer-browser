// ============================================================
//  PAINT — Construcción de la Display List (Fase 3)
//
//  Cambio respecto a Fase 2:
//  - DisplayCommand::DrawText usa String (owned) en lugar de &str,
//    lo que permite textos de fragmentos inline sin lifetime.
//  - Usa text_fragment de LayoutBox cuando está disponible.
// ============================================================

use crate::dom::{Arena, NodeData};
use crate::layout::LayoutTree;
use crate::style::{BorderStyleProp, Color, StyleMap};

/// Rectángulo de posición/tamaño.
#[derive(Debug, Clone, Copy)]
pub struct Rect {
    pub x:      f32,
    pub y:      f32,
    pub width:  f32,
    pub height: f32,
}

/// Comando atómico de dibujo — sin lifetime, texto owned.
#[derive(Debug)]
pub enum DisplayCommand {
    FillRect   { rect: Rect, color: Color },
    StrokeRect { rect: Rect, color: Color, width: f32 },
    DrawText   {
        text:      String,
        x:         f32,
        y:         f32,
        font_size: f32,
        color:     Color,
        /// NodeId del elemento padre — usado por JS para mutaciones de texto.
        elem_id:   usize,
    },
}

/// Construye la display list desde el layout tree, DOM y estilos.
pub fn build_display_list(
    layout: &LayoutTree,
    dom:    &Arena<'_>,
    styles: &StyleMap,
) -> Vec<DisplayCommand> {
    let mut list = Vec::with_capacity(layout.boxes.len() * 2);

    for lb in &layout.boxes {
        let node  = dom.get(lb.node);
        let style = styles.get(lb.node);
        let rect  = Rect { x: lb.x, y: lb.y, width: lb.width, height: lb.height };

        match &node.data {
            NodeData::Element { .. } => {
                // Fondo
                if style.background_color.a > 0 {
                    list.push(DisplayCommand::FillRect { rect, color: style.background_color });
                }
                // Borde
                if style.border_style != BorderStyleProp::None && style.border_top_width > 0.0 {
                    list.push(DisplayCommand::StrokeRect {
                        rect,
                        color: style.border_color,
                        width: style.border_top_width,
                    });
                }
            }

            NodeData::Text(raw) => {
                // Usar el fragmento si el inline context lo fraccionó;
                // si no, usar el texto completo del nodo.
                let text = lb.text_fragment.clone()
                    .unwrap_or_else(|| raw.trim().to_string());

                // elem_id = NodeId del elemento padre (para mutaciones JS)
                let elem_id = dom.get(lb.node).parent.map(|p| p.0).unwrap_or(0);

                if !text.is_empty() {
                    list.push(DisplayCommand::DrawText {
                        text,
                        x:         lb.x,
                        y:         lb.y,
                        font_size: style.font_size,
                        color:     style.color,
                        elem_id,
                    });
                }
            }

            NodeData::Document => {}
        }
    }

    list
}
