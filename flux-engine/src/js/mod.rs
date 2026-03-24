// ============================================================
//  ORION JS — Fase 5: JavaScript ligero con QuickJS
//
//  Stack: rquickjs (~10 MB) vs V8 (~100 MB)
//  Un JsRuntime por tab → aislamiento real de procesos.
//
//  Pipeline:
//    DOM arena → DomSnapshot (owned) → QuickJS sandbox
//    → DomMutation[] → apply_mutations → repaint
//
//  API expuesta al JS:
//    console.log/warn/error/debug/info
//    document.getElementById / querySelector / querySelectorAll
//    document.createElement / title / body / documentElement
//    element.textContent / innerHTML / style / classList
//    element.getAttribute / setAttribute / appendChild
//    window.location / setTimeout / fetch (sincrónico)
// ============================================================

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use rquickjs::{Context, Ctx, Function, Object, Runtime, Value};
use rquickjs::function::Rest;

use crate::dom::{Arena, NodeData, NodeId};
use crate::paint::DisplayCommand;

// ── DOM Snapshot ─────────────────────────────────────────────

/// Copia owned de un elemento DOM para exponerlo a QuickJS.
#[derive(Clone, Debug, Default)]
pub struct JsElement {
    pub idx:          usize,
    pub tag:          String,
    pub id:           String,
    pub classes:      Vec<String>,
    pub attrs:        HashMap<String, String>,
    pub text_content: String,
    pub children:     Vec<usize>,
    pub parent:       Option<usize>,
}

/// Snapshot completo del DOM (sin lifetimes) para el runtime JS.
pub struct DomSnapshot {
    pub elements: Vec<JsElement>,
    pub id_index: HashMap<String, usize>,
    pub body_idx: i32,
    pub html_idx: i32,
    pub title:    String,
    pub url:      String,
    /// CSP del servidor — controla qué URLs puede fetch()ar el JS.
    pub csp:      Option<crate::security::CspPolicy>,
}

impl DomSnapshot {
    /// Construye un snapshot desde el arena del DOM de Orion.
    pub fn from_arena<'a>(dom: &Arena<'a>, url: &str) -> Self {
        let cap = dom.len();
        let mut elements = vec![JsElement::default(); cap];
        let mut id_index = HashMap::new();
        let mut title    = String::new();
        let mut body_idx = -1i32;
        let mut html_idx = -1i32;

        for (node_id, node) in dom.iter() {
            let NodeData::Element { tag, attrs } = &node.data else { continue };

            let id_val = attrs.iter().find(|(k, _)| *k == "id")
                .map(|(_, v)| v.to_string()).unwrap_or_default();
            let cls_val = attrs.iter().find(|(k, _)| *k == "class")
                .map(|(_, v)| v.to_string()).unwrap_or_default();
            let classes: Vec<String> = cls_val.split_whitespace().map(String::from).collect();
            let attr_map: HashMap<String, String> = attrs.iter()
                .map(|(k, v)| (k.to_string(), v.to_string())).collect();
            let tc = collect_text(dom, node_id);

            if *tag == "title" && title.is_empty() { title = tc.clone(); }
            if *tag == "body"  { body_idx = node_id.0 as i32; }
            if *tag == "html"  { html_idx = node_id.0 as i32; }
            if !id_val.is_empty() { id_index.insert(id_val.clone(), node_id.0); }

            let idx = node_id.0;
            if idx < elements.len() {
                elements[idx] = JsElement {
                    idx, tag: tag.to_string(), id: id_val, classes, attrs: attr_map,
                    text_content: tc,
                    children: node.children.iter().map(|c| c.0).collect(),
                    parent: node.parent.map(|p| p.0),
                };
            }
        }

        DomSnapshot { elements, id_index, body_idx, html_idx,
                      title, url: url.to_string(), csp: None }
    }
}

fn collect_text<'a>(dom: &Arena<'a>, id: NodeId) -> String {
    let node = dom.get(id);
    match &node.data {
        NodeData::Text(t) => t.to_string(),
        NodeData::Element { .. } => node.children.iter()
            .map(|c| collect_text(dom, *c)).collect::<Vec<_>>().join(""),
        NodeData::Document => String::new(),
    }
}

// ── DOM Mutations ─────────────────────────────────────────────

