// ============================================================
//  CASCADE — Especificidad + cascade + herencia
//
//  Orden de aplicación (menor → mayor prioridad):
//  1. UA defaults (de ua.rs)
//  2. Reglas author por especificidad y orden
//  3. Estilos inline (style="")
//  4. !important (sobrescribe todo)
//
//  Herencia: solo propiedades heredables (color, font-*, etc.)
// ============================================================

use crate::dom::{Arena, NodeData, NodeId};
use crate::style::{
    ComputedStyle, Display, FontWeight, FontStyleProp,
    BorderStyleProp, TextAlign, LengthOrAuto, Color,
};
use crate::style::css::{
    Selector, SimpleSelector, Declaration, Value, Unit,
    CssParser,
};

// ── Matching ─────────────────────────────────────────────────

/// Comprueba si un selector coincide con el nodo `id` del DOM.
pub fn matches_selector(sel: &Selector, id: NodeId, dom: &Arena) -> bool {
    match sel {
        Selector::Simple(s) => matches_simple(s, id, dom),
        Selector::Descendant { ancestor: anc, descendant: desc } => {
            if !matches_selector(desc, id, dom) { return false; }
            let mut pid = dom.get(id).parent;
            while let Some(p) = pid {
                if matches_selector(anc, p, dom) { return true; }
                pid = dom.get(p).parent;
            }
            false
        }
    }
}

fn matches_simple(sel: &SimpleSelector, id: NodeId, dom: &Arena) -> bool {
    let node = dom.get(id);
    let (tag, attrs) = match &node.data {
        NodeData::Element { tag, attrs } => (*tag, attrs.as_slice()),
        _ => return false,
    };

    if sel.universal && sel.tag.is_none() && sel.id.is_none() && sel.classes.is_empty() {
        return true;
    }
    if let Some(t) = &sel.tag {
        if tag != t.as_str() { return false; }
    }
    if let Some(sel_id) = &sel.id {
        let elem_id = attrs.iter().find(|(k, _)| *k == "id").map(|(_, v)| *v).unwrap_or("");
        if elem_id != sel_id.as_str() { return false; }
    }
    for cls in &sel.classes {
        let class_attr = attrs.iter().find(|(k, _)| *k == "class").map(|(_, v)| *v).unwrap_or("");
        if !class_attr.split_whitespace().any(|c| c == cls.as_str()) { return false; }
    }
    true
}

// ── Aplicar declaración ──────────────────────────────────────

