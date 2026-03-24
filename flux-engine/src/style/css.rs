// ============================================================
//  CSS PARSER — Fase 2
//  Parser CSS escrito a mano — sin dependencias externas.
//
//  Soporta:
//  Selectores : type, class, id, universal, descendant, grupos ','
//  Propiedades: display, color, background, font-*, margin, padding,
//               width, height, border, text-align, line-height, opacity
//  Valores    : keywords, px/em/rem/vh/vw/%, #hex, rgb/rgba, nombres
// ============================================================

use crate::style::Color;

// ── Especificidad ────────────────────────────────────────────
/// (id_count, class_count, element_count) — mayor gana.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Specificity(pub u32, pub u32, pub u32);

// ── Selectores ───────────────────────────────────────────────
#[derive(Debug, Clone)]
pub struct SimpleSelector {
    pub tag:      Option<String>,
    pub id:       Option<String>,
    pub classes:  Vec<String>,
    pub universal: bool,
}

impl SimpleSelector {
    fn empty() -> Self {
        SimpleSelector { tag: None, id: None, classes: Vec::new(), universal: false }
    }

    pub fn specificity(&self) -> Specificity {
        let a = if self.id.is_some() { 1 } else { 0 };
        let b = self.classes.len() as u32;
        let c = if self.tag.is_some() { 1 } else { 0 };
        Specificity(a, b, c)
    }
}

#[derive(Debug, Clone)]
pub enum Selector {
    Simple(SimpleSelector),
    Descendant { ancestor: Box<Selector>, descendant: Box<Selector> },
}

impl Selector {
    pub fn specificity(&self) -> Specificity {
        match self {
            Selector::Simple(s) => s.specificity(),
            Selector::Descendant { ancestor, descendant } => {
                let a = ancestor.specificity();
                let b = descendant.specificity();
                Specificity(a.0 + b.0, a.1 + b.1, a.2 + b.2)
            }
        }
    }
}

// ── Valores ──────────────────────────────────────────────────
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Unit { Px, Em, Rem, Percent, Vh, Vw }

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Keyword(String),
    Length(f32, Unit),
    Color(Color),
    Number(f32),
    Multi(Vec<Value>),  // shorthand: "8px 16px" → [Len(8), Len(16)]
    Auto,
    None_,
}

#[derive(Debug, Clone)]
pub struct Declaration {
    pub property:  String,
    pub value:     Value,
    pub important: bool,
}

// ── Regla ────────────────────────────────────────────────────
#[derive(Debug, Clone)]
pub struct Rule {
    pub selectors:    Vec<Selector>,
    pub declarations: Vec<Declaration>,
}

// ── Parser principal ─────────────────────────────────────────
pub struct CssParser<'a> {
    input: &'a str,
    pos:   usize,
}

impl<'a> CssParser<'a> {
    pub fn new(input: &'a str) -> Self {
        CssParser { input, pos: 0 }
    }

    pub fn parse_stylesheet(mut self) -> Vec<Rule> {
        let mut rules = Vec::new();
        loop {
            self.skip_ws_comments();
            if self.eof() { break; }
            if self.ch() == '@' {
                self.skip_at_rule();
                continue;
            }
            if let Some(rule) = self.parse_rule() {
                rules.push(rule);
            }
        }
        rules
    }

    fn parse_rule(&mut self) -> Option<Rule> {
        let selectors = self.parse_selector_list();
        self.skip_ws_comments();
        if self.eof() || self.ch() != '{' {
            self.skip_to_next_rule();
            return None;
        }
        self.advance(); // '{'
        let declarations = self.parse_declarations();
        self.skip_ws_comments();
        if !self.eof() && self.ch() == '}' { self.advance(); }
        if selectors.is_empty() { return None; }
        Some(Rule { selectors, declarations })
    }

    fn parse_selector_list(&mut self) -> Vec<Selector> {
        let mut list = Vec::new();
        loop {
            self.skip_ws_comments();
            if self.eof() || self.ch() == '{' { break; }
            if let Some(sel) = self.parse_selector() {
                list.push(sel);
            }
            self.skip_ws_comments();
            if !self.eof() && self.ch() == ',' {
                self.advance();
            } else {
                break;
            }
        }
        list
    }

