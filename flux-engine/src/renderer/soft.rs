// ============================================================
//  ORION SOFT RENDERER — Fase 4
//
//  Rasterizador de píxeles sobre un buffer u32 (XRGB8888).
//  Presentación vía softbuffer (DXGI en Windows, Metal en macOS).
//
//  Pipeline por frame:
//    1. Clear (llenar buffer con color de fondo)
//    2. FillRect  → escribir píxeles directamente
//    3. StrokeRect → dibujar 4 líneas
//    4. DrawText  → rasterizar glifos con fontdue + alpha blend
//
//  Memoria:
//    - Glyph cache: HashMap<(char, u32_size), GlyphEntry>
//    - ~1-4 KB por glifo rasterizado a 16px
//    - 128 glifos ASCII @ 16px ≈ 200 KB total en cache
// ============================================================

use std::collections::HashMap;
use crate::paint::DisplayCommand;
use crate::style::Color;

// ── Cache de glifos ──────────────────────────────────────────

type CacheKey = (char, u32); // (carácter, font_size × 10)

struct GlyphEntry {
    metrics: fontdue::Metrics,
    bitmap:  Vec<u8>, // alpha values (0-255)
}

// ── Renderer ─────────────────────────────────────────────────

pub struct OrionSoftRenderer {
    font:  fontdue::Font,
    cache: HashMap<CacheKey, GlyphEntry>,
}

impl OrionSoftRenderer {
    pub fn new(font: fontdue::Font) -> Self {
        OrionSoftRenderer {
            font,
            cache: HashMap::with_capacity(256),
        }
    }

    /// Renderiza la display list en el pixel buffer.
    /// `buf`    = slice de píxeles XRGB8888 (u32), tamaño = width × height
    /// `width`  = ancho del buffer en píxeles
    /// `height` = alto del buffer en píxeles
    pub fn render(
        &mut self,
        commands: &[DisplayCommand],
        buf:      &mut [u32],
        width:    usize,
        height:   usize,
    ) {
        // Clear — fondo blanco
        buf.fill(0x00FF_FFFF);

        for cmd in commands {
            match cmd {
                DisplayCommand::FillRect { rect, color } => {
                    self.fill_rect(
                        rect.x, rect.y, rect.width, rect.height,
                        *color, buf, width, height,
                    );
                }
                DisplayCommand::StrokeRect { rect, color, width: sw } => {
                    self.stroke_rect(
                        rect.x, rect.y, rect.width, rect.height,
                        *color, *sw, buf, width, height,
                    );
                }
                DisplayCommand::DrawText { text, x, y, font_size, color, .. } => {
                    self.draw_text(text, *x, *y, *font_size, *color, buf, width, height);
                }
            }
        }
    }

    // ── Primitivas ────────────────────────────────────────────

    fn fill_rect(
        &self,
        rx: f32, ry: f32, rw: f32, rh: f32,
        color: Color,
        buf: &mut [u32], bw: usize, bh: usize,
    ) {
        if color.a == 0 { return; }
        let x0 = rx.max(0.0) as usize;
        let y0 = ry.max(0.0) as usize;
        let x1 = (rx + rw).min(bw as f32) as usize;
        let y1 = (ry + rh).min(bh as f32) as usize;
        let c  = rgb_to_u32(color.r, color.g, color.b);

        if color.a == 255 {
            // Sin blending: ruta rápida
            for y in y0..y1 {
                let row = y * bw;
                for x in x0..x1 {
                    buf[row + x] = c;
                }
            }
        } else {
            for y in y0..y1 {
                let row = y * bw;
                for x in x0..x1 {
                    buf[row + x] = blend_u32(buf[row + x], color.r, color.g, color.b, color.a);
                }
            }
        }
    }

    fn stroke_rect(
        &self,
        rx: f32, ry: f32, rw: f32, rh: f32,
        color: Color, stroke: f32,
        buf: &mut [u32], bw: usize, bh: usize,
    ) {
        let s = stroke.max(1.0) as usize;
        // Top
        self.fill_rect(rx, ry, rw, s as f32, color, buf, bw, bh);
        // Bottom
        self.fill_rect(rx, ry + rh - s as f32, rw, s as f32, color, buf, bw, bh);
        // Left
        self.fill_rect(rx, ry, s as f32, rh, color, buf, bw, bh);
        // Right
        self.fill_rect(rx + rw - s as f32, ry, s as f32, rh, color, buf, bw, bh);
    }

    fn draw_text(
        &mut self,
        text:      &str,
        x:         f32,
        y:         f32,
        font_size: f32,
        color:     Color,
        buf:       &mut [u32],
        bw:        usize,
        bh:        usize,
    ) {
        // La baseline aproximada está a ~80% del alto del em-square
        let baseline = y + font_size * 0.80;
        let mut cursor_x = x;

        for ch in text.chars() {
            if ch == '\n' { continue; }

            let key: CacheKey = (ch, (font_size * 10.0).round() as u32);

            // Rasterizar si no está en cache
            if !self.cache.contains_key(&key) {
                let (metrics, bitmap) = self.font.rasterize(ch, font_size);
                self.cache.insert(key, GlyphEntry { metrics, bitmap });
            }

            let entry = self.cache.get(&key).unwrap();

            // Avanzar cursor para espacios/glifos sin bitmap
            if entry.bitmap.is_empty() || entry.metrics.width == 0 {
                cursor_x += entry.metrics.advance_width;
                continue;
            }

            // Posición del glifo en el buffer:
            // glyph_top_y = baseline + ymin - height
            // (ymin puede ser negativo para caracteres sin descender)
            let glyph_x = cursor_x as i32 + entry.metrics.xmin;
            let glyph_y = baseline as i32 - entry.metrics.ymin - entry.metrics.height as i32;

            let w = entry.metrics.width;
            let h = entry.metrics.height;

            for row in 0..h {
                for col in 0..w {
                    let alpha = entry.bitmap[row * w + col];
                    if alpha == 0 { continue; }
                    let px = glyph_x + col as i32;
                    let py = glyph_y + row as i32;
                    if px < 0 || py < 0 { continue; }
                    let (px, py) = (px as usize, py as usize);
                    if px >= bw || py >= bh { continue; }
                    let idx = py * bw + px;
                    buf[idx] = blend_u32(buf[idx], color.r, color.g, color.b, alpha);
                }
            }

            cursor_x += entry.metrics.advance_width;
        }
    }
}

// ── Helpers de color ─────────────────────────────────────────

#[inline]
fn rgb_to_u32(r: u8, g: u8, b: u8) -> u32 {
    ((r as u32) << 16) | ((g as u32) << 8) | (b as u32)
}

/// Alpha blending sobre un píxel XRGB8888.
#[inline]
fn blend_u32(existing: u32, r: u8, g: u8, b: u8, alpha: u8) -> u32 {
    if alpha == 255 { return rgb_to_u32(r, g, b); }
    if alpha == 0   { return existing; }

    let a     = alpha as u32;
    let inv_a = 255 - a;

    let er = (existing >> 16) & 0xFF;
    let eg = (existing >>  8) & 0xFF;
    let eb =  existing        & 0xFF;

    let nr = (r as u32 * a + er * inv_a) / 255;
    let ng = (g as u32 * a + eg * inv_a) / 255;
    let nb = (b as u32 * a + eb * inv_a) / 255;

    (nr << 16) | (ng << 8) | nb
}
