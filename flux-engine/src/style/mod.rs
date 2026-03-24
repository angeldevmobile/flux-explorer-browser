// ============================================================
//  STYLE — Fase 2: CSS completo
//
//  Pipeline:
//    1. UA defaults por tag (ua.rs)
//    2. Herencia del padre (cascade.rs)
//    3. Reglas author: <style> + <link> (css.rs + cascade.rs)
//    4. Estilos inline style="" (cascade.rs)
//
//  Memoria:
//    - StyleMap = Vec<ComputedStyle> indexado por NodeId  (~120 B/nodo)
//    - Todo en stack, sin heap por nodo
//    - 1000 nodos ≈ 120 KB total
// ============================================================

pub mod css;
pub mod cascade;
pub mod ua;

use crate::dom::{Arena, NodeData, NodeId};
use cascade::{apply_declaration, inherit_from_parent, matches_selector, parse_inline_style};
use css::CssParser;

// ── Tipos de datos planos ────────────────────────────────────

/// Color RGBA — 4 bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Color {
    pub r: u8, pub g: u8, pub b: u8, pub a: u8,
}

impl Color {
    pub const BLACK:       Color = Color { r: 0,   g: 0,   b: 0,   a: 255 };
    pub const WHITE:       Color = Color { r: 255, g: 255, b: 255, a: 255 };
    pub const TRANSPARENT: Color = Color { r: 0,   g: 0,   b: 0,   a: 0   };
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Display {
    Block,
    Inline,
    InlineBlock,
    Flex,
    InlineFlex,
    Grid,
    None,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FontWeight { Normal, Bold }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FontStyleProp { Normal, Italic }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BorderStyleProp { None, Solid, Dashed, Dotted }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextAlign { Left, Center, Right, Justify }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Position { Static, Relative, Absolute, Fixed, Sticky }

/// Longitud resuelta o auto.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LengthOrAuto {
    Auto,
    Px(f32),
    Percent(f32),
}

impl LengthOrAuto {
    pub fn is_auto(&self) -> bool { matches!(self, LengthOrAuto::Auto) }
    pub fn px_or(&self, default: f32) -> f32 {
        match self { LengthOrAuto::Px(v) => *v, _ => default }
    }
}

// ── ComputedStyle ────────────────────────────────────────────
/// Estilos computados de un nodo — struct plano, cache-friendly.
/// ~120 bytes por nodo.
#[derive(Debug, Clone, Copy)]
pub struct ComputedStyle {
    // ── Display / visibilidad ──────────────────────────────
    pub display:   Display,
    pub visible:   bool,
    pub opacity:   f32,

    // ── Fuente ────────────────────────────────────────────
    pub font_size:   f32,
    pub font_weight: FontWeight,
    pub font_style:  FontStyleProp,
    pub line_height: f32,       // multiplicador (1.4 = 140%)
    pub letter_spacing: f32,    // px

    // ── Colores ───────────────────────────────────────────
    pub color:            Color,
    pub background_color: Color,

    // ── Box model — márgenes ──────────────────────────────
    pub margin_top:    f32,
    pub margin_right:  f32,
    pub margin_bottom: f32,
    pub margin_left:   f32,

    // ── Box model — padding ───────────────────────────────
    pub padding_top:    f32,
    pub padding_right:  f32,
    pub padding_bottom: f32,
    pub padding_left:   f32,

    // ── Dimensiones ───────────────────────────────────────
    pub width:      LengthOrAuto,
    pub height:     LengthOrAuto,
    pub min_width:  f32,
    pub min_height: f32,
    pub max_width:  Option<f32>,
    pub max_height: Option<f32>,

    // ── Border ────────────────────────────────────────────
    pub border_top_width:    f32,
    pub border_right_width:  f32,
    pub border_bottom_width: f32,
    pub border_left_width:   f32,
    pub border_color:        Color,
    pub border_style:        BorderStyleProp,
    pub border_radius:       f32,

    // ── Texto ─────────────────────────────────────────────
    pub text_align:                  TextAlign,
    pub text_decoration_underline:   bool,
    pub text_decoration_line_through: bool,

    // ── Posicionamiento ───────────────────────────────────
    pub position: Position,
    pub z_index:  i32,
    pub top:      LengthOrAuto,
    pub right:    LengthOrAuto,
    pub bottom:   LengthOrAuto,
    pub left:     LengthOrAuto,