    fn parse_selector(&mut self) -> Option<Selector> {
        let first = self.parse_simple_selector()?;
        let mut current = Selector::Simple(first);
        loop {
            let had_space = self.skip_ws_comments_tracked();
            if self.eof() || self.ch() == '{' || self.ch() == ',' { break; }
            // Si hubo espacio y el siguiente carácter inicia un selector simple
            if had_space && is_selector_start(self.ch()) {
                if let Some(next) = self.parse_simple_selector() {
                    current = Selector::Descendant {
                        ancestor:   Box::new(current),
                        descendant: Box::new(Selector::Simple(next)),
                    };
                } else { break; }
            } else { break; }
        }
        Some(current)
    }

    fn parse_simple_selector(&mut self) -> Option<SimpleSelector> {
        let mut sel = SimpleSelector::empty();
        loop {
            if self.eof() { break; }
            match self.ch() {
                '*' => { sel.universal = true; self.advance(); }
                '#' => { self.advance(); sel.id = Some(self.parse_ident()); }
                '.' => { self.advance(); sel.classes.push(self.parse_ident()); }
                c if c.is_alphabetic() || c == '_' => {
                    // Solo tomamos el tag si no hemos puesto nada aún
                    if sel.tag.is_none() && sel.id.is_none() && sel.classes.is_empty() && !sel.universal {
                        sel.tag = Some(self.parse_ident_with_hyphens());
                    } else { break; }
                }
                _ => break,
            }
        }
        if sel.tag.is_none() && sel.id.is_none() && sel.classes.is_empty() && !sel.universal {
            None
        } else {
            Some(sel)
        }
    }

    fn parse_declarations(&mut self) -> Vec<Declaration> {
        let mut decls = Vec::new();
        loop {
            self.skip_ws_comments();
            if self.eof() || self.ch() == '}' { break; }
            if let Some(d) = self.parse_declaration() {
                decls.push(d);
            }
        }
        decls
    }

    fn parse_declaration(&mut self) -> Option<Declaration> {
        let prop = self.parse_ident_with_hyphens();
        if prop.is_empty() {
            // Skip junk character
            self.advance();
            return None;
        }
        self.skip_ws_comments();
        if self.eof() || self.ch() != ':' { return None; }
        self.advance(); // ':'
        self.skip_ws_comments();

        // Recoger el texto crudo del valor hasta ';' o '}'
        let raw = self.collect_value_raw();
        let (raw_val, important) = strip_important(&raw);
        let value = parse_value_str(raw_val.trim(), &prop)?;

        self.skip_ws_comments();
        if !self.eof() && self.ch() == ';' { self.advance(); }

        Some(Declaration { property: prop, value, important })
    }

    /// Recoge caracteres hasta ';' o '}', respetando paréntesis y strings.
    fn collect_value_raw(&mut self) -> String {
        let mut s = String::new();
        let mut depth = 0i32;
        loop {
            if self.eof() { break; }
            let c = self.ch();
            if c == '(' { depth += 1; }
            if c == ')' { depth -= 1; }
            if depth <= 0 && (c == ';' || c == '}') { break; }
            s.push(c);
            self.advance();
        }
        s
    }

    // ── Helpers ──────────────────────────────────────────────
    fn skip_ws_comments(&mut self) {
        loop {
            self.skip_ws();
            if self.input[self.pos..].starts_with("/*") {
                self.skip_comment();
            } else { break; }
        }
    }

    /// Igual que skip_ws_comments pero retorna si hubo movimiento.
    fn skip_ws_comments_tracked(&mut self) -> bool {
        let start = self.pos;
        self.skip_ws_comments();
        self.pos > start
    }

    fn skip_ws(&mut self) {
        while !self.eof() && self.ch().is_whitespace() { self.advance(); }
    }

    fn skip_comment(&mut self) {
        self.pos += 2; // "/*"
        while !self.eof() {
            if self.input[self.pos..].starts_with("*/") {
                self.pos += 2;
                break;
            }
            self.pos += self.ch().len_utf8();
        }
    }

    fn skip_at_rule(&mut self) {
        let mut depth = 0i32;
        loop {
            if self.eof() { break; }
            match self.ch() {
                '{' => { depth += 1; self.advance(); }
                '}' => {
                    depth -= 1;
                    self.advance();
                    if depth <= 0 { break; }
                }
                ';' if depth == 0 => { self.advance(); break; }
                _ => { self.advance(); }
            }
        }
    }

