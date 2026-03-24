// ============================================================
//  ORION ENGINE — Pipeline de renderizado HTML
//  Fase 3: inline formatting context + word wrapping
//  Fase 5: JavaScript con QuickJS
//  Fase 6: Seguridad (CSP, HTTPS, HSTS, ad blocker)
// ============================================================

pub mod parsing;
pub mod dom;
pub mod style;
pub mod layout;
pub mod paint;
pub mod renderer;
pub mod extractor;
pub mod fetcher;
pub mod ranker;
pub mod api;
pub mod js;
pub mod security;

/// Ejecuta el pipeline completo: HTML → DisplayList.
/// Incluye ejecución de JavaScript y aplicación de mutaciones DOM.
pub fn run_pipeline(html: &str) -> Vec<paint::DisplayCommand> {
    run_pipeline_with_url(html, "about:blank")
}

/// Variante con URL + SecurityLayer (CSP del servidor).
/// Bloquea inline scripts si la CSP lo requiere y propaga el CSP
/// al snapshot JS para que fetch() respete connect-src.
pub fn run_pipeline_with_security(
    html:     &str,
    url:      &str,
    security: &security::SecurityLayer,
) -> Vec<paint::DisplayCommand> {
    let tokens = parsing::tokenizer::tokenize(html);
    let dom    = parsing::parser::parse(&tokens, html);

    let mutations = if security.allows_inline_scripts() {
        let scripts = js::extract_scripts(&dom);
        if scripts.is_empty() {
            vec![]
        } else {
            let mut snapshot = js::DomSnapshot::from_arena(&dom, url);
            snapshot.csp     = security.csp.clone();   // propagar CSP al JS
            let runtime      = js::JsRuntime::new();
            runtime.execute_scripts(&scripts, &snapshot)
        }
    } else {
        eprintln!("[orion-security] inline scripts bloqueados por CSP");
        vec![]
    };

    let styled = style::resolve(&dom);
    let dims   = layout::Dimensions::viewport(800.0, 600.0);
    let boxes  = layout::compute(&dom, &styled, dims);
    let mut commands = paint::build_display_list(&boxes, &dom, &styled);

    if !mutations.is_empty() {
        js::apply_mutations(&mut commands, &mutations);
    }

    commands
}

/// Variante con URL para window.location y fetch relativo.
pub fn run_pipeline_with_url(html: &str, url: &str) -> Vec<paint::DisplayCommand> {
    let tokens = parsing::tokenizer::tokenize(html);
    let dom    = parsing::parser::parse(&tokens, html);

    // ── Fase 5: JavaScript ────────────────────────────────────
    let scripts = js::extract_scripts(&dom);
    let mutations = if !scripts.is_empty() {
        let snapshot = js::DomSnapshot::from_arena(&dom, url);
        let runtime  = js::JsRuntime::new();
        let muts = runtime.execute_scripts(&scripts, &snapshot);
        if !muts.is_empty() {
            let logs: Vec<_> = muts.iter()
                .filter_map(|m| if let js::DomMutation::ConsoleLog(s) = m { Some(s) } else { None })
                .collect();
            if !logs.is_empty() {
                println!("[orion-js] {} mensaje(s) de consola", logs.len());
            }
        }
        muts
    } else {
        vec![]
    };

    let styled = style::resolve(&dom);
    let dims   = layout::Dimensions::viewport(800.0, 600.0);
    let boxes  = layout::compute(&dom, &styled, dims);
    let mut commands = paint::build_display_list(&boxes, &dom, &styled);

    // Aplicar mutaciones JS (textContent changes)
    if !mutations.is_empty() {
        js::apply_mutations(&mut commands, &mutations);
    }

    commands
}

