// ============================================================
//  UA STYLESHEET — Estilos por defecto del navegador (user-agent)
//
//  Equivalente al CSS base que aplica cualquier navegador antes
//  de los estilos del autor.  Se aplica con especificidad (0,0,1).
// ============================================================

use crate::style::{ComputedStyle, Display, FontWeight, TextAlign};

/// Retorna los estilos UA para un tag dado.
/// Estos son los valores iniciales antes de aplicar el CSS del autor.
pub fn ua_style(tag: &str) -> ComputedStyle {
    let base = ComputedStyle::default();
    match tag {
        // ── Elementos de bloque ──────────────────────────────
        "html" => ComputedStyle {
            display: Display::Block,
            font_size: 16.0,
            ..base
        },
        "body" => ComputedStyle {
            display: Display::Block,
            margin_top: 8.0, margin_right: 8.0,
            margin_bottom: 8.0, margin_left: 8.0,
            ..base
        },
        "div" | "section" | "article" | "main" | "aside" |
        "header" | "footer" | "nav" | "figure" | "figcaption" |
        "details" | "summary" | "dialog" | "address" => ComputedStyle {
            display: Display::Block,
            ..base
        },

        // ── Encabezados ──────────────────────────────────────
        "h1" => ComputedStyle {
            display:       Display::Block,
            font_size:     32.0,
            font_weight:   FontWeight::Bold,
            margin_top:    21.44,
            margin_bottom: 21.44,
            ..base
        },
        "h2" => ComputedStyle {
            display:       Display::Block,
            font_size:     24.0,
            font_weight:   FontWeight::Bold,
            margin_top:    19.92,
            margin_bottom: 19.92,
            ..base
        },
        "h3" => ComputedStyle {
            display:       Display::Block,
            font_size:     18.72,
            font_weight:   FontWeight::Bold,
            margin_top:    18.72,
            margin_bottom: 18.72,
            ..base
        },
        "h4" => ComputedStyle {
            display:       Display::Block,
            font_size:     16.0,
            font_weight:   FontWeight::Bold,
            margin_top:    21.44,
            margin_bottom: 21.44,
            ..base
        },
        "h5" => ComputedStyle {
            display:       Display::Block,
            font_size:     13.28,
            font_weight:   FontWeight::Bold,
            margin_top:    22.16,
            margin_bottom: 22.16,
            ..base
        },
        "h6" => ComputedStyle {
            display:       Display::Block,
            font_size:     10.72,
            font_weight:   FontWeight::Bold,
            margin_top:    24.96,
            margin_bottom: 24.96,
            ..base
        },

        // ── Párrafo y texto ──────────────────────────────────
        "p" => ComputedStyle {
            display:       Display::Block,
            margin_top:    16.0,
            margin_bottom: 16.0,
            ..base
        },
        "blockquote" => ComputedStyle {
            display:       Display::Block,
            margin_top:    16.0,
            margin_bottom: 16.0,
            margin_left:   40.0,
            margin_right:  40.0,
            ..base
        },
        "pre" => ComputedStyle {
            display:       Display::Block,
            font_size:     13.33,
            margin_top:    16.0,
            margin_bottom: 16.0,
            ..base
        },

        // ── Listas ───────────────────────────────────────────
        "ul" | "menu" => ComputedStyle {
            display:       Display::Block,
            margin_top:    16.0,
            margin_bottom: 16.0,
            padding_left:  40.0,
            ..base
        },
        "ol" => ComputedStyle {
            display:       Display::Block,
            margin_top:    16.0,
            margin_bottom: 16.0,
            padding_left:  40.0,
            ..base
        },
        "li" => ComputedStyle {
            display: Display::Block,
            ..base
        },
        "dt" => ComputedStyle {
            display:     Display::Block,
            font_weight: FontWeight::Bold,
            ..base
        },
        "dd" => ComputedStyle {
            display:     Display::Block,
            margin_left: 40.0,
            ..base
        },
        "dl" => ComputedStyle {
            display:       Display::Block,
            margin_top:    16.0,
            margin_bottom: 16.0,
            ..base
        },

        // ── Tabla ────────────────────────────────────────────
        "table" => ComputedStyle {
            display:          Display::Block,
            border_top_width: 0.0,
            ..base
        },
        "tr" | "thead" | "tbody" | "tfoot" => ComputedStyle {
            display: Display::Block,
            ..base
        },
        "th" => ComputedStyle {
            display:     Display::Block,
            font_weight: FontWeight::Bold,
            text_align:  TextAlign::Center,
            ..base
        },
        "td" => ComputedStyle {
            display: Display::Block,
            ..base
        },
        "caption" => ComputedStyle {
            display:     Display::Block,
            text_align:  TextAlign::Center,
            ..base
        },

        // ── Inline ───────────────────────────────────────────
        "span" | "a" | "abbr" | "acronym" | "cite" | "dfn" |
        "kbd" | "samp" | "var" | "time" | "mark" | "wbr" => ComputedStyle {
            display: Display::Inline,
            ..base
        },
        "strong" | "b" => ComputedStyle {
            display:     Display::Inline,
            font_weight: FontWeight::Bold,
            ..base
        },
        "em" | "i" => ComputedStyle {
            display:    Display::Inline,
            font_style: crate::style::FontStyleProp::Italic,
            ..base
        },
        "small" => ComputedStyle {
            display:   Display::Inline,
            font_size: 13.33,
            ..base
        },
        "big" => ComputedStyle {
            display:   Display::Inline,
            font_size: 18.72,
            ..base
        },
        "code" | "tt" => ComputedStyle {
            display:   Display::Inline,
            font_size: 13.33,
            ..base
        },
        "sub" | "sup" => ComputedStyle {
            display:   Display::Inline,
            font_size: 12.0,
            ..base
        },
        "u" | "ins" => ComputedStyle {
            display:                    Display::Inline,
            text_decoration_underline:  true,
            ..base
        },
        "s" | "strike" | "del" => ComputedStyle {
            display:                        Display::Inline,
            text_decoration_line_through:   true,
            ..base
        },

        // ── Formularios ──────────────────────────────────────
        "form" => ComputedStyle { display: Display::Block, ..base },
        "fieldset" => ComputedStyle {
            display:          Display::Block,
            margin_left:      2.0, margin_right: 2.0,
            padding_top:      8.75, padding_bottom: 8.75,
            padding_left:     10.0, padding_right: 10.0,
            border_top_width: 2.0, border_right_width: 2.0,
            border_bottom_width: 2.0, border_left_width: 2.0,
            border_style:     crate::style::BorderStyleProp::Solid,
            ..base
        },
        "legend" => ComputedStyle {
            display:       Display::Block,
            padding_left:  4.0,
            padding_right: 4.0,
            ..base
        },
        "input" | "textarea" | "select" | "button" => ComputedStyle {
            display:          Display::InlineBlock,
            padding_top:      1.0, padding_bottom: 1.0,
            padding_left:     2.0, padding_right:  2.0,
            border_top_width: 2.0, border_right_width: 2.0,
            border_bottom_width: 2.0, border_left_width: 2.0,
            border_style:     crate::style::BorderStyleProp::Solid,
            ..base
        },

        // ── Multimedia ───────────────────────────────────────
        "img" | "video" | "audio" | "canvas" | "svg" => ComputedStyle {
            display: Display::InlineBlock,
            ..base
        },
        "iframe" => ComputedStyle {
            display:          Display::InlineBlock,
            border_top_width: 2.0, border_right_width: 2.0,
            border_bottom_width: 2.0, border_left_width: 2.0,
            border_style:     crate::style::BorderStyleProp::Solid,
            ..base
        },

        // ── Separadores / estructura ─────────────────────────
        "hr" => ComputedStyle {
            display:          Display::Block,
            margin_top:       8.0,
            margin_bottom:    8.0,
            border_top_width: 1.0,
            border_style:     crate::style::BorderStyleProp::Solid,
            ..base
        },
        "br" => ComputedStyle { display: Display::Inline, ..base },

        // ── Ocultos ──────────────────────────────────────────
        "head" | "script" | "style" | "meta" | "link" | "title" |
        "noscript" | "template" | "datalist" => ComputedStyle {
            display: Display::None,
            ..base
        },

        // ── Genérico ─────────────────────────────────────────
        _ => ComputedStyle { display: Display::Block, ..base },
    }
}