/// Cambio al DOM producido por código JavaScript.
#[derive(Debug, Clone)]
pub enum DomMutation {
    SetTextContent { elem_id: usize, text: String },
    SetInnerHTML   { elem_id: usize, html: String },
    SetStyle       { elem_id: usize, prop: String, value: String },
    SetAttribute   { elem_id: usize, name: String, value: String },
    AddClass       { elem_id: usize, cls: String },
    RemoveClass    { elem_id: usize, cls: String },
    AppendChild    { parent: usize, child: usize },
    CreateElement  { idx: usize, tag: String },
    /// Registro de un event listener sobre un elemento (emitido al llamar addEventListener).
    /// Permite al UI saber qué nodos tienen handlers activos.
    EventListener  { elem_id: usize, event_type: String },
    SetTitle       (String),
    Navigate       (String),
    ConsoleLog     (String),
}

// ── JS Runtime ────────────────────────────────────────────────

/// Runtime de JavaScript aislado — uno por tab.
/// Sandbox: 16 MB heap · 512 KB stack · sin acceso al filesystem.
pub struct JsRuntime {
    runtime: Runtime,
}

impl JsRuntime {
    pub fn new() -> Self {
        let runtime = Runtime::new().expect("QuickJS runtime");
        runtime.set_memory_limit(16 * 1024 * 1024);
        runtime.set_max_stack_size(512 * 1024);
        JsRuntime { runtime }
    }

    /// Ejecuta todos los scripts con acceso al DOM.
    /// Devuelve las mutaciones a aplicar en el siguiente repaint.
    pub fn execute_scripts(
        &self,
        scripts:  &[String],
        snapshot: &DomSnapshot,
    ) -> Vec<DomMutation> {
        if scripts.is_empty() { return vec![]; }

        let mutations = Arc::new(Mutex::new(Vec::<DomMutation>::new()));
        let elements  = Arc::new(Mutex::new(snapshot.elements.clone()));
        let id_index  = Arc::new(snapshot.id_index.clone());
        let title_st  = Arc::new(Mutex::new(snapshot.title.clone()));
        let url       = snapshot.url.clone();
        let body_idx  = snapshot.body_idx;
        let html_idx  = snapshot.html_idx;
        let csp       = Arc::new(snapshot.csp.clone());

        let ctx = match Context::full(&self.runtime) {
            Ok(c)  => c,
            Err(e) => { eprintln!("[orion-js] ctx error: {:?}", e); return vec![]; }
        };

        ctx.with(|ctx| -> rquickjs::Result<()> {
            let globals = ctx.globals();

            // ── console ───────────────────────────────────────
            register_console(&ctx, &globals, mutations.clone())?;

            // ── _orion_ namespace (raw Rust API) ──────────────
            let orion = build_orion_object(
                &ctx, mutations.clone(), elements, id_index,
                title_st, url, body_idx, html_idx, csp,
            )?;
            globals.set("_orion_", orion)?;

            // ── DOM bootstrap (document, window, fetch, setTimeout) ──
            ctx.eval::<(), _>(DOM_BOOTSTRAP)?;

            // ── Ejecutar scripts ──────────────────────────────
            for (i, script) in scripts.iter().enumerate() {
                if let Err(e) = ctx.eval::<(), _>(script.as_str()) {
                    eprintln!("[orion-js] Script {}: {:?}", i, e);
                }
            }

            // Ejecutar timers y disparar DOMContentLoaded/load
            let _ = ctx.eval::<(), _>(concat!(
                "if (typeof __runTimers === 'function') __runTimers();",
                "if (typeof __dispatch === 'function') {",
                "  __dispatch('document','DOMContentLoaded',null);",
                "  __dispatch('window','DOMContentLoaded',null);",
                "  __dispatch('window','load',null);",
                "}",
            ));

            // Drenar microtasks (Promises)
            loop {
                match self.runtime.execute_pending_job() {
                    Ok(true) => {}
                    _        => break,
                }
            }

            Ok(())
        }).ok();

        // Extraer mutaciones acumuladas
        match Arc::try_unwrap(mutations) {
            Ok(m) => m.into_inner().unwrap_or_default(),
            Err(m) => m.lock().unwrap().clone(),
        }
    }