/// Aplica una declaración CSS a un `ComputedStyle`.
/// `em` = font-size del elemento padre (contexto de herencia).
/// `vw/vh` = dimensiones del viewport.
pub fn apply_declaration(
    decl:  &Declaration,
    style: &mut ComputedStyle,
    em:    f32,
    vw:    f32,
    vh:    f32,
) {
    match decl.property.as_str() {
        "display" => {
            if let Value::Keyword(kw) = &decl.value {
                style.display = match kw.as_str() {
                    "block"        => Display::Block,
                    "inline"       => Display::Inline,
                    "inline-block" => Display::InlineBlock,
                    "flex"         => Display::Flex,
                    "inline-flex"  => Display::InlineFlex,
                    "grid"         => Display::Grid,
                    "none"         => Display::None,
                    _              => style.display,
                };
            }
        }

        // ── Font ────────────────────────────────────────────
        "font-size" => {
            if let Some(v) = resolve_length(&decl.value, em, vw, vh) { style.font_size = v; }
        }
        "font-weight" => {
            style.font_weight = match &decl.value {
                Value::Keyword(k) => match k.as_str() {
                    "bold" | "bolder" => FontWeight::Bold,
                    _                 => FontWeight::Normal,
                },
                Value::Number(n) => if *n >= 600.0 { FontWeight::Bold } else { FontWeight::Normal },
                _ => style.font_weight,
            };
        }
        "font-style" => {
            if let Value::Keyword(k) = &decl.value {
                style.font_style = match k.as_str() {
                    "italic" | "oblique" => FontStyleProp::Italic,
                    _                    => FontStyleProp::Normal,
                };
            }
        }

        // ── Colores ─────────────────────────────────────────
        "color" => {
            if let Value::Color(c) = &decl.value { style.color = *c; }
        }
        "background" | "background-color" => {
            match &decl.value {
                Value::Color(c) => style.background_color = *c,
                Value::Keyword(k) if k == "transparent" => {
                    style.background_color = Color::TRANSPARENT;
                }
                // "background" shorthand puede tener url() — ignorar por ahora
                _ => {}
            }
        }

        // ── Margin shorthand ─────────────────────────────────
        "margin" => {
            let vals = multi_lengths(&decl.value, em, vw, vh);
            apply_box4(&vals,
                &mut style.margin_top,
                &mut style.margin_right,
                &mut style.margin_bottom,
                &mut style.margin_left,
            );
        }
        "margin-top"    => { if let Some(v) = resolve_auto_length(&decl.value, em, vw, vh) { style.margin_top    = v; } }
        "margin-right"  => { if let Some(v) = resolve_auto_length(&decl.value, em, vw, vh) { style.margin_right  = v; } }
        "margin-bottom" => { if let Some(v) = resolve_auto_length(&decl.value, em, vw, vh) { style.margin_bottom = v; } }
        "margin-left"   => { if let Some(v) = resolve_auto_length(&decl.value, em, vw, vh) { style.margin_left   = v; } }

        // ── Padding shorthand ────────────────────────────────
        "padding" => {
            let vals = multi_lengths(&decl.value, em, vw, vh);
            apply_box4(&vals,
                &mut style.padding_top,
                &mut style.padding_right,
                &mut style.padding_bottom,
                &mut style.padding_left,
            );
        }
        "padding-top"    => { if let Some(v) = resolve_length(&decl.value, em, vw, vh) { style.padding_top    = v; } }
        "padding-right"  => { if let Some(v) = resolve_length(&decl.value, em, vw, vh) { style.padding_right  = v; } }
        "padding-bottom" => { if let Some(v) = resolve_length(&decl.value, em, vw, vh) { style.padding_bottom = v; } }
        "padding-left"   => { if let Some(v) = resolve_length(&decl.value, em, vw, vh) { style.padding_left   = v; } }

        // ── Dimensiones ──────────────────────────────────────
        "width"      => { style.width  = resolve_dimension(&decl.value, em, vw, vh); }
        "height"     => { style.height = resolve_dimension(&decl.value, em, vw, vh); }
        "min-width"  => { if let Some(v) = resolve_length(&decl.value, em, vw, vh) { style.min_width  = v; } }
        "min-height" => { if let Some(v) = resolve_length(&decl.value, em, vw, vh) { style.min_height = v; } }
        "max-width"  => { if let Some(v) = resolve_length(&decl.value, em, vw, vh) { style.max_width  = Some(v); } }
        "max-height" => { if let Some(v) = resolve_length(&decl.value, em, vw, vh) { style.max_height = Some(v); } }

        // ── Border ───────────────────────────────────────────
        "border-width" | "border-top-width" | "border-right-width"
        | "border-bottom-width" | "border-left-width" => {
            if let Some(v) = resolve_length(&decl.value, em, vw, vh) {
                // Aplicamos a todos los lados por ahora (shorthand completo = Fase 3)
                style.border_top_width    = v;
                style.border_right_width  = v;
                style.border_bottom_width = v;
                style.border_left_width   = v;
            }
        }
        "border-color" => {
            if let Value::Color(c) = &decl.value { style.border_color = *c; }
        }
        "border-style" => {
            if let Value::Keyword(k) = &decl.value {
                style.border_style = match k.as_str() {
                    "solid"  => BorderStyleProp::Solid,
                    "dashed" => BorderStyleProp::Dashed,
                    "dotted" => BorderStyleProp::Dotted,
                    _        => BorderStyleProp::None,
                };
            }
        }
        "border-radius" => {
            if let Some(v) = resolve_length(&decl.value, em, vw, vh) {
                style.border_radius = v;
            }
        }

        // ── Texto ────────────────────────────────────────────
        "text-align" => {
            if let Value::Keyword(k) = &decl.value {
                style.text_align = match k.as_str() {
                    "left"    => TextAlign::Left,
                    "center"  => TextAlign::Center,
                    "right"   => TextAlign::Right,
                    "justify" => TextAlign::Justify,
                    _         => style.text_align,
                };
            }
        }
        "line-height" => {
            match &decl.value {
                Value::Number(n) => style.line_height = *n,
                Value::Length(n, Unit::Px) => {
                    if style.font_size > 0.0 { style.line_height = n / style.font_size; }
                }
                other => if let Some(v) = resolve_length(other, em, vw, vh) {
                    if style.font_size > 0.0 { style.line_height = v / style.font_size; }
                }
            }
        }
        "letter-spacing" => {
            if let Some(v) = resolve_length(&decl.value, em, vw, vh) { style.letter_spacing = v; }
        }
        "text-decoration" => {
            if let Value::Keyword(k) = &decl.value {
                style.text_decoration_underline = k.contains("underline");
                style.text_decoration_line_through = k.contains("line-through");
            }
        }

        // ── Visibilidad ──────────────────────────────────────
        "opacity" => {
            if let Value::Number(n) = &decl.value { style.opacity = n.clamp(0.0, 1.0); }
        }
        "visibility" => {
            if let Value::Keyword(k) = &decl.value {
                style.visible = k != "hidden" && k != "collapse";
            }
        }

        // ── Posicionamiento ──────────────────────────────────
        "position" => {
            if let Value::Keyword(k) = &decl.value {
                style.position = match k.as_str() {
                    "relative" => crate::style::Position::Relative,
                    "absolute" => crate::style::Position::Absolute,
                    "fixed"    => crate::style::Position::Fixed,
                    "sticky"   => crate::style::Position::Sticky,
                    _          => crate::style::Position::Static,
                };
            }
        }
        "z-index" => {
            if let Value::Number(n) = &decl.value { style.z_index = *n as i32; }
        }
        "top"    => { style.top    = resolve_dimension(&decl.value, em, vw, vh); }
        "right"  => { style.right  = resolve_dimension(&decl.value, em, vw, vh); }
        "bottom" => { style.bottom = resolve_dimension(&decl.value, em, vw, vh); }
        "left"   => { style.left   = resolve_dimension(&decl.value, em, vw, vh); }

        // ── Overflow ─────────────────────────────────────────
        "overflow" | "overflow-x" | "overflow-y" => {
            if let Value::Keyword(k) = &decl.value {
                style.overflow_hidden = matches!(k.as_str(), "hidden" | "clip");
            }
        }

        _ => {} // Propiedad desconocida — ignorar
    }
}

