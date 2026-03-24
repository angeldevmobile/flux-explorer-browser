// ============================================================
//  ORION RENDER — Fase 5+6: JS + Seguridad
//
//  Stack: winit 0.29 + softbuffer 0.4 + fontdue 0.8 + QuickJS
//  Pipeline: HTML → CSS → JS → mutations → layout → paint
//
//  Uso:
//    cargo run --bin orion-render
//    ORION_FONT=/ruta/fuente.ttf cargo run --bin orion-render
// ============================================================

use std::num::NonZeroU32;
use std::rc::Rc;

use winit::{
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoop},
    window::WindowBuilder,
};

use orion_engine::{
    run_pipeline_with_url,
    renderer::{font, OrionSoftRenderer},
    security::{SecurityLayer, is_blocked, hsts_should_upgrade},
};

const DEMO_HTML: &str = r#"<!DOCTYPE html>
<html>
<head>
  <style>
    body { background-color: #f0f4f8; color: #1a202c; font-size: 16px; }
    h1   { color: #2b6cb0; font-size: 26px; margin: 20px 16px 6px; }
    h2   { color: #2d3748; font-size: 18px; margin: 14px 16px 4px; }
    p    { margin: 6px 16px; line-height: 1.6; }
    .card   { background-color: #ffffff; border-style: solid; border-width: 1px;
              border-color: #cbd5e0; padding: 14px; margin: 10px 16px; }
    .green  { color: #276749; }
    .red    { color: #c53030; }
    .blue   { color: #2b6cb0; }
    .purple { color: #6b46c1; }
    .muted  { color: #718096; font-size: 13px; }
    .bold   { font-size: 15px; }
    .ok     { color: #276749; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Orion Engine — Fase 5+6</h1>
  <p class="muted">QuickJS + seguridad. Sin WebView2.</p>

  <div class="card">
    <h2>JavaScript activo</h2>
    <p id="js-status">JavaScript NO disponible</p>
    <p id="js-dom">DOM API: no probado</p>
    <p id="js-timer">setTimeout: no probado</p>
  </div>

  <div class="card">
    <h2>Seguridad — Fase 6</h2>
    <p class="green">HTTPS-only mode activo.</p>
    <p class="green">Ad/tracker blocker activo.</p>
    <p class="green">HSTS preload list activa.</p>
    <p class="green">CSP enforcement listo.</p>
    <p class="green">JS sandbox: 16MB heap, 512KB stack.</p>
  </div>

  <div class="card">
    <h2>CSS Cascade</h2>
    <p>Selectores type, class, id, descendant.</p>
    <p class="purple" style="font-size: 14px;">Inline style override en accion.</p>
  </div>

  <p class="muted" id="footer">Orion Engine — motor propio sin dependencias externas.</p>

  <script>
    // Fase 5: JS modifica el DOM en tiempo de render
    console.log('Orion JS runtime activo.');

    var statusEl = document.getElementById('js-status');
    if (statusEl) {
      statusEl.textContent = 'JavaScript OK — QuickJS ' + typeof Object;
    }

    var domEl = document.getElementById('js-dom');
    if (domEl) {
      var tag = domEl.tagName || 'unknown';
      domEl.textContent = 'DOM API: querySelector + textContent OK (' + tag + ')';
    }

    setTimeout(function() {
      var timerEl = document.getElementById('js-timer');
      if (timerEl) {
        timerEl.textContent = 'setTimeout: OK — ejecutado sincrono';
      }
    }, 0);

    // querySelectorAll demo
    var cards = document.querySelectorAll('.card');
    console.log('Cards encontrados: ' + cards.length);

    // document.title
    document.title = 'Orion — Fase 5+6 activa';
    console.log('title cambiado a: ' + document.title);
  </script>
</body>
</html>"#;

fn main() {
    // Fase 6: demo de seguridad en consola
    let security = SecurityLayer::new();
    println!("[orion-security] Ad blocker: {}",
        if is_blocked("https://doubleclick.net/ads") { "activo OK" } else { "fallo" });
    println!("[orion-security] HSTS preload: {}",
        if hsts_should_upgrade("github.com") { "activo OK" } else { "fallo" });
    drop(security);

    // 1. Pipeline HTML → JS → display list
    let commands = run_pipeline_with_url(DEMO_HTML, "about:blank");
    println!("[orion-render] {} display commands", commands.len());

    // 2. Fuente del sistema
    let font_data = font::load_system_font();
    let fnt       = font::build_font(&font_data);
    let mut renderer = OrionSoftRenderer::new(fnt);

    // 3. Ventana winit
    let event_loop = EventLoop::new().expect("EventLoop");
    let window = Rc::new(
        WindowBuilder::new()
            .with_title("Orion Engine — Fase 5+6")
            .with_inner_size(winit::dpi::LogicalSize::new(900u32, 720u32))
            .with_resizable(true)
            .build(&event_loop)
            .expect("Window"),
    );

    // 4. softbuffer context + surface
    let context = softbuffer::Context::new(window.clone())
        .expect("softbuffer Context");
    let mut surface = softbuffer::Surface::new(&context, window.clone())
        .expect("softbuffer Surface");

    // 5. Event loop — winit 0.29 API: closure recibe (event, &EventLoopWindowTarget)
    event_loop.run(move |event, elwt| {
        elwt.set_control_flow(ControlFlow::Wait);

        match event {
            // Cierre
            Event::WindowEvent { event: WindowEvent::CloseRequested, .. } => {
                println!("[orion-render] Cerrando.");
                elwt.exit();
            }

            // Teclado — Escape para salir
            Event::WindowEvent {
                event: WindowEvent::KeyboardInput { event: ref key_ev, .. }, ..
            } => {
                use winit::keyboard::{Key, NamedKey};
                if key_ev.logical_key == Key::Named(NamedKey::Escape) {
                    elwt.exit();
                }
            }

            // Redimensionado → pedir redibujado
            Event::WindowEvent { event: WindowEvent::Resized(_), .. } => {
                window.request_redraw();
            }

            // Redibujado — aquí rasterizamos
            Event::WindowEvent { event: WindowEvent::RedrawRequested, .. } => {
                let size = window.inner_size();
                let w = size.width;
                let h = size.height;
                if w == 0 || h == 0 { return; }

                surface
                    .resize(NonZeroU32::new(w).unwrap(), NonZeroU32::new(h).unwrap())
                    .expect("resize");

                let mut buf = surface.buffer_mut().expect("buffer_mut");
                renderer.render(&commands, buf.as_mut(), w as usize, h as usize);
                buf.present().expect("present");
            }

            // Listo para el siguiente frame — solicitar redibujado continuo
            Event::AboutToWait => {
                window.request_redraw();
            }

            _ => {}
        }
    }).expect("event_loop.run");
}