    /// Dispara un evento sobre un elemento después de re-registrar los handlers.
    ///
    /// Flujo: re-ejecuta scripts (para registrar listeners) →
    ///        __dispatch(elem_id, event_type) → recoge mutaciones.
    ///
    /// Uso típico: el UI detecta un click en las coordenadas de un elemento
    /// y llama `runtime.execute_event(&scripts, &snapshot, elem_id, "click")`.
    pub fn execute_event(
        &self,
        scripts:    &[String],
        snapshot:   &DomSnapshot,
        elem_id:    i32,
        event_type: &str,
    ) -> Vec<DomMutation> {
        if scripts.is_empty() { return vec![]; }

        let mutations = Arc::new(Mutex::new(Vec::<DomMutation>::new()));
        let elements  = Arc::new(Mutex::new(snapshot.elements.clone()));
        let id_index  = Arc::new(snapshot.id_index.clone());
        let title_st  = Arc::new(Mutex::new(snapshot.title.clone()));
        let url       = snapshot.url.clone();
        let body_idx  = snapshot.body_idx;
        let html_idx  = snapshot.html_idx;
        let csp       = Arc::new(snapshot.csp.clone());

        let ctx = match Context::full(&self.runtime) {
            Ok(c)  => c,
            Err(e) => { eprintln!("[orion-js] execute_event ctx error: {:?}", e); return vec![]; }
        };

        ctx.with(|ctx| -> rquickjs::Result<()> {
            let globals = ctx.globals();
            register_console(&ctx, &globals, mutations.clone())?;

            let orion = build_orion_object(
                &ctx, mutations.clone(), elements, id_index,
                title_st, url, body_idx, html_idx, csp,
            )?;
            globals.set("_orion_", orion)?;
            ctx.eval::<(), _>(DOM_BOOTSTRAP)?;

            // Re-ejecutar scripts para que registren sus listeners
            for (i, script) in scripts.iter().enumerate() {
                if let Err(e) = ctx.eval::<(), _>(script.as_str()) {
                    eprintln!("[orion-js] execute_event script {}: {:?}", i, e);
                }
            }

            // Disparar el evento solicitado
            let dispatch = format!(
                "if (typeof __dispatch === 'function') __dispatch({}, '{}', null);",
                elem_id, event_type
            );
            let _ = ctx.eval::<(), _>(dispatch.as_str());

            // Drenar microtasks
            loop {
                match self.runtime.execute_pending_job() {
                    Ok(true) => {}
                    _        => break,
                }
            }
            Ok(())
        }).ok();

        match Arc::try_unwrap(mutations) {
            Ok(m) => m.into_inner().unwrap_or_default(),
            Err(m) => m.lock().unwrap().clone(),
        }
    }
}

// ── _orion_ object builder ────────────────────────────────────

/// Construye el objeto `_orion_` con todos los bindings Rust→JS.
/// Compartido entre `execute_scripts` y `execute_event`.
#[allow(clippy::too_many_arguments)]
fn build_orion_object<'js>(
    ctx:       &Ctx<'js>,
    mutations: Arc<Mutex<Vec<DomMutation>>>,
    elements:  Arc<Mutex<Vec<JsElement>>>,
    id_index:  Arc<HashMap<String, usize>>,
    title_st:  Arc<Mutex<String>>,
    url:       String,
    body_idx:  i32,
    html_idx:  i32,
    csp:       Arc<Option<crate::security::CspPolicy>>,
) -> rquickjs::Result<Object<'js>> {
    let orion = Object::new(ctx.clone())?;

    // byId(id) → i32
    {   let ix = id_index.clone();
        orion.set("byId", Function::new(ctx.clone(),
            move |id: String| -> rquickjs::Result<i32> {
                Ok(ix.get(&id).copied().map(|i| i as i32).unwrap_or(-1))
            })?)?;
    }

    // getText(idx) → String
    {   let e = elements.clone();
        orion.set("getText", Function::new(ctx.clone(),
            move |idx: i32| -> rquickjs::Result<String> {
                Ok(e.lock().unwrap().get(idx as usize)
                    .map(|el| el.text_content.clone()).unwrap_or_default())
            })?)?;
    }

    // setText(idx, text)
    {   let m = mutations.clone(); let e = elements.clone();
        orion.set("setText", Function::new(ctx.clone(),
            move |idx: i32, text: String| -> rquickjs::Result<()> {
                if let Some(el) = e.lock().unwrap().get_mut(idx as usize) {
                    el.text_content = text.clone();
                }
                m.lock().unwrap().push(DomMutation::SetTextContent {
                    elem_id: idx as usize, text });
                Ok(())
            })?)?;
    }

    // setHTML(idx, html)
    {   let m = mutations.clone();
        orion.set("setHTML", Function::new(ctx.clone(),
            move |idx: i32, html: String| -> rquickjs::Result<()> {
                m.lock().unwrap().push(DomMutation::SetInnerHTML {
                    elem_id: idx as usize, html });
                Ok(())
            })?)?;
    }

    // getTag / getId / getCls
    {   let e = elements.clone();
        orion.set("getTag", Function::new(ctx.clone(),
            move |idx: i32| -> rquickjs::Result<String> {
                Ok(e.lock().unwrap().get(idx as usize)
                    .map(|el| el.tag.clone()).unwrap_or_default())
            })?)?;
    }
    {   let e = elements.clone();
        orion.set("getId", Function::new(ctx.clone(),
            move |idx: i32| -> rquickjs::Result<String> {
                Ok(e.lock().unwrap().get(idx as usize)
                    .map(|el| el.id.clone()).unwrap_or_default())
            })?)?;
    }
    {   let e = elements.clone();
        orion.set("getCls", Function::new(ctx.clone(),
            move |idx: i32| -> rquickjs::Result<String> {
                Ok(e.lock().unwrap().get(idx as usize)
                    .map(|el| el.classes.join(" ")).unwrap_or_default())
            })?)?;
    }

    // setStyle(idx, prop, value)
    {   let m = mutations.clone();
        orion.set("setStyle", Function::new(ctx.clone(),
            move |idx: i32, prop: String, value: String| -> rquickjs::Result<()> {
                m.lock().unwrap().push(DomMutation::SetStyle {
                    elem_id: idx as usize, prop, value });
                Ok(())
            })?)?;
    }

    // addCls / removeCls
    {   let m = mutations.clone(); let e = elements.clone();
        orion.set("addCls", Function::new(ctx.clone(),
            move |idx: i32, cls: String| -> rquickjs::Result<()> {
                if let Some(el) = e.lock().unwrap().get_mut(idx as usize) {
                    if !el.classes.contains(&cls) { el.classes.push(cls.clone()); }
                }
                m.lock().unwrap().push(DomMutation::AddClass {
                    elem_id: idx as usize, cls });
                Ok(())
            })?)?;
    }
    {   let m = mutations.clone(); let e = elements.clone();
        orion.set("removeCls", Function::new(ctx.clone(),
            move |idx: i32, cls: String| -> rquickjs::Result<()> {
                if let Some(el) = e.lock().unwrap().get_mut(idx as usize) {
                    el.classes.retain(|c| c != &cls);
                }
                m.lock().unwrap().push(DomMutation::RemoveClass {
                    elem_id: idx as usize, cls });
                Ok(())
            })?)?;
    }

    // getAttr(idx, name) / setAttr(idx, name, value)
    {   let e = elements.clone();
        orion.set("getAttr", Function::new(ctx.clone(),
            move |idx: i32, name: String| -> rquickjs::Result<String> {
                Ok(e.lock().unwrap().get(idx as usize)
                    .and_then(|el| el.attrs.get(&name).cloned())
                    .unwrap_or_default())
            })?)?;
    }
    {   let m = mutations.clone(); let e = elements.clone();
        orion.set("setAttr", Function::new(ctx.clone(),
            move |idx: i32, name: String, value: String| -> rquickjs::Result<()> {
                if let Some(el) = e.lock().unwrap().get_mut(idx as usize) {
                    el.attrs.insert(name.clone(), value.clone());
                }
                m.lock().unwrap().push(DomMutation::SetAttribute {
                    elem_id: idx as usize, name, value });
                Ok(())
            })?)?;
    }

    // qs / qsa
    {   let e = elements.clone();
        orion.set("qs", Function::new(ctx.clone(),
            move |_parent: i32, sel: String| -> rquickjs::Result<i32> {
                Ok(simple_query(&e.lock().unwrap(), &sel))
            })?)?;
    }
    {   let e = elements.clone();
        orion.set("qsa", Function::new(ctx.clone(),
            move |_parent: i32, sel: String| -> rquickjs::Result<Vec<i32>> {
                Ok(simple_query_all(&e.lock().unwrap(), &sel))
            })?)?;
    }

    // createElement
    {   let m = mutations.clone(); let e = elements.clone();
        orion.set("create", Function::new(ctx.clone(),
            move |tag: String| -> rquickjs::Result<i32> {
                let mut elems = e.lock().unwrap();
                let idx = elems.len();
                elems.push(JsElement {
                    idx, tag: tag.clone(),
                    id: String::new(), classes: vec![],
                    attrs: HashMap::new(), text_content: String::new(),
                    children: vec![], parent: None,
                });
                m.lock().unwrap().push(DomMutation::CreateElement { idx, tag });
                Ok(idx as i32)
            })?)?;
    }

    // title get/set
    {   let t = title_st.clone();
        orion.set("getTitle", Function::new(ctx.clone(),
            move || -> rquickjs::Result<String> { Ok(t.lock().unwrap().clone()) })?)?;
    }
    {   let t = title_st.clone(); let m = mutations.clone();
        orion.set("setTitle", Function::new(ctx.clone(),
            move |title: String| -> rquickjs::Result<()> {
                *t.lock().unwrap() = title.clone();
                m.lock().unwrap().push(DomMutation::SetTitle(title));
                Ok(())
            })?)?;
    }

    // body() / html() / url()
    orion.set("body", Function::new(ctx.clone(),
        move || -> rquickjs::Result<i32> { Ok(body_idx) })?)?;
    orion.set("html", Function::new(ctx.clone(),
        move || -> rquickjs::Result<i32> { Ok(html_idx) })?)?;
    {   let u = url.clone();
        orion.set("url", Function::new(ctx.clone(),
            move || -> rquickjs::Result<String> { Ok(u.clone()) })?)?;
    }

    // navigate(url)
    {   let m = mutations.clone();
        orion.set("navigate", Function::new(ctx.clone(),
            move |url: String| -> rquickjs::Result<()> {
                m.lock().unwrap().push(DomMutation::Navigate(url));
                Ok(())
            })?)?;
    }

    // appendChild(parent, child)
    {   let m = mutations.clone();
        orion.set("appendChild", Function::new(ctx.clone(),
            move |parent: i32, child: i32| -> rquickjs::Result<()> {
                m.lock().unwrap().push(DomMutation::AppendChild {
                    parent: parent as usize, child: child as usize });
                Ok(())
            })?)?;
    }

    // fetchSyncJson(url) — verifica CSP connect-src
    {   let c = csp.clone();
        orion.set("fetchSyncJson", Function::new(ctx.clone(),
            move |url: String| -> rquickjs::Result<String> {
                if let Some(policy) = c.as_ref() {
                    if !policy.allows_connect(&url) {
                        return Ok(r#"{"ok":false,"status":0,"body":"","error":"CSP connect-src blocked"}"#.into());
                    }
                }
                Ok(fetch_sync_json(&url))
            })?)?;
    }

    // addListener(idx, type) — notifica a Rust qué elementos tienen handlers
    {   let m = mutations.clone();
        orion.set("addListener", Function::new(ctx.clone(),
            move |idx: i32, event_type: String| -> rquickjs::Result<()> {
                if idx >= 0 {
                    m.lock().unwrap().push(DomMutation::EventListener {
                        elem_id: idx as usize, event_type,
                    });
                }
                Ok(())
            })?)?;
    }

    Ok(orion)
}

// ── Console ───────────────────────────────────────────────────

fn register_console<'js>(
    ctx:       &Ctx<'js>,
    globals:   &Object<'js>,
    mutations: Arc<Mutex<Vec<DomMutation>>>,
) -> rquickjs::Result<()> {
    let console = Object::new(ctx.clone())?;

    macro_rules! log_fn {
        ($level:literal) => {{
            let m = mutations.clone();
            Function::new(ctx.clone(), move |args: Rest<Value>| -> rquickjs::Result<()> {
                let msg = args.0.iter().map(js_val_str).collect::<Vec<_>>().join(" ");
                eprintln!("[JS {}] {}", $level, msg);
                m.lock().unwrap().push(DomMutation::ConsoleLog(
                    format!("[{}] {}", $level, msg)));
                Ok(())
            })?
        }};
    }

    console.set("log",   log_fn!("LOG"))?;
    console.set("warn",  log_fn!("WARN"))?;
    console.set("error", log_fn!("ERROR"))?;
    console.set("debug", log_fn!("DEBUG"))?;
    console.set("info",  log_fn!("INFO"))?;
    globals.set("console", console)?;
    Ok(())
}

fn js_val_str(v: &Value) -> String {
    if v.is_null()      { return "null".into(); }
    if v.is_undefined() { return "undefined".into(); }
    if let Some(s) = v.as_string() {
        return s.to_string().unwrap_or_else(|_| "[string]".into());
    }
    if let Some(n) = v.as_int()   { return n.to_string(); }
    if let Some(f) = v.as_float() { return f.to_string(); }
    if let Some(b) = v.as_bool()  { return b.to_string(); }
    "[object]".into()
}

// ── querySelector helpers ─────────────────────────────────────

fn parse_selector(sel: &str) -> (Option<String>, Option<String>, Option<String>) {
    let s = sel.trim();
    if s.starts_with('#') { return (None, Some(s[1..].into()), None); }
    if s.starts_with('.') { return (None, None, Some(s[1..].into())); }
    if let Some(p) = s.find('.') {
        return (Some(s[..p].into()), None, Some(s[p+1..].into()));
    }
    if let Some(p) = s.find('#') {
        return (Some(s[..p].into()), Some(s[p+1..].into()), None);
    }
    (Some(s.into()), None, None)
}

fn matches_sel(el: &JsElement, tag: &Option<String>, id: &Option<String>, cls: &Option<String>) -> bool {
    if el.tag.is_empty() { return false; }
    tag.as_ref().map_or(true, |t| el.tag == *t)
        && id.as_ref().map_or(true, |i| el.id == *i)
        && cls.as_ref().map_or(true, |c| el.classes.iter().any(|ec| ec == c))
}

fn simple_query(elements: &[JsElement], sel: &str) -> i32 {
    let (tag, id, cls) = parse_selector(sel);
    elements.iter().find(|el| matches_sel(el, &tag, &id, &cls))
        .map(|el| el.idx as i32).unwrap_or(-1)
}

fn simple_query_all(elements: &[JsElement], sel: &str) -> Vec<i32> {
    let (tag, id, cls) = parse_selector(sel);
    elements.iter().filter(|el| matches_sel(el, &tag, &id, &cls))
        .map(|el| el.idx as i32).collect()
}

// ── fetch sincrónico ──────────────────────────────────────────

fn fetch_sync_json(url: &str) -> String {
    // Bloquear fetch no-HTTPS (excepto localhost)
    if !url.starts_with("https://") && !url.starts_with("http://localhost") {
        return r#"{"ok":false,"status":0,"body":"","error":"Non-HTTPS blocked"}"#.into();
    }

    // Bloquear trackers/ads vía SecurityLayer
    if crate::security::is_blocked(url) {
        return r#"{"ok":false,"status":0,"body":"","error":"Blocked by ad/tracker filter"}"#.into();
    }

    let client = match reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .user_agent("OrionBrowser/1.0")
        .build()
    {
        Ok(c)  => c,
        Err(e) => return format!(r#"{{"ok":false,"status":0,"body":"","error":"client: {}"}}"#, e),
    };

    match client.get(url).send() {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let ok     = resp.status().is_success();
            match resp.text() {
                Ok(body) => {
                    let body_escaped = body
                        .replace('\\', "\\\\")
                        .replace('"',  "\\\"")
                        .replace('\n', "\\n")
                        .replace('\r', "\\r");
                    format!(r#"{{"ok":{ok},"status":{status},"body":"{body_escaped}","error":""}}"#)
                }
                Err(e) => format!(
                    r#"{{"ok":false,"status":{status},"body":"","error":"decode: {}"}}"#, e
                ),
            }
        }
        Err(e) => format!(r#"{{"ok":false,"status":0,"body":"","error":"{}"}}"#, e),
    }
}

// ── DOM Bootstrap JS ──────────────────────────────────────────

const DOM_BOOTSTRAP: &str = r#"
(function(orion) {
  'use strict';
  function str(v) { return v == null ? '' : String(v); }

  // ── Event registry ────────────────────────────────────────
  // Clave: "<target>:<type>"  donde target es número (elem_id),
  // "document" o "window".
  var _evts = {};

  function _regEvt(target, type, fn) {
    var k = String(target) + ':' + type;
    if (!_evts[k]) _evts[k] = [];
    _evts[k].push(fn);
    // Notificar a Rust sólo para elementos reales
    if (typeof target === 'number' && target >= 0) {
      orion.addListener(target, type);
    }
  }
  function _unregEvt(target, type, fn) {
    var k = String(target) + ':' + type;
    if (_evts[k]) _evts[k] = _evts[k].filter(function(f) { return f !== fn; });
  }

  // __dispatch puede invocarse desde Rust (execute_event) o desde JS
  globalThis.__dispatch = function(target, type, detail) {
    var k = String(target) + ':' + type;
    var fns = _evts[k] || [];
    var evt = {
      type: type,
      detail: detail || null,
      preventDefault:  function() {},
      stopPropagation: function() {}
    };
    for (var i = 0; i < fns.length; i++) {
      try { fns[i](evt); } catch(e) { console.error('Event ' + type + ':', String(e)); }
    }
  };

  // ── Elemento DOM ─────────────────────────────────────────
  function makeElement(idx) {
    if (idx == null || idx < 0) return null;
    var e = { __idx: idx };
    var _tc = orion.getText(idx);

    Object.defineProperty(e, 'textContent', {
      get: function() { return _tc; },
      set: function(v) { _tc = str(v); orion.setText(idx, str(v)); },
      enumerable: true, configurable: true
    });
    Object.defineProperty(e, 'innerHTML', {
      get: function() { return _tc; },
      set: function(v) { orion.setHTML(idx, str(v)); _tc = str(v); },
      enumerable: true, configurable: true
    });

    e.tagName   = orion.getTag(idx).toUpperCase();
    e.id        = orion.getId(idx);
    e.className = orion.getCls(idx);

    e.style = new Proxy({}, {
      set: function(t, k, v) { t[k] = v; orion.setStyle(idx, str(k), str(v)); return true; }
    });

    e.classList = {
      _c: orion.getCls(idx).split(' ').filter(Boolean),
      add:      function(c) { orion.addCls(idx, c);    this._c.push(c); },
      remove:   function(c) { orion.removeCls(idx, c); this._c = this._c.filter(function(x){return x!==c;}); },
      contains: function(c) { return this._c.indexOf(c) >= 0; },
      toggle:   function(c) { if(this.contains(c)) this.remove(c); else this.add(c); }
    };

    e.getAttribute    = function(n)    { return orion.getAttr(idx, n) || null; };
    e.setAttribute    = function(n, v) { orion.setAttr(idx, n, str(v)); };
    e.appendChild     = function(ch)   { if(ch && ch.__idx != null) orion.appendChild(idx, ch.__idx); };
    e.querySelector   = function(s)    { return makeElement(orion.qs(idx, s)); };
    e.querySelectorAll= function(s)    { return orion.qsa(idx, s).map(makeElement); };
    e.click           = function()     { __dispatch(idx, 'click', null); };
    e.addEventListener    = function(type, fn) { _regEvt(idx, type, fn); };
    e.removeEventListener = function(type, fn) { _unregEvt(idx, type, fn); };
    e.dispatchEvent       = function(ev)       { __dispatch(idx, ev.type, ev.detail || null); };
    return e;
  }

  // ── document ─────────────────────────────────────────────
  globalThis.document = {
    getElementById:       function(id)  { return makeElement(orion.byId(id)); },
    querySelector:        function(sel) { return makeElement(orion.qs(-1, sel)); },
    querySelectorAll:     function(sel) { return orion.qsa(-1, sel).map(makeElement); },
    createElement:        function(tag) { return makeElement(orion.create(tag)); },
    createTextNode:       function(t)   { return { textContent: t, nodeType: 3, __idx: -1 }; },
    addEventListener:     function(type, fn) { _regEvt('document', type, fn); },
    removeEventListener:  function(type, fn) { _unregEvt('document', type, fn); },
    dispatchEvent:        function(ev)       { __dispatch('document', ev.type, ev.detail || null); },
    get title() { return orion.getTitle(); },
    set title(v) { orion.setTitle(str(v)); },
    get body()   { return makeElement(orion.body()); },
    get documentElement() { return makeElement(orion.html()); }
  };

  // ── window ───────────────────────────────────────────────
  var _timers = [];
  globalThis.window = {
    location: { href: orion.url() },
    document: document,
    setTimeout:           function(fn, ms) { _timers.push(fn); return _timers.length - 1; },
    setInterval:          function()       { return 0; },
    clearTimeout:         function() {},
    clearInterval:        function() {},
    addEventListener:     function(type, fn) { _regEvt('window', type, fn); },
    removeEventListener:  function(type, fn) { _unregEvt('window', type, fn); },
    dispatchEvent:        function(ev)       { __dispatch('window', ev.type, ev.detail || null); }
  };
  globalThis.setTimeout  = window.setTimeout;
  globalThis.setInterval = window.setInterval;
  globalThis.clearTimeout  = window.clearTimeout;
  globalThis.clearInterval = window.clearInterval;
  globalThis.location    = window.location;

  // ── fetch ────────────────────────────────────────────────
  globalThis.fetch = function(url) {
    var r = JSON.parse(orion.fetchSyncJson(str(url)));
    var resp = {
      ok: r.ok, status: r.status,
      text: function() { return Promise.resolve(r.body || ''); },
      json: function() { return Promise.resolve(JSON.parse(r.body || '{}')); }
    };
    return {
      then:  function(fn) { try { fn(resp); } catch(e) {} return this; },
      catch: function()   { return this; }
    };
  };

  // ── Timers ───────────────────────────────────────────────
  globalThis.__runTimers = function() {
    var q = _timers.splice(0);
    for (var i = 0; i < q.length; i++) {
      try { q[i](); } catch(e) { console.error('Timer:', String(e)); }
    }
  };

}(_orion_));
"#;

// ── Script extraction ─────────────────────────────────────────

/// Extrae el contenido de todos los <script> sin atributo src.
pub fn extract_scripts<'a>(dom: &Arena<'a>) -> Vec<String> {
    let mut scripts = Vec::new();
    for (_, node) in dom.iter() {
        let NodeData::Element { tag, attrs } = &node.data else { continue };
        if *tag != "script" { continue; }
        if attrs.iter().any(|(k, _)| *k == "src") { continue; }
        let text: String = node.children.iter()
            .filter_map(|c| match &dom.get(*c).data {
                NodeData::Text(t) => Some(t.to_string()),
                _                 => None,
            }).collect::<Vec<_>>().join("");
        if !text.trim().is_empty() { scripts.push(text); }
    }
    scripts
}

// ── Apply mutations → display list ───────────────────────────

/// Aplica mutaciones de texto/estilo sobre la display list generada.
///
/// - `SetTextContent` reemplaza texto existente en DrawText por elem_id.
/// - `CreateElement` + `AppendChild` + `SetTextContent` generan nuevos
///   DrawText al final del documento para nodos creados dinámicamente por JS.
pub fn apply_mutations(commands: &mut Vec<DisplayCommand>, mutations: &[DomMutation]) {
    // ── Paso 1: parchear texto de nodos existentes ────────────
    for m in mutations {
        let DomMutation::SetTextContent { elem_id, text } = m else { continue };
        let mut replaced = false;
        for cmd in commands.iter_mut() {
            if let DisplayCommand::DrawText { text: cmd_text, elem_id: cid, .. } = cmd {
                if *cid == *elem_id {
                    if !replaced {
                        *cmd_text = text.clone();
                        replaced = true;
                    } else {
                        *cmd_text = String::new();
                    }
                }
            }
        }
        commands.retain(|cmd| {
            if let DisplayCommand::DrawText { text, .. } = cmd { !text.is_empty() } else { true }
        });
    }

    // ── Paso 2: renderizar nodos creados con createElement ────
    let created: std::collections::HashSet<usize> = mutations.iter()
        .filter_map(|m| if let DomMutation::CreateElement { idx, .. } = m { Some(*idx) } else { None })
        .collect();
    if created.is_empty() { return; }

    // Texto asignado a cada nodo creado
    let mut created_text: HashMap<usize, String> = HashMap::new();
    for m in mutations {
        if let DomMutation::SetTextContent { elem_id, text } = m {
            if created.contains(elem_id) && !text.trim().is_empty() {
                created_text.insert(*elem_id, text.clone());
            }
        }
    }

    // Posición Y más baja del documento actual
    let max_y = commands.iter()
        .filter_map(|cmd| match cmd {
            DisplayCommand::DrawText { y, font_size, .. } => Some(*y + *font_size),
            DisplayCommand::FillRect { rect, .. }         => Some(rect.y + rect.height),
            _                                             => None,
        })
        .fold(0.0f32, f32::max);

    // Por cada AppendChild que conecte un nodo creado, emitir DrawText
    let mut next_y = max_y + 4.0; // pequeño gap
    for m in mutations {
        let DomMutation::AppendChild { parent: _, child } = m else { continue };
        if !created.contains(child) { continue; }
        let text = match created_text.get(child) {
            Some(t) => t.clone(),
            None    => continue,
        };

        // X: margen del body por defecto
        let x = commands.iter()
            .find_map(|cmd| if let DisplayCommand::DrawText { x, .. } = cmd { Some(*x) } else { None })
            .unwrap_or(8.0);

        const FONT_SIZE: f32 = 16.0;
        commands.push(DisplayCommand::DrawText {
            text,
            x,
            y:         next_y,
            font_size: FONT_SIZE,
            color:     crate::style::Color { r: 0, g: 0, b: 0, a: 255 },
            elem_id:   *child,
        });
        next_y += FONT_SIZE + 4.0;
    }
}