// ── Tests ─────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use crate::parsing::{tokenizer::tokenize, parser::parse};
    use crate::style::{resolve, Display, FontWeight, Color};
    use crate::layout::inline::measure_text;
    use crate::renderer::ConsoleRenderer;
    use crate::paint::DisplayCommand;

    // ── Medición de texto ─────────────────────────────────────
    #[test]
    fn test_measure_text_nonzero() {
        let w = measure_text("Hola mundo", 16.0);
        assert!(w > 0.0, "el ancho debe ser positivo");
        // "Hola mundo" ≈ 10 chars × 0.55 × 16px ≈ 88px
        assert!(w > 50.0 && w < 150.0, "ancho razonable: {}", w);
    }

    #[test]
    fn test_measure_text_longer_is_wider() {
        let short = measure_text("Hi",       16.0);
        let long  = measure_text("Hello World from Orion", 16.0);
        assert!(long > short, "texto más largo debe ser más ancho");
    }

    #[test]
    fn test_measure_text_bigger_font_is_wider() {
        let small = measure_text("Test", 12.0);
        let large = measure_text("Test", 24.0);
        assert!(large > small, "fuente mayor → más ancho");
    }

    // ── CSS Parser ────────────────────────────────────────────
    #[test]
    fn test_parse_hex_color() {
        use crate::style::css::parse_color;
        assert_eq!(parse_color("#ff0000"), Some(Color { r: 255, g: 0, b: 0, a: 255 }));
        assert_eq!(parse_color("#f00"),    Some(Color { r: 255, g: 0, b: 0, a: 255 }));
    }

    #[test]
    fn test_parse_rgb_color() {
        use crate::style::css::parse_color;
        assert_eq!(parse_color("rgb(0, 128, 255)"),     Some(Color { r: 0, g: 128, b: 255, a: 255 }));
        assert_eq!(parse_color("rgba(255, 0, 0, 0.5)"), Some(Color { r: 255, g: 0, b: 0, a: 128 }));
    }

    #[test]
    fn test_named_colors() {
        use crate::style::css::parse_color;
        assert_eq!(parse_color("red"),         Some(Color { r: 255, g: 0,   b: 0,   a: 255 }));
        assert_eq!(parse_color("transparent"), Some(Color { r: 0,   g: 0,   b: 0,   a: 0   }));
        assert!(parse_color("notacolor").is_none());
    }

    #[test]
    fn test_parse_lengths() {
        use crate::style::css::{parse_length, Value, Unit};
        assert_eq!(parse_length("16px"),  Some(Value::Length(16.0,  Unit::Px)));
        assert_eq!(parse_length("1.5em"), Some(Value::Length(1.5,   Unit::Em)));
        assert_eq!(parse_length("2rem"),  Some(Value::Length(2.0,   Unit::Rem)));
        assert_eq!(parse_length("0"),     Some(Value::Length(0.0,   Unit::Px)));
    }

    // ── UA Styles ─────────────────────────────────────────────
    #[test]
    fn test_ua_h1_bold_32px() {
        use crate::style::ua::ua_style;
        let s = ua_style("h1");
        assert_eq!(s.font_size,   32.0);
        assert_eq!(s.font_weight, FontWeight::Bold);
        assert_eq!(s.display,     Display::Block);
    }

    #[test]
    fn test_ua_script_hidden() {
        use crate::style::ua::ua_style;
        assert_eq!(ua_style("script").display, Display::None);
    }

    // ── Cascade ───────────────────────────────────────────────
    #[test]
    fn test_style_tag_color() {
        let html = r#"<html><head><style>p{color:#ff0000;}</style></head><body><p>Test</p></body></html>"#;
        let tokens = tokenize(html);
        let dom    = parse(&tokens, html);
        let styles = resolve(&dom);
        let p_id   = dom.iter()
            .find(|(_, n)| matches!(&n.data, crate::dom::NodeData::Element { tag, .. } if *tag == "p"))
            .map(|(id, _)| id).unwrap();
        assert_eq!(styles.get(p_id).color, Color { r: 255, g: 0, b: 0, a: 255 });
    }

    #[test]
    fn test_specificity_class_wins_over_tag() {
        let html = r#"<html><head><style>p{color:red;}.hl{color:blue;}</style></head>
                     <body><p class="hl">X</p></body></html>"#;
        let tokens = tokenize(html);
        let dom    = parse(&tokens, html);
        let styles = resolve(&dom);
        let p_id   = dom.iter()
            .find(|(_, n)| matches!(&n.data, crate::dom::NodeData::Element { tag, .. } if *tag == "p"))
            .map(|(id, _)| id).unwrap();
        assert_eq!(styles.get(p_id).color, Color { r: 0, g: 0, b: 255, a: 255 });
    }

    #[test]
    fn test_color_inheritance() {
        let html = r#"<html><head><style>body{color:purple;}</style></head><body><p>X</p></body></html>"#;
        let tokens = tokenize(html);
        let dom    = parse(&tokens, html);
        let styles = resolve(&dom);
        let p_id   = dom.iter()
            .find(|(_, n)| matches!(&n.data, crate::dom::NodeData::Element { tag, .. } if *tag == "p"))
            .map(|(id, _)| id).unwrap();
        assert_eq!(styles.get(p_id).color, Color { r: 128, g: 0, b: 128, a: 255 });
    }

    // ── Inline layout: word wrapping ──────────────────────────
    #[test]
    fn test_word_wrap_produces_multiple_lines() {
        // Contenedor muy angosto (100px) con un texto largo
        let html = r#"<html><body>
            <p>Esta es una frase bastante larga que debería dividirse en varias líneas.</p>
        </body></html>"#;

        let tokens = tokenize(html);
        let dom    = parse(&tokens, html);
        let styled = resolve(&dom);
        // viewport angosto: 150px
        let dims   = layout::Dimensions::viewport(150.0, 600.0);
        let boxes  = layout::compute(&dom, &styled, dims);

        // Deben existir múltiples LayoutBoxes para el texto del <p>
        let text_boxes: Vec<_> = boxes.boxes.iter()
            .filter(|lb| {
                matches!(dom.get(lb.node).data, crate::dom::NodeData::Text(_))
                    && lb.text_fragment.is_some()
            })
            .collect();

        assert!(text_boxes.len() > 1,
            "texto largo en viewport angosto debe producir >1 líneas, got {}",
            text_boxes.len());
    }

    #[test]
    fn test_word_wrap_fragments_are_nonempty() {
        let html = r#"<html><body><p>Hola mundo prueba</p></body></html>"#;
        let tokens = tokenize(html);
        let dom    = parse(&tokens, html);
        let styled = resolve(&dom);
        let dims   = layout::Dimensions::viewport(800.0, 600.0);
        let boxes  = layout::compute(&dom, &styled, dims);

        for lb in &boxes.boxes {
            if let Some(frag) = &lb.text_fragment {
                assert!(!frag.trim().is_empty(), "fragmento no debe estar vacío");
            }
        }
    }

    #[test]
    fn test_word_wrap_lines_at_different_y() {
        let html = r#"<html><body>
            <p>word1 word2 word3 word4 word5 word6 word7 word8 word9 word10</p>
        </body></html>"#;
        let tokens = tokenize(html);
        let dom    = parse(&tokens, html);
        let styled = resolve(&dom);
        let dims   = layout::Dimensions::viewport(120.0, 600.0);
        let boxes  = layout::compute(&dom, &styled, dims);

        let ys: Vec<f32> = boxes.boxes.iter()
            .filter(|lb| lb.text_fragment.is_some())
            .map(|lb| lb.y)
            .collect();

        if ys.len() > 1 {
            // Las líneas deben avanzar hacia abajo
            for i in 1..ys.len() {
                assert!(ys[i] >= ys[i-1],
                    "línea {} debe estar más abajo que la anterior", i);
            }
        }
    }

    // ── text-align ────────────────────────────────────────────
    #[test]
    fn test_text_align_center_offset() {
        let html = r#"<html><head>
            <style>p { text-align: center; }</style>
        </head><body><p>Centrado</p></body></html>"#;

        let tokens = tokenize(html);
        let dom    = parse(&tokens, html);
        let styled = resolve(&dom);
        let dims   = layout::Dimensions::viewport(800.0, 600.0);
        let boxes  = layout::compute(&dom, &styled, dims);

        let text_box = boxes.boxes.iter()
            .find(|lb| lb.text_fragment.is_some());

        if let Some(lb) = text_box {
            // Con text-align:center el texto debe estar desplazado a la derecha del borde izquierdo
            assert!(lb.x > 0.0, "texto centrado debe tener x > 0");
        }
    }

    // ── Pipeline completo ─────────────────────────────────────
    #[test]
    fn test_pipeline_fase3_completo() {
        let html = r#"<!DOCTYPE html>
<html>
<head>
  <style>
    body { background-color: #f5f5f5; color: #333; }
    h1   { color: #0055aa; font-size: 24px; }
    p    { margin: 8px 0; line-height: 1.6; }
    .box { background-color: #fff; border-style: solid;
           border-width: 1px; border-color: #ddd; padding: 16px; }
    .red { color: #cc0000; }
  </style>
</head>
<body>
  <h1>Orion Engine Fase 3</h1>
  <div class="box">
    <p>Este es un párrafo con texto que debería hacer word wrapping
       automático cuando el contenedor es más angosto que el texto.</p>
    <p class="red" style="font-size: 13px;">
      Texto pequeño en rojo con inline style override.
    </p>
    <p>Línea con <span style="color: blue;">span azul</span> y texto normal.</p>
  </div>
</body>
</html>"#;

        let commands = run_pipeline(html);
        assert!(!commands.is_empty(), "la display list no debe estar vacía");

        let text_count = commands.iter()
            .filter(|c| matches!(c, DisplayCommand::DrawText { .. }))
            .count();
        let rect_count = commands.iter()
            .filter(|c| matches!(c, DisplayCommand::FillRect { .. }))
            .count();

        assert!(text_count > 0, "debe haber comandos de texto");
        assert!(rect_count > 0, "debe haber rects de fondo");

        println!("\n=== Fase 3 — Pipeline completo ===");
        ConsoleRenderer::render(&commands);
    }

    // ── Pipeline completo: word wrap con viewport angosto ─────
    #[test]
    fn test_pipeline_viewport_angosto() {
        let html = r#"<html><body>
            <p>Un párrafo con bastante texto para probar el wrapping en un contenedor pequeño.</p>
        </body></html>"#;

        let tokens = tokenize(html);
        let dom    = parse(&tokens, html);
        let styled = resolve(&dom);
        let dims   = layout::Dimensions::viewport(200.0, 600.0);
        let boxes  = layout::compute(&dom, &styled, dims);
        let cmds   = paint::build_display_list(&boxes, &dom, &styled);

        let texts: Vec<&String> = cmds.iter()
            .filter_map(|c| if let DisplayCommand::DrawText { text, .. } = c { Some(text) } else { None })
            .collect();

        assert!(!texts.is_empty(), "debe haber texto en la display list");
        println!("\n=== Viewport 200px — word wrap ===");
        for t in &texts {
            println!("  línea: {:?}", t);
        }
    }
}