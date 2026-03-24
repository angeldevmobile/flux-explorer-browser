// ============================================================
//  LAYOUT — Fase 3: block + inline formatting context
//
//  Cambios respecto a Fase 2:
//  - LayoutBox tiene `text_fragment: Option<String>`
//  - layout_block detecta contenido inline y delega a inline.rs
//  - Los hijos del bloque se agrupan en secuencias inline/block
//    antes de procesar (maneja contenido mixto)
// ============================================================

pub mod inline;

use crate::dom::{Arena, NodeData, NodeId};
use crate::style::{Display, LengthOrAuto, StyleMap};

/// Dimensiones del viewport.
#[derive(Debug, Clone, Copy)]
pub struct Dimensions {
    pub x:      f32,
    pub y:      f32,
    pub width:  f32,
    pub height: f32,
}

impl Dimensions {
    pub fn viewport(width: f32, height: f32) -> Self {
        Dimensions { x: 0.0, y: 0.0, width, height }
    }
}

/// Caja de layout para un nodo.
/// `text_fragment` contiene el fragmento de texto si es un nodo de texto
/// que fue dividido en líneas por el inline formatting context.
#[derive(Debug, Clone)]
pub struct LayoutBox {
    pub node:          NodeId,
    pub x:             f32,
    pub y:             f32,
    pub width:         f32,
    pub height:        f32,
    pub text_fragment: Option<String>,
}

/// Vec plano de cajas de layout.
pub struct LayoutTree {
    pub boxes: Vec<LayoutBox>,
}

impl LayoutTree {
    fn new(capacity: usize) -> Self {
        LayoutTree { boxes: Vec::with_capacity(capacity) }
    }
}

/// Ejecuta el layout completo desde el DOM y los estilos.
pub fn compute<'a>(dom: &Arena<'a>, styles: &StyleMap, viewport: Dimensions) -> LayoutTree {
    let mut tree = LayoutTree::new(dom.len());
    let mut cursor_y = viewport.y;
    layout_node(dom, styles, dom.root(), viewport, &mut cursor_y, &mut tree);
    tree
}

fn layout_node<'a>(
    dom:       &Arena<'a>,
    styles:    &StyleMap,
    id:        NodeId,
    container: Dimensions,
    cursor_y:  &mut f32,
    tree:      &mut LayoutTree,
) {
    let style = styles.get(id);
    if style.display == Display::None || !style.visible { return; }

    let node = dom.get(id);
    match &node.data {
        NodeData::Document => {
            let children: Vec<NodeId> = node.children.clone();
            layout_children(dom, styles, &children, container, cursor_y, tree);
        }
        NodeData::Text(_) => {
            // Los nodos Text son manejados por el inline context del padre.
            // Si llegan aquí es porque están directamente bajo Document → ignorar.
        }
        NodeData::Element { .. } => {
            match style.display {
                Display::Block | Display::Flex | Display::Grid => {
                    layout_block(dom, styles, id, container, cursor_y, tree);
                }
                Display::Inline | Display::InlineBlock | Display::InlineFlex => {
                    // Elemento inline suelto (sin contenedor block que lo agrupe)
                    // Lo tratamos como bloque con el contenedor actual.
                    layout_block(dom, styles, id, container, cursor_y, tree);
                }
                Display::None => {}
            }
        }
    }
}

/// Lógica principal de block layout.
fn layout_block<'a>(
    dom:       &Arena<'a>,
    styles:    &StyleMap,
    id:        NodeId,
    container: Dimensions,
    cursor_y:  &mut f32,
    tree:      &mut LayoutTree,
) {
    let style = styles.get(id);
    let node  = dom.get(id);

    let x = container.x + style.margin_left;
    let y = *cursor_y + style.margin_top;

    // Ancho del content box
    let content_width = match style.width {
        LengthOrAuto::Px(w)      => w,
        LengthOrAuto::Percent(p) => container.width * p / 100.0,
        LengthOrAuto::Auto       => (container.width
            - style.margin_left - style.margin_right
            - style.border_left_width - style.border_right_width
            - style.padding_left - style.padding_right
        ).max(0.0),
    };
    let content_width = content_width.max(style.min_width);
    let content_width = if let Some(max) = style.max_width { content_width.min(max) } else { content_width };

    let box_width = content_width
        + style.padding_left  + style.padding_right
        + style.border_left_width + style.border_right_width;

    let box_index = tree.boxes.len();
    tree.boxes.push(LayoutBox {
        node: id, x, y, width: box_width, height: 0.0, text_fragment: None,
    });

    // Contenedor de contenido (dentro del padding)
    let child_x = x + style.border_left_width + style.padding_left;
    let child_w = content_width;
    let content_y = y + style.border_top_width + style.padding_top;
    let mut child_cursor = content_y;

    let child_cont = Dimensions { x: child_x, y: content_y, width: child_w, height: 0.0 };

    let children: Vec<NodeId> = node.children.clone();
    layout_children(dom, styles, &children, child_cont, &mut child_cursor, tree);

    // Calcular altura final
    let content_h = (child_cursor - content_y).max(0.0);
    let resolved_h = match style.height {
        LengthOrAuto::Px(h) => h,
        _                   => content_h,
    };
    let resolved_h = resolved_h.max(style.min_height);
    let resolved_h = if let Some(max) = style.max_height { resolved_h.min(max) } else { resolved_h };

    let box_h = resolved_h
        + style.padding_top   + style.padding_bottom
        + style.border_top_width + style.border_bottom_width;

    tree.boxes[box_index].height = box_h;
    *cursor_y = y + box_h + style.margin_bottom;
}

/// Procesa una secuencia de hijos, agrupando los inline en contextos inline
/// y procesando los block individualmente.
fn layout_children<'a>(
    dom:       &Arena<'a>,
    styles:    &StyleMap,
    children:  &[NodeId],
    container: Dimensions,
    cursor_y:  &mut f32,
    tree:      &mut LayoutTree,
) {
    let mut i = 0;
    while i < children.len() {
        let child_id = children[i];
        let child    = dom.get(child_id);

        if is_inline_item(child_id, child, styles) {
            // Recoger todos los inline consecutivos
            let start = i;
            while i < children.len() && is_inline_item(children[i], dom.get(children[i]), styles) {
                i += 1;
            }
            let inline_group = &children[start..i];

            // Usar el text-align del contenedor (children están dentro del bloque padre)
            // El padre es el nodo que contiene `children`; si no tenemos acceso al padre
            // directo aquí, tomamos el text_align del primer hijo que tenga estilo.
            let text_align = inline_group.first()
                .and_then(|&cid| {
                    if matches!(dom.get(cid).data, NodeData::Text(_)) { None }
                    else { Some(styles.get(cid).text_align) }
                })
                .unwrap_or(crate::style::TextAlign::Left);

            // El parent_style para herencia: usar el del primer hijo con estilo
            let parent_style = inline_group.first()
                .map(|&cid| styles.get(cid))
                .unwrap_or_default();

            inline::layout_inline_group(
                dom, styles, inline_group, container,
                cursor_y, tree, text_align, &parent_style,
            );
        } else {
            // Nodo block normal
            let style = styles.get(child_id);
            if style.display != Display::None && style.visible {
                layout_block(dom, styles, child_id, container, cursor_y, tree);
            }
            i += 1;
        }
    }
}

/// Determina si un nodo es inline (texto o elemento con display inline).
fn is_inline_item<'a>(id: NodeId, node: &crate::dom::Node<'a>, styles: &StyleMap) -> bool {
    match &node.data {
        NodeData::Text(t)  => !t.trim().is_empty(),
        NodeData::Element { .. } => matches!(
            styles.get(id).display,
            Display::Inline | Display::InlineBlock | Display::InlineFlex
        ),
        NodeData::Document => false,
    }
}
