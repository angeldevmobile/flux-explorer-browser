// ============================================================
//  TOKENIZER — Zero-copy HTML tokenizer
//
//  Estrategia de memoria:
//  - Todos los &str son slices dentro del HTML original → 0 allocations
//  - Atributos: SmallVec<[Attr; 4]> → stack-allocated si ≤4 atributos
//  - Token es un enum liviano, sin Box ni heap
// ============================================================

use smallvec::SmallVec;

/// Un atributo HTML: name y value son slices del HTML original.
#[derive(Debug, Clone, Copy)]
pub struct Attr<'a> {
    pub name:  &'a str,
    pub value: &'a str,
}

/// Token producido por el tokenizer.
/// Todos los &str viven mientras viva el HTML fuente.
#[derive(Debug)]
pub enum Token<'a> {
    /// `<!DOCTYPE html>`
    Doctype,
    /// `<tag attr="val">`
    StartTag {
        name:       &'a str,
        attrs:      SmallVec<[Attr<'a>; 4]>,
        self_close: bool,
    },
    /// `</tag>`
    EndTag { name: &'a str },
    /// Texto entre etiquetas (trimmed, descarta texto vacío)
    Text(&'a str),
    /// Comentario <!-- ... -->
    Comment,
    /// Fin del input
    Eof,
}

/// Estado interno del tokenizer.
/// Preparado para la fase 2: state machine completa según la spec HTML5.
#[allow(dead_code)]
#[derive(Debug, PartialEq)]
enum State {
    Data,
    TagOpen,
    EndTagOpen,
    TagName,
    SelfClose,
    BeforeAttrName,
    AttrName,
    BeforeAttrValue,
    AttrValueQuoted,
    AttrValueUnquoted,
    Comment,
}

pub struct Tokenizer<'a> {
    src:   &'a str,
    pos:   usize,
    #[allow(dead_code)] // usado en fase 2: state machine HTML5
    state: State,
}

impl<'a> Tokenizer<'a> {
    pub fn new(src: &'a str) -> Self {
        Tokenizer { src, pos: 0, state: State::Data }
    }

    fn peek(&self) -> Option<u8> {
        self.src.as_bytes().get(self.pos).copied()
    }

    fn advance(&mut self) -> Option<u8> {
        let ch = self.peek();
        if ch.is_some() { self.pos += 1; }
        ch
    }

    fn rest(&self) -> &'a str {
        // get() devuelve None si pos no está en un límite de carácter UTF-8
        self.src.get(self.pos..).unwrap_or("")
    }

    fn slice(&self, start: usize, end: usize) -> &'a str {
        self.src.get(start..end).unwrap_or("")
    }

    /// Avanza hasta encontrar el delimitador ASCII y devuelve el slice previo.
    /// Solo funciona correctamente con delimitadores ASCII (1 byte).
    #[allow(dead_code)] // útil para parseo de CDATA/scripts en fase 2
    fn read_until(&mut self, stop: u8) -> &'a str {
        let start = self.pos;
        let remaining = &self.src[self.pos..];
        // find() con un char ASCII respeta límites UTF-8
        let end_offset = remaining.find(stop as char).unwrap_or(remaining.len());
        self.pos += end_offset;
        self.slice(start, self.pos)
    }

    fn skip_whitespace(&mut self) {
        while matches!(self.peek(), Some(b' ' | b'\t' | b'\n' | b'\r')) {
            self.pos += 1;
        }
    }

    fn read_tag_name(&mut self) -> &'a str {
        let start = self.pos;
        while let Some(ch) = self.peek() {
            if ch == b'>' || ch == b'/' || ch == b' ' || ch == b'\t' || ch == b'\n' {
                break;
            }
            self.pos += 1;
        }
        self.slice(start, self.pos)
    }

    fn read_attr_name(&mut self) -> &'a str {
        let start = self.pos;
        while let Some(ch) = self.peek() {
            if matches!(ch, b'=' | b'>' | b'/' | b' ' | b'\t' | b'\n') { break; }
            self.pos += 1;
        }
        self.slice(start, self.pos)
    }

    fn read_attr_value_quoted(&mut self, quote: u8) -> &'a str {
        let start = self.pos;
        while let Some(ch) = self.peek() {
            if ch == quote { break; }
            self.pos += 1;
        }
        let val = self.slice(start, self.pos);
        // consumir comilla de cierre
        if self.peek() == Some(quote) { self.pos += 1; }
        val
    }

    fn read_attr_value_unquoted(&mut self) -> &'a str {
        let start = self.pos;
        while let Some(ch) = self.peek() {
            if matches!(ch, b'>' | b' ' | b'\t' | b'\n') { break; }
            self.pos += 1;
        }
        self.slice(start, self.pos)
    }

    /// Parsea una etiqueta de apertura completa. Asume que `<` ya fue consumido.
    fn parse_start_tag(&mut self) -> Token<'a> {
        let name = self.read_tag_name();
        let mut attrs: SmallVec<[Attr<'a>; 4]> = SmallVec::new();
        let mut self_close = false;

        loop {
            self.skip_whitespace();
            match self.peek() {
                None | Some(b'>') => {
                    self.advance();
                    break;
                }
                Some(b'/') => {
                    self.advance(); // consume '/'
                    self_close = true;
                    // consumir '>' si viene
                    if self.peek() == Some(b'>') { self.advance(); }
                    break;
                }
                _ => {
                    let attr_name = self.read_attr_name();
                    if attr_name.is_empty() { self.advance(); continue; }
                    self.skip_whitespace();
                    let attr_value = if self.peek() == Some(b'=') {
                        self.advance(); // consume '='
                        self.skip_whitespace();
                        match self.peek() {
                            Some(b'"')  => { self.advance(); self.read_attr_value_quoted(b'"') }
                            Some(b'\'') => { self.advance(); self.read_attr_value_quoted(b'\'') }
                            _ => self.read_attr_value_unquoted(),
                        }
                    } else {
                        "" // atributo booleano
                    };
                    attrs.push(Attr { name: attr_name, value: attr_value });
                }
            }
        }

        Token::StartTag { name, attrs, self_close }
    }

    fn parse_end_tag(&mut self) -> Token<'a> {
        let name = self.read_tag_name();
        // consumir hasta '>'
        while let Some(ch) = self.advance() {
            if ch == b'>' { break; }
        }
        Token::EndTag { name }
    }

    /// Produce el siguiente token.
    pub fn next_token(&mut self) -> Token<'a> {
        loop {
            match self.peek() {
                None => return Token::Eof,
                Some(b'<') => {
                    self.advance(); // consume '<'
                    match self.peek() {
                        // Comentario <!-- -->
                        Some(b'!') => {
                            self.advance();
                            if self.rest().starts_with("--") {
                                self.pos += 2;
                                // Usar find() para saltar al cierre --> respetando límites UTF-8
                                let rest = &self.src[self.pos..];
                                if let Some(end) = rest.find("-->") {
                                    self.pos += end + 3;
                                } else {
                                    self.pos = self.src.len();
                                }
                            } else {
                                // DOCTYPE u otro — solo ASCII hasta '>'
                                while let Some(ch) = self.advance() {
                                    if ch == b'>' { break; }
                                }
                            }
                            return Token::Doctype;
                        }
                        // End tag </
                        Some(b'/') => {
                            self.advance();
                            return self.parse_end_tag();
                        }
                        // Start tag
                        _ => return self.parse_start_tag(),
                    }
                }
                _ => {
                    // Texto — usar find('<') respeta límites UTF-8 correctamente
                    let start = self.pos;
                    let remaining = &self.src[self.pos..];
                    let end_offset = remaining.find('<').unwrap_or(remaining.len());
                    self.pos += end_offset;
                    let text = self.slice(start, self.pos).trim();
                    if !text.is_empty() {
                        return Token::Text(text);
                    }
                    // era solo whitespace, continuar loop
                }
            }
        }
    }
}

/// Tokeniza el HTML completo en un Vec de tokens.
/// Complejidad: O(n), sin copias del string fuente.
pub fn tokenize(html: &str) -> Vec<Token<'_>> {
    let mut tokenizer = Tokenizer::new(html);
    let mut tokens = Vec::with_capacity(64); // preallocate razonable
    loop {
        let tok = tokenizer.next_token();
        let is_eof = matches!(tok, Token::Eof);
        tokens.push(tok);
        if is_eof { break; }
    }
    tokens
}