    fn skip_to_next_rule(&mut self) {
        while !self.eof() && self.ch() != '}' && self.ch() != '{' { self.advance(); }
        if !self.eof() { self.advance(); }
    }

    fn parse_ident(&mut self) -> String {
        let mut s = String::new();
        while !self.eof() {
            let c = self.ch();
            if c.is_alphanumeric() || c == '_' || c == '-' {
                s.push(c); self.advance();
            } else { break; }
        }
        s
    }

    fn parse_ident_with_hyphens(&mut self) -> String {
        // Prefijos vendor: -webkit-, -moz-, -ms-
        let mut s = String::new();
        if !self.eof() && self.ch() == '-' { s.push('-'); self.advance(); }
        while !self.eof() {
            let c = self.ch();
            if c.is_alphanumeric() || c == '-' || c == '_' {
                s.push(c); self.advance();
            } else { break; }
        }
        s.to_lowercase()
    }

    #[inline] fn eof(&self) -> bool { self.pos >= self.input.len() }
    #[inline] fn ch(&self) -> char { self.input[self.pos..].chars().next().unwrap_or('\0') }
    #[inline] fn advance(&mut self) {
        if !self.eof() { self.pos += self.ch().len_utf8(); }
    }
}

// ── Helpers de valor ─────────────────────────────────────────

fn is_selector_start(c: char) -> bool {
    c.is_alphabetic() || c == '_' || c == '.' || c == '#' || c == '*'
}

fn strip_important(raw: &str) -> (String, bool) {
    if let Some(s) = raw.trim_end().strip_suffix("!important") {
        (s.trim().to_string(), true)
    } else {
        (raw.to_string(), false)
    }
}

/// Parsea el texto crudo de un valor CSS.
pub fn parse_value_str(raw: &str, property: &str) -> Option<Value> {
    let raw = raw.trim();
    if raw.is_empty() { return None; }

    // Shorthands con múltiples tokens (split respetando parens)
    let tokens = split_values(raw);
    if tokens.len() > 1 {
        let vals: Vec<Value> = tokens.iter()
            .filter_map(|t| parse_single_value(t.trim(), property))
            .collect();
        if !vals.is_empty() {
            return Some(Value::Multi(vals));
        }
    }

    parse_single_value(raw, property)
}

/// Divide un valor en tokens por espacios, respetando `(...)`.
fn split_values(raw: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut depth = 0i32;
    for c in raw.chars() {
        match c {
            '(' => { depth += 1; current.push(c); }
            ')' => { depth -= 1; current.push(c); }
            ' ' | '\t' | '\n' if depth == 0 => {
                let tok = current.trim().to_string();
                if !tok.is_empty() { tokens.push(tok); }
                current.clear();
            }
            _ => current.push(c),
        }
    }
    let tok = current.trim().to_string();
    if !tok.is_empty() { tokens.push(tok); }
    tokens
}

fn parse_single_value(raw: &str, property: &str) -> Option<Value> {
    // Palabras clave universales
    match raw {
        "auto"        => return Some(Value::Auto),
        "none"        => return Some(Value::None_),
        "inherit" | "initial" | "unset" | "revert" => return Some(Value::Keyword(raw.to_string())),
        _ => {}
    }

    // Colores — si la propiedad es de color o el valor parece un color
    if is_color_property(property) || raw.starts_with('#') || raw.starts_with("rgb") {
        if let Some(c) = parse_color(raw) {
            return Some(Value::Color(c));
        }
    }

    // Longitudes / porcentajes
    if let Some(len) = parse_length(raw) { return Some(len); }

    // Número puro (line-height, opacity, etc.)
    if let Ok(n) = raw.parse::<f32>() { return Some(Value::Number(n)); }

    // Keyword genérica
    if raw.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Some(Value::Keyword(raw.to_lowercase()));
    }

    None
}

fn is_color_property(prop: &str) -> bool {
    matches!(prop, "color" | "background-color" | "background"
        | "border-color" | "border-top-color" | "border-right-color"
        | "border-bottom-color" | "border-left-color" | "outline-color"
        | "text-decoration-color" | "fill" | "stroke")
}