// ── Herencia ─────────────────────────────────────────────────

/// Lista de propiedades que se heredan del padre al hijo.
pub fn inherit_from_parent(child: &mut ComputedStyle, parent: &ComputedStyle) {
    // Propiedades heredables según el estándar CSS
    child.color                    = parent.color;
    child.font_size                = parent.font_size;
    child.font_weight              = parent.font_weight;
    child.font_style               = parent.font_style;
    child.line_height              = parent.line_height;
    child.letter_spacing           = parent.letter_spacing;
    child.text_align               = parent.text_align;
    child.text_decoration_underline      = parent.text_decoration_underline;
    child.text_decoration_line_through   = parent.text_decoration_line_through;
    child.visible                  = parent.visible;
    // opacity NO es heredable (se propaga visualmente pero no en el valor computed)
    // background NO es heredable
}

// ── Utilitarios de longitud ──────────────────────────────────

pub fn resolve_length(val: &Value, em: f32, vw: f32, vh: f32) -> Option<f32> {
    match val {
        Value::Length(n, Unit::Px)      => Some(*n),
        Value::Length(n, Unit::Em)      => Some(n * em),
        Value::Length(n, Unit::Rem)     => Some(n * 16.0),
        Value::Length(n, Unit::Vh)      => Some(n * vh / 100.0),
        Value::Length(n, Unit::Vw)      => Some(n * vw / 100.0),
        Value::Length(_n, Unit::Percent) => None, // requiere contexto del padre
        Value::Number(n) if *n == 0.0   => Some(0.0),
        _ => None,
    }
}

pub fn resolve_length_percent(val: &Value, em: f32, vw: f32, vh: f32, parent_size: f32) -> Option<f32> {
    if let Value::Length(n, Unit::Percent) = val {
        return Some(n * parent_size / 100.0);
    }
    resolve_length(val, em, vw, vh)
}

fn resolve_auto_length(val: &Value, em: f32, vw: f32, vh: f32) -> Option<f32> {
    if matches!(val, Value::Auto) { return Some(0.0); }
    resolve_length(val, em, vw, vh)
}

fn resolve_dimension(val: &Value, em: f32, vw: f32, vh: f32) -> LengthOrAuto {
    match val {
        Value::Auto  => LengthOrAuto::Auto,
        Value::None_ => LengthOrAuto::Auto,
        Value::Length(n, Unit::Percent) => LengthOrAuto::Percent(*n),
        other => resolve_length(other, em, vw, vh)
            .map(LengthOrAuto::Px)
            .unwrap_or(LengthOrAuto::Auto),
    }
}

/// Extrae 1-4 longitudes desde un Value::Multi o un valor único.
/// Sigue la convención CSS de shorthand: 1→all, 2→tb+lr, 3→t+lr+b, 4→t+r+b+l
fn multi_lengths(val: &Value, em: f32, vw: f32, vh: f32) -> [Option<f32>; 4] {
    let vals: Vec<Option<f32>> = match val {
        Value::Multi(items) => items.iter()
            .map(|v| resolve_auto_length(v, em, vw, vh))
            .collect(),
        single => vec![resolve_auto_length(single, em, vw, vh)],
    };

    match vals.len() {
        0 => [None; 4],
        1 => [vals[0]; 4],
        2 => [vals[0], vals[1], vals[0], vals[1]],
        3 => [vals[0], vals[1], vals[2], vals[1]],
        _ => [vals[0], vals[1], vals[2], vals[3]],
    }
}

fn apply_box4(parts: &[Option<f32>; 4], top: &mut f32, right: &mut f32, bottom: &mut f32, left: &mut f32) {
    if let Some(v) = parts[0] { *top    = v; }
    if let Some(v) = parts[1] { *right  = v; }
    if let Some(v) = parts[2] { *bottom = v; }
    if let Some(v) = parts[3] { *left   = v; }
}

// ── Parsear atributo style="" ────────────────────────────────

/// Parsea `style="color: red; font-size: 16px"` → Vec<Declaration>.
pub fn parse_inline_style(raw: &str) -> Vec<Declaration> {
    // Envolvemos en un selector ficticio para reutilizar el parser
    let fake_css = format!("*{{{}}}", raw);
    let rules = CssParser::new(&fake_css).parse_stylesheet();
    rules.into_iter()
        .flat_map(|r| r.declarations)
        .collect()
}
