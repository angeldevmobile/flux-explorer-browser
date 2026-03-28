// ============================================================
//  RENDERER — Fase 4
//  ConsoleRenderer : debug ASCII (Fase 1-3)
//  OrionSoftRenderer : pixel buffer real con fontdue (Fase 4)
// ============================================================

pub mod font;
pub mod soft;

pub use soft::OrionSoftRenderer;

use crate::paint::DisplayCommand;

// ── Console renderer (debug) ─────────────────────────────────

pub struct ConsoleRenderer;

impl ConsoleRenderer {
    pub fn render(commands: &[DisplayCommand]) {
        println!("\n╔══════════════════════════════════════╗");
        println!("║       FLUX ENGINE — RENDER OUTPUT   ║");
        println!("╚══════════════════════════════════════╝\n");

        for cmd in commands {
            match cmd {
                DisplayCommand::DrawText { text, x, y, font_size, .. } => {
                    println!("  [{:.0},{:.0}] ({}px) {}", x, y, font_size, text);
                }
                DisplayCommand::FillRect { rect, color } => {
                    println!(
                        "  FILL [{:.0},{:.0} {:.0}×{:.0}] rgba({},{},{},{})",
                        rect.x, rect.y, rect.width, rect.height,
                        color.r, color.g, color.b, color.a
                    );
                }
                DisplayCommand::StrokeRect { rect, color, width } => {
                    println!(
                        "  STROKE [{:.0},{:.0} {:.0}×{:.0}] {:.0}px rgba({},{},{},{})",
                        rect.x, rect.y, rect.width, rect.height, width,
                        color.r, color.g, color.b, color.a
                    );
                }
            }
        }
        println!();
    }
}

pub fn print_stats(
    token_count:  usize,
    dom_nodes:    usize,
    layout_boxes: usize,
    display_cmds: usize,
) {
    println!("── Pipeline stats ───────────────────────");
    println!("  tokens       : {}", token_count);
    println!("  DOM nodes    : {}", dom_nodes);
    println!("  layout boxes : {}", layout_boxes);
    println!("  display cmds : {}", display_cmds);
    println!("─────────────────────────────────────────\n");
}