pub fn parse_length(raw: &str) -> Option<Value> {
    if let Some(n) = raw.strip_suffix("rem") {
        return n.trim().parse::<f32>().ok().map(|v| Value::Length(v, Unit::Rem));
    }
    if let Some(n) = raw.strip_suffix("px") {
        return n.trim().parse::<f32>().ok().map(|v| Value::Length(v, Unit::Px));
    }
    if let Some(n) = raw.strip_suffix("em") {
        return n.trim().parse::<f32>().ok().map(|v| Value::Length(v, Unit::Em));
    }
    if let Some(n) = raw.strip_suffix("vh") {
        return n.trim().parse::<f32>().ok().map(|v| Value::Length(v, Unit::Vh));
    }
    if let Some(n) = raw.strip_suffix("vw") {
        return n.trim().parse::<f32>().ok().map(|v| Value::Length(v, Unit::Vw));
    }
    if let Some(n) = raw.strip_suffix('%') {
        return n.trim().parse::<f32>().ok().map(|v| Value::Length(v, Unit::Percent));
    }
    // 0 sin unidad es válido
    if raw == "0" { return Some(Value::Length(0.0, Unit::Px)); }
    None
}

pub fn parse_color(raw: &str) -> Option<Color> {
    let raw = raw.trim();
    if let Some(hex) = raw.strip_prefix('#') { return parse_hex(hex); }
    if raw.starts_with("rgba(") || raw.starts_with("rgb(") { return parse_rgb(raw); }
    named_color(raw)
}

fn parse_hex(hex: &str) -> Option<Color> {
    match hex.len() {
        3 => {
            let r = u8::from_str_radix(&hex[0..1].repeat(2), 16).ok()?;
            let g = u8::from_str_radix(&hex[1..2].repeat(2), 16).ok()?;
            let b = u8::from_str_radix(&hex[2..3].repeat(2), 16).ok()?;
            Some(Color { r, g, b, a: 255 })
        }
        6 => {
            let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
            let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
            let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
            Some(Color { r, g, b, a: 255 })
        }
        8 => {
            let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
            let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
            let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
            let a = u8::from_str_radix(&hex[6..8], 16).ok()?;
            Some(Color { r, g, b, a })
        }
        _ => None,
    }
}

fn parse_rgb(raw: &str) -> Option<Color> {
    let is_rgba = raw.starts_with("rgba");
    let inner = raw
        .trim_start_matches("rgba(")
        .trim_start_matches("rgb(")
        .trim_end_matches(')');
    let parts: Vec<&str> = inner.split(',').collect();
    let r = parts.first()?.trim().parse::<f32>().ok()?.round() as u8;
    let g = parts.get(1)?.trim().parse::<f32>().ok()?.round() as u8;
    let b = parts.get(2)?.trim().parse::<f32>().ok()?.round() as u8;
    let a = if is_rgba {
        (parts.get(3)?.trim().parse::<f32>().ok()? * 255.0).round() as u8
    } else { 255 };
    Some(Color { r, g, b, a })
}