    // ── Overflow ──────────────────────────────────────────
    pub overflow_hidden: bool,
}

impl ComputedStyle {
    // Helpers de conveniencia para el layout
    pub fn margin_h(&self) -> f32 { self.margin_left + self.margin_right }
    pub fn margin_v(&self) -> f32 { self.margin_top  + self.margin_bottom }
    pub fn padding_h(&self) -> f32 { self.padding_left + self.padding_right }
    pub fn padding_v(&self) -> f32 { self.padding_top  + self.padding_bottom }
    pub fn border_h(&self) -> f32 { self.border_left_width + self.border_right_width }
    pub fn border_v(&self) -> f32 { self.border_top_width  + self.border_bottom_width }
}

impl Default for ComputedStyle {
    fn default() -> Self {
        ComputedStyle {
            display:   Display::Inline,
            visible:   true,
            opacity:   1.0,
            font_size:     16.0,
            font_weight:   FontWeight::Normal,
            font_style:    FontStyleProp::Normal,
            line_height:   1.4,
            letter_spacing: 0.0,
            color:            Color::BLACK,
            background_color: Color::TRANSPARENT,
            margin_top:    0.0, margin_right:  0.0,
            margin_bottom: 0.0, margin_left:   0.0,
            padding_top:   0.0, padding_right: 0.0,
            padding_bottom:0.0, padding_left:  0.0,
            width:      LengthOrAuto::Auto,
            height:     LengthOrAuto::Auto,
            min_width:  0.0,
            min_height: 0.0,
            max_width:  None,
            max_height: None,
            border_top_width:    0.0, border_right_width:  0.0,
            border_bottom_width: 0.0, border_left_width:   0.0,
            border_color: Color::BLACK,
            border_style: BorderStyleProp::None,
            border_radius: 0.0,
            text_align:                   TextAlign::Left,
            text_decoration_underline:    false,
            text_decoration_line_through: false,
            position: Position::Static,
            z_index:  0,
            top:    LengthOrAuto::Auto,
            right:  LengthOrAuto::Auto,
            bottom: LengthOrAuto::Auto,
            left:   LengthOrAuto::Auto,
            overflow_hidden: false,
        }
    }
}

// ── StyleMap ─────────────────────────────────────────────────

pub struct StyleMap {
    styles: Vec<ComputedStyle>,
}

impl StyleMap {
    pub fn get(&self, id: NodeId) -> ComputedStyle {
        self.styles.get(id.0).copied().unwrap_or_default()
    }
}

// ── Resolve ──────────────────────────────────────────────────

/// Dimensiones del viewport para resolver vh/vw/%
pub struct Viewport { pub width: f32, pub height: f32 }

impl Viewport {
    pub fn new(w: f32, h: f32) -> Self { Viewport { width: w, height: h } }
}

/// Punto de entrada: resuelve todos los estilos del DOM.
/// Aplica UA → herencia → CSS author → inline.
pub fn resolve<'a>(dom: &Arena<'a>) -> StyleMap {
    resolve_with_viewport(dom, Viewport::new(800.0, 600.0))
}

pub fn resolve_with_viewport<'a>(dom: &Arena<'a>, vp: Viewport) -> StyleMap {
    let n = dom.len();
    let mut styles: Vec<ComputedStyle> = Vec::with_capacity(n);

    // ── Paso 1: recoger CSS de <style> y <link rel="stylesheet"> ──
    let author_css = collect_author_css(dom);
    let rules = CssParser::new(&author_css).parse_stylesheet();

    // ── Paso 2: recorrido en orden de inserción (pre-orden) ─────────
    // El arena está en pre-orden, así que el padre siempre tiene índice menor.
    for (node_idx, node) in dom.iter() {
        // Paso 2a: UA defaults
        let mut style = match &node.data {
            NodeData::Document       => { let mut s = ComputedStyle::default(); s.display = Display::Block; s }
            NodeData::Text(_)        => ComputedStyle::default(),
            NodeData::Element { tag, .. } => ua::ua_style(tag),
        };

        // Paso 2b: heredar del padre
        if let Some(parent_id) = node.parent {
            let parent_style = styles.get(parent_id.0).copied().unwrap_or_default();
            inherit_from_parent(&mut style, &parent_style);
        }

        // Paso 2c: aplicar reglas del author (ordenadas por especificidad)
        if let NodeData::Element { .. } = &node.data {
            // Recoger las reglas que coinciden, con su especificidad + orden
            let mut matching: Vec<(css::Specificity, usize, &css::Declaration)> = Vec::new();
            for (rule_idx, rule) in rules.iter().enumerate() {
                for sel in &rule.selectors {
                    if matches_selector(sel, node_idx, dom) {
                        let spec = sel.specificity();
                        for decl in &rule.declarations {
                            matching.push((spec, rule_idx, decl));
                        }
                        break; // un selector del grupo ya bastó
                    }
                }
            }
            // Ordenar: primero especificidad, luego orden fuente (estable)
            matching.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)));
            // Separar normales vs !important
            let em = style.font_size;
            for (_, _, decl) in matching.iter().filter(|(_, _, d)| !d.important) {
                apply_declaration(decl, &mut style, em, vp.width, vp.height);
            }
            for (_, _, decl) in matching.iter().filter(|(_, _, d)| d.important) {
                apply_declaration(decl, &mut style, em, vp.width, vp.height);
            }

            // Paso 2d: inline style=""
            if let NodeData::Element { attrs, .. } = &node.data {
                if let Some(inline) = attrs.iter().find(|(k, _)| *k == "style").map(|(_, v)| *v) {
                    let inline_decls = parse_inline_style(inline);
                    let em = style.font_size;
                    for decl in &inline_decls {
                        apply_declaration(decl, &mut style, em, vp.width, vp.height);
                    }
                }
            }
        }

        styles.push(style);
    }

    StyleMap { styles }
}

// ── Extracción de CSS del HTML ───────────────────────────────

/// Recorre el DOM y concatena el texto de todos los nodos <style>.
/// También detectaría <link rel="stylesheet"> (TODO: fetch externo).
fn collect_author_css<'a>(dom: &Arena<'a>) -> String {
    let mut css = String::new();
    for (_id, node) in dom.iter() {
        if let NodeData::Element { tag, attrs: _ } = &node.data {
            if *tag == "style" {
                // Texto dentro del <style>
                for &child_id in &node.children {
                    if let NodeData::Text(text) = &dom.get(child_id).data {
                        css.push_str(text);
                        css.push('\n');
                    }
                }
            }
            // <link rel="stylesheet" href="..."> → por ahora lo ignoramos,
            // cuando tengamos fetcher async lo incorporaremos aquí.
        }
    }
    css
}