fn named_color(name: &str) -> Option<Color> {
    Some(match name.to_lowercase().as_str() {
        "black"         => Color { r: 0,   g: 0,   b: 0,   a: 255 },
        "white"         => Color { r: 255, g: 255, b: 255, a: 255 },
        "red"           => Color { r: 255, g: 0,   b: 0,   a: 255 },
        "green"         => Color { r: 0,   g: 128, b: 0,   a: 255 },
        "blue"          => Color { r: 0,   g: 0,   b: 255, a: 255 },
        "yellow"        => Color { r: 255, g: 255, b: 0,   a: 255 },
        "orange"        => Color { r: 255, g: 165, b: 0,   a: 255 },
        "purple"        => Color { r: 128, g: 0,   b: 128, a: 255 },
        "pink"          => Color { r: 255, g: 192, b: 203, a: 255 },
        "gray" | "grey" => Color { r: 128, g: 128, b: 128, a: 255 },
        "lightgray" | "lightgrey" => Color { r: 211, g: 211, b: 211, a: 255 },
        "darkgray" | "darkgrey"   => Color { r: 169, g: 169, b: 169, a: 255 },
        "cyan" | "aqua" => Color { r: 0,   g: 255, b: 255, a: 255 },
        "magenta" | "fuchsia" => Color { r: 255, g: 0,   b: 255, a: 255 },
        "lime"          => Color { r: 0,   g: 255, b: 0,   a: 255 },
        "maroon"        => Color { r: 128, g: 0,   b: 0,   a: 255 },
        "navy"          => Color { r: 0,   g: 0,   b: 128, a: 255 },
        "olive"         => Color { r: 128, g: 128, b: 0,   a: 255 },
        "teal"          => Color { r: 0,   g: 128, b: 128, a: 255 },
        "silver"        => Color { r: 192, g: 192, b: 192, a: 255 },
        "brown"         => Color { r: 165, g: 42,  b: 42,  a: 255 },
        "coral"         => Color { r: 255, g: 127, b: 80,  a: 255 },
        "crimson"       => Color { r: 220, g: 20,  b: 60,  a: 255 },
        "gold"          => Color { r: 255, g: 215, b: 0,   a: 255 },
        "indigo"        => Color { r: 75,  g: 0,   b: 130, a: 255 },
        "khaki"         => Color { r: 240, g: 230, b: 140, a: 255 },
        "lavender"      => Color { r: 230, g: 230, b: 250, a: 255 },
        "lightblue"     => Color { r: 173, g: 216, b: 230, a: 255 },
        "lightgreen"    => Color { r: 144, g: 238, b: 144, a: 255 },
        "lightyellow"   => Color { r: 255, g: 255, b: 224, a: 255 },
        "salmon"        => Color { r: 250, g: 128, b: 114, a: 255 },
        "skyblue"       => Color { r: 135, g: 206, b: 235, a: 255 },
        "tomato"        => Color { r: 255, g: 99,  b: 71,  a: 255 },
        "turquoise"     => Color { r: 64,  g: 224, b: 208, a: 255 },
        "violet"        => Color { r: 238, g: 130, b: 238, a: 255 },
        "wheat"         => Color { r: 245, g: 222, b: 179, a: 255 },
        "transparent"   => Color { r: 0,   g: 0,   b: 0,   a: 0   },
        "aliceblue"     => Color { r: 240, g: 248, b: 255, a: 255 },
        "antiquewhite"  => Color { r: 250, g: 235, b: 215, a: 255 },
        "chocolate"     => Color { r: 210, g: 105, b: 30,  a: 255 },
        "darkcyan"      => Color { r: 0,   g: 139, b: 139, a: 255 },
        "darkgreen"     => Color { r: 0,   g: 100, b: 0,   a: 255 },
        "darkorange"    => Color { r: 255, g: 140, b: 0,   a: 255 },
        "deepskyblue"   => Color { r: 0,   g: 191, b: 255, a: 255 },
        "dimgray" | "dimgrey" => Color { r: 105, g: 105, b: 105, a: 255 },
        "forestgreen"   => Color { r: 34,  g: 139, b: 34,  a: 255 },
        "hotpink"       => Color { r: 255, g: 105, b: 180, a: 255 },
        "limegreen"     => Color { r: 50,  g: 205, b: 50,  a: 255 },
        "midnightblue"  => Color { r: 25,  g: 25,  b: 112, a: 255 },
        "mintcream"     => Color { r: 245, g: 255, b: 250, a: 255 },
        "mistyrose"     => Color { r: 255, g: 228, b: 225, a: 255 },
        "orangered"     => Color { r: 255, g: 69,  b: 0,   a: 255 },
        "royalblue"     => Color { r: 65,  g: 105, b: 225, a: 255 },
        "seagreen"      => Color { r: 46,  g: 139, b: 87,  a: 255 },
        "sienna"        => Color { r: 160, g: 82,  b: 45,  a: 255 },
        "slateblue"     => Color { r: 106, g: 90,  b: 205, a: 255 },
        "slategray" | "slategrey" => Color { r: 112, g: 128, b: 144, a: 255 },
        "snow"          => Color { r: 255, g: 250, b: 250, a: 255 },
        "steelblue"     => Color { r: 70,  g: 130, b: 180, a: 255 },
        "tan"           => Color { r: 210, g: 180, b: 140, a: 255 },
        "thistle"       => Color { r: 216, g: 191, b: 216, a: 255 },
        "whitesmoke"    => Color { r: 245, g: 245, b: 245, a: 255 },
        "yellowgreen"   => Color { r: 154, g: 205, b: 50,  a: 255 },
        _ => return None,
    })
}
