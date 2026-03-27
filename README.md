<div align="center">

# Flux Browser

**Navegador web construido desde cero con motor propio en Rust, UI en React y backend Node.js**

[![Rust](https://img.shields.io/badge/Rust-2021-orange?logo=rust)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0--beta.1-cyan)](https://github.com)

[Arquitectura](#arquitectura) · [Motor Rust](#flux-engine) · [Búsqueda](#flux-search) · [Backend](#flux-backend) · [Instalación](#instalación-beta-pública) · [Roadmap](#roadmap)

</div>

---

## ¿Qué es Flux?

Flux es un navegador web construido desde cero en Rust. Su núcleo — **flux-engine** — implementa un pipeline completo de renderizado HTML/CSS, un motor JavaScript ligero basado en QuickJS, y una capa de seguridad propia.

### El motor propio existe y funciona hoy

El pipeline de renderizado está construido y operativo:

```
HTML → Tokenizer → DOM → CSS Cascade → Layout → Display List → FluxSoftRenderer → píxeles
```

Cada paso es código Rust propio. El **FluxSoftRenderer** es el último paso del motor: toma el display list y pinta píxeles reales en un buffer de memoria (XRGB8888). Puedes verlo funcionando ahora mismo:

```bash
cargo run --bin flux-render   # abre una ventana con el motor propio renderizando
```

### ¿Por qué las páginas web todavía pasan por WebView2?

El motor existe. Lo que aún falta es **el cable que lo conecta al browser**: cuando el usuario navega a `https://ejemplo.com`, en lugar de pasarle la URL a WebView2, pasársela al pipeline propio y mostrar los píxeles resultantes en la ventana del browser.

Ese paso es el siguiente en el roadmap. Mientras tanto, WebView2 actúa como superficie provisional — garantiza compatibilidad total con la web moderna mientras el motor propio madura.

> El motor es el cerebro. WebView2 es la pantalla provisional, no el motor.

Es la misma estrategia que usó Brave al arrancar: primero construyes el valor real (privacidad, búsqueda, seguridad, UX), luego conectas tu propio renderer cuando está listo. Cuando ese cable esté hecho, Flux será uno de los pocos browsers con motor de píxeles escrito en Rust — sin Blink, sin WebKit, sin código C++.

La búsqueda corre sobre **Flux Search**: agrega resultados de múltiples fuentes via SearXNG self-hosted y los re-rankea con BM25 propio. Sin Google. Sin Bing. Sin dependencias externas.

---

## Por qué esta arquitectura

Los navegadores más exitosos no construyeron su propio motor de renderizado completo desde el día 1 — construyeron su valor por encima de uno existente:

| Browser | Su engine propio (el valor real) | Superficie de render |
|---|---|---|
| **Brave** | Ad blocking · Rewards · Privacy | Chromium (Blink) |
| **Arc** | Spaces · AI · UX innovador | Chromium |
| **Firefox Focus** | Privacy core · Tracking protection | WebKit |
| **Flux** | Motor Rust propio · Search · Privacy · BM25 · JS sandbox · CSP | WebView2 / WebKit |

El 70% de las vulnerabilidades de Chrome y Firefox son errores de memoria en C++. Rust los elimina en compile time. El engine de Flux es seguro por construcción.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        FLUX BROWSER                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              chrome_view  (WebView2/WebKit)              │   │
│  │         React UI — tabs · barra · settings · search      │   │
│  └─────────────────────────┬────────────────────────────────┘   │
│                            │  IPC (wry)                         │
│  ┌─────────────────────────▼────────────────────────────────┐   │
│  │            content_view  (WebView2/WebKit)               │   │
│  │         Renderiza páginas web externas http(s)://        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                FLUX ENGINE  (Rust) :4000                │   │
│  │                                                          │   │
│  │  HTML/CSS Pipeline          JavaScript (QuickJS)         │   │
│  │  ┌──────────────┐           ┌──────────────────────┐     │   │
│  │  │  Tokenizer   │           │  rquickjs sandbox    │     │   │
│  │  │  DOM arena   │           │  DOM bindings        │     │   │
│  │  │  CSS cascade │           │  fetch() real HTTPS  │     │   │
│  │  │  Inline layout│          │  addEventListener    │     │   │
│  │  │  Word wrap   │           │  DOMContentLoaded    │     │   │
│  │  │  Display list│           └──────────────────────┘     │   │
│  │  │  Soft renderer│                                        │   │
│  │  │  Glyph atlas │          Security Layer                │   │
│  │  └──────────────┘          ┌──────────────────────┐     │   │
│  │                            │  CSP enforcement     │     │   │
│  │  Search & Ranking          │  HTTPS-only mode     │     │   │
│  │  ┌──────────────┐          │  HSTS preload list   │     │   │
│  │  │  BM25 ranker │          │  Ad/tracker blocker  │     │   │
│  │  │  Fetcher     │          │  JS memory sandbox   │     │   │
│  │  │  Extractor   │          └──────────────────────┘     │   │
│  │  └──────────────┘                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         flux-backend.exe  (sidecar, auto) :3000          │   │
│  │    Historia · Tabs · Bookmarks · Auth · Gemini IA         │   │
│  └─────────────────────────┬────────────────────────────────┘   │
│                            ▼                                    │
│                    SQLite  (flux.db local)                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              SearXNG  (opcional, Docker) :8080           │   │
│  │      DuckDuckGo · Brave Search · Wikipedia · más         │   │
│  │         (si no está disponible, usa DuckDuckGo)          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## flux-engine

El núcleo de Flux. Escrito completamente en Rust. No usa Electron, no usa Chromium, no usa Node.js.

### Pipeline HTML/CSS/JS

```
URL
 └─→ Fetcher (reqwest + rustls)
      ├─→ SecurityLayer.check_url()
      │     · HTTPS upgrade (HSTS preload)
      │     · Ad/tracker block
      │     · CSP del servidor
      └─→ HTML
           └─→ Tokenizer  (zero-copy, &str sin allocar)
                └─→ Parser  (DOM arena — Vec<Node> + NodeId)
                     ├─→ CSS Cascade  (especificidad, herencia, UA stylesheet)
                     ├─→ JS Runtime  (QuickJS sandbox)
                     │     · DOM bindings completos
                     │     · fetch() real HTTPS + CSP connect-src
                     │     · addEventListener / DOMContentLoaded / load
                     │     · createElement / appendChild funcional
                     │     · Sandbox: 16 MB heap · 512 KB stack
                     └─→ Layout Engine
                          · Block formatting context
                          · Inline formatting context + word wrapping
                          · text-align (left/center/right)
                          └─→ Display List (paint commands)
                               └─→ OrionSoftRenderer
                                    · Pixel buffer XRGB8888
                                    · Glyph atlas (fontdue cache)
                                    · Alpha blending
                                    · softbuffer (DXGI/Metal)
```

### Fases del motor completadas

| Fase | Componente | Estado |
|---|---|---|
| 1 | Tokenizer zero-copy + Parser DOM arena | 
| 2 | Style resolution + UA stylesheet completo | 
| 3 | Inline layout + word wrapping + text-align | 
| 4 | OrionSoftRenderer — pixel buffer real con fontdue | 
| 5 | JavaScript con QuickJS — DOM bindings + fetch + eventos | 
| 6 | Security layer — CSP + HTTPS-only + HSTS + ad blocker | 
| 7 | Descargador de medios — yt-dlp bundleado con progreso en tiempo real | 
| 8 | Mute por pestaña — control de audio vía IPC | 
### JavaScript (Fase 5)

Motor JS ligero basado en **rquickjs** (QuickJS embebido en Rust, ~10 MB vs ~100 MB de V8).

**APIs implementadas:**
- `document.getElementById / querySelector / querySelectorAll`
- `document.createElement / appendChild` — nodos dinámicos reales
- `element.textContent / innerHTML / style / classList`
- `element.getAttribute / setAttribute`
- `addEventListener / removeEventListener / dispatchEvent`
- `window.setTimeout` (síncrono al final del script)
- `fetch()` — request HTTPS real con bloqueo CSP `connect-src`
- `console.log/warn/error/debug/info`
- Auto-fire `DOMContentLoaded` + `load` al terminar los scripts

**Seguridad del sandbox:**
- 16 MB heap máximo
- 512 KB stack máximo
- Sin acceso al filesystem
- `fetch()` bloqueado para HTTP no-HTTPS
- `fetch()` bloqueado por CSP `connect-src` del servidor

### Seguridad (Fase 6)

| Feature | Implementación |
|---|---|
| HTTPS-only | Upgrade automático HTTP → HTTPS en todas las requests |
| HSTS preload | Lista embebida de 20+ dominios de alto tráfico |
| CSP enforcement | Parseo de `Content-Security-Policy` del servidor · bloqueo inline scripts · bloqueo `connect-src` en JS fetch |
| Ad/tracker blocker | Lista de ~40 dominios conocidos (EasyList/EasyPrivacy subset) |
| JS sandbox | QuickJS con límites de memoria estrictos por tab |
| URL security | Validación pre-request en fetcher y en JS |

### Decisiones de memoria

| Técnica | Beneficio |
|---|---|
| `&'a str` en tokens y DOM | 0 copias del HTML fuente |
| `Vec<Node>` arena + `NodeId(usize)` | Sin `Box`/`Rc`, cache-friendly, sin fragmentación |
| `SmallVec<[Attr; 4]>` | Atributos en stack si son ≤ 4 |
| `ComputedStyle` plano | Sin heap, cache-line friendly |
| `LayoutBox` Vec contiguo | Sin overhead por nodo |

### Seguridad por diseño (Rust vs C++)

| Vulnerabilidad | C/C++ (Chrome/Firefox) | Rust (Flux) |
|---|---|---|
| Buffer overflow | Posible | Imposible en safe Rust |
| Use-after-free | Posible | Imposible — borrow checker |
| Null pointer | Posible | Imposible — no hay null |
| Data races | Posible | Imposible en compile time |

### Estructura del engine

```
flux-engine/
├── Cargo.toml
├── build.rs            ← copia yt-dlp.exe y flux-backend.exe al compilar
├── bin/
│   └── yt-dlp.exe      ← descargado con scripts/download-yt-dlp.ps1
└── src/
    ├── lib.rs              ← run_pipeline() / run_pipeline_with_security()
    ├── main.rs             ← entry point + servidor Axum :4000
    ├── bin/
    │   ├── browser.rs      ← ventana nativa (tao + wry) + sidecar backend
    │   └── render.rs       ← demo del renderer de píxeles
    ├── api/                ← endpoints HTTP (POST /process, GET /health)
    ├── fetcher/            ← reqwest HTTP client + SecurityLayer
    ├── parsing/
    │   ├── tokenizer.rs    ← zero-copy HTML tokenizer
    │   └── parser.rs       ← tokens → DOM arena
    ├── dom/                ← Vec<Node> arena + NodeId
    ├── style/
    │   ├── mod.rs          ← ComputedStyle + StyleMap
    │   ├── css.rs          ← parser CSS (colores, longitudes, propiedades)
    │   ├── cascade.rs      ← resolución de especificidad + herencia
    │   └── ua.rs           ← UA stylesheet completo (h1-h6, p, ul, table...)
    ├── layout/
    │   ├── mod.rs          ← block formatting context
    │   └── inline.rs       ← inline layout + word wrap + text-align
    ├── paint/              ← display list de comandos
    ├── renderer/
    │   ├── mod.rs          ← ConsoleRenderer (debug)
    │   ├── soft.rs         ← OrionSoftRenderer (pixel buffer)
    │   └── font.rs         ← gestión de fuentes
    ├── js/                 ← JavaScript runtime (QuickJS)
    ├── security/           ← CSP · HTTPS · HSTS · ad blocker
    ├── extractor/          ← extractor de metadatos HTML
    └── ranker/             ← BM25 ranking
```

### Ejecutar el motor

```bash
cd flux-engine

# Tests del pipeline completo
cargo test

# Demo en consola (display list)
cargo run --bin flux-engine

# Renderer de píxeles — abre ventana con softbuffer
cargo run --bin flux-render

# Navegador completo
cargo run --bin flux-browser
```

---

## Flux Search

Motor de búsqueda propio integrado en el browser.

### Flujo

```
Usuario escribe en barra → flux://search?q=...
        ↓
flux-backend (:3000)
  · Consulta SearXNG self-hosted (:8080) si está disponible
  · Fallback automático a DuckDuckGo si SearXNG no está activo
        ↓
flux-engine (:4000)  POST /process
  · fetch_and_extract() — descarga y parsea cada URL
  · SecurityLayer — filtra URLs bloqueadas
  · BM25 re-ranking
        ↓
SearchPage (React)
  · Resultados con identidad Flux
  · Sin referencia a buscadores externos
```

### Endpoints del engine (Axum)

| Endpoint | Descripción |
|---|---|
| `POST /process` | Recibe `{ query, urls[] }` → descarga, extrae, rankea con BM25 |
| `GET /health` | Estado del engine |

### Endpoints del backend (Express)

| Endpoint | Descripción |
|---|---|
| `GET /api/search/web?q=` | Búsqueda web via SearXNG + re-ranking Rust + boost por historial personal (auth opcional) |
| `GET /api/search/summary?q=` | Resumen IA de resultados via Gemini (requiere auth) |
| `GET /api/search?q=` | Búsqueda en historial y favoritos del usuario |
| `GET /api/suggestions?q=` | Autocompletado en barra de direcciones |
| `POST /api/translation/translate` | Traducción de texto (Gemini + fallback MyMemory) |
| `POST /api/translation/detect` | Detección de idioma |
| `GET /api/news` | Noticias en tiempo real vía RSS (BBC, TechCrunch, NASA, Al Jazeera) |
| `GET /api/weather?city=` | Clima actual vía wttr.in |
| `GET /api/trends` | Tendencias de Google Trends vía RSS |

---

## flux-backend

Backend Node.js + Express que gestiona los datos de usuario del browser. **Se distribuye como ejecutable standalone** — el usuario final no necesita Node.js instalado.

### Stack

- **Runtime:** Node.js + TypeScript (compilado a exe standalone con `@yao-pkg/pkg`)
- **Framework:** Express 5
- **ORM:** Prisma
- **Base de datos:** SQLite (archivo local `flux.db`, sin servidor)
- **Auth:** JWT + bcrypt
- **IA:** Google Gemini (chat, traducción, detección de canciones, OCR)
- **Voz:** Google Cloud Text-to-Speech
- **Seguridad:** Helmet + express-rate-limit

### Modelos

| Modelo | Descripción |
|---|---|
| `User` | Usuarios del browser |
| `History` | Historial de navegación |
| `Favorite` | Bookmarks |
| `Tab` / `TabGroup` | Tabs y grupos persistentes |
| `UserPreference` | Configuración del browser |
| `BrowsingStats` / `SiteVisit` | Estadísticas de uso |
| `BlockedSite` | Bloqueador de sitios (Focus Mode) |
| `QuickNote` / `QuickTask` | Notas y tareas rápidas |
| `FocusSession` | Sesiones de enfoque |
| `AiConversation` | Historial con Gemini |
| `DetectedSong` | Canciones detectadas |
| `MediaDownload` | Descargas de medios |

---

## UI

Chrome del navegador construido en React + Tailwind. Rodea el contenido con la identidad visual de Flux.

### Stack

- **Framework:** React 18 + TypeScript
- **Estilos:** Tailwind CSS 3 + shadcn/ui
- **Routing:** React Router v6
- **Estado servidor:** TanStack Query
- **Build:** Vite 5

### Páginas internas (`flux://`)

| URL | Descripción |
|---|---|
| `flux://newtab` | Nueva pestaña con búsqueda, clima, noticias RSS y tendencias |
| `flux://search?q=` | Resultados de búsqueda Flux |
| `flux://ai?q=` | Chat con Gemini IA (página completa) |
| `flux://settings` | Configuración del browser |
| `flux://about` | Información de la versión |
| `flux://view-source` | Código fuente de la página actual |
| `flux://history` | Historial de navegación |
| `flux://bookmarks` | Gestor de bookmarks |
| `flux://downloads` | Panel de descargas |

### Componentes destacados

| Componente | Descripción |
|---|---|
| `FluxAISidePanel` | Panel lateral flotante de IA — chat Gemini contextual con URL y título de página actual, renderizado Markdown, animación de escritura |
| `NewTabPage` | Nueva pestaña con widget de clima (wttr.in), feed de noticias RSS, tendencias de Google y búsqueda por voz |
| `MediaDownloaderModal` | Descargador de medios con yt-dlp bundleado — progreso en tiempo real (%, velocidad, bytes) |
| `FavoritesPanel` | Panel de favoritos/bookmarks integrado |
| `SecurityPanel` | Panel de seguridad por sitio — estado HTTPS, trackers detectados, tiempo de carga |
| `DevToolsSection` | Sección de herramientas de desarrollador en el menú |
| `WelcomeOnboarding` | Onboarding de bienvenida al primer arranque |
| `OCRModal` | Extracción de texto desde imágenes via Gemini Vision |
| `SongDetectorModal` | Detección de canción activa en la página via Gemini |

---

## Instalación (beta pública)

### El usuario solo instala el navegador — sin dependencias externas

```
flux-browser/
  flux-browser.exe      ← abrir esto
  flux-backend.exe      ← arranca automáticamente
  yt-dlp.exe            ← bundleado para descargas de video/audio
  flux.db               ← se crea solo en el primer arranque
```

No se requiere: Node.js · PostgreSQL · Docker · Python · yt-dlp manual.

---

## Compilar desde el código fuente

### Requisitos (solo para compilar)

- [Rust](https://rustup.rs/) 1.75+
- [Node.js](https://nodejs.org/) 18+ (solo para el paso de compilación del backend)
- Windows 10/11 con WebView2 (preinstalado en Win11) o macOS 11+

### Pasos

```powershell
# 1. Clonar
git clone https://github.com/tu-usuario/flux-browser.git
cd flux-browser

# 2. Descargar yt-dlp (una sola vez)
.\scripts\download-yt-dlp.ps1

# 3. Compilar el backend → flux-engine/bin/flux-backend.exe
.\scripts\build-backend.ps1

# 4. Compilar el browser (incluye ambos exe automáticamente)
cd flux-engine
cargo build --release --bin flux-browser

# El resultado está en flux-engine/target/release/
# Copiar a una carpeta de distribución:
#   orion-browser.exe  flux-backend.exe  yt-dlp.exe
```

### Variables de entorno del backend

```env
# flux-backend/.env
DATABASE_URL=file:./flux.db          # SQLite local (por defecto)
JWT_SECRET=cambia_esto_por_un_secret_largo
GEMINI_API_KEY=tu_api_key_aqui       # para Flux AI, traducción y detección de canciones
PORT=3000
```

> Las features de IA (Flux AI, traducción, detección de canciones, OCR) requieren `GEMINI_API_KEY`.
> La navegación, búsqueda e historial funcionan sin ella.

### SearXNG (opcional — búsqueda privada avanzada)

```bash
# Solo si quieres búsqueda completamente privada y sin límites
docker compose up -d
# Si no está activo, la búsqueda usa DuckDuckGo automáticamente
```

---

## Roadmap

### flux-engine — Motor de renderizado propio

- [x] Tokenizer zero-copy
- [x] Parser DOM arena-based
- [x] CSS cascade con especificidad (tag · clase · id · inline)
- [x] UA stylesheet completo (h1-h6, p, ul, ol, table, form, input...)
- [x] Inline layout + word wrapping
- [x] text-align (left / center / right)
- [x] Display list con paint commands
- [x] OrionSoftRenderer — pixel buffer XRGB8888
- [x] Glyph atlas con fontdue (cache de glifos rasterizados)
- [x] Alpha blending
- [x] JavaScript ligero — rquickjs (QuickJS embebido, ~10 MB)
- [x] DOM bindings completos (getElementById, querySelector, textContent, style, classList...)
- [x] `createElement` / `appendChild` funcional
- [x] `addEventListener` / `removeEventListener` / `dispatchEvent`
- [x] Auto-fire `DOMContentLoaded` + `load`
- [x] `fetch()` real HTTPS con bloqueo por CSP connect-src
- [x] SecurityLayer — CSP del servidor
- [x] SecurityLayer — HTTPS-only + HSTS preload
- [x] SecurityLayer — Ad/tracker blocker
- [x] JS sandbox — límites de heap/stack por tab
- [x] yt-dlp bundleado — sin instalación manual para el usuario
- [x] flux-backend.exe como sidecar — arranca y cierra con el browser
- [x] Sistema de permisos nativos (cámara, micrófono, notificaciones) via Rust
- [ ] Conectar OrionSoftRenderer al content_view de la ventana nativa
- [ ] Flexbox layout
- [ ] Imágenes (`<img>` decodificada y pintada en el buffer)
- [ ] Cookie jar por dominio
- [ ] Caché HTTP (ETag, Cache-Control)
- [ ] `setInterval` / eventos de input reales

### wry — Ventana nativa

- [x] Ventana nativa con `tao` (sin decoraciones, transparente)
- [x] `chrome_view` — WebView React UI
- [x] `content_view` — WebView páginas externas
- [x] IPC bidireccional (navigate, minimize, maximize, chrome_height)
- [x] Resize dinámico de los dos WebViews
- [x] HTTPS upgrade antes de `load_url()`
- [ ] Interceptar peticiones con el engine (reemplazar content_view por renderer propio)

### Flux Search

- [x] SearXNG self-hosted (Docker, opcional)
- [x] Fallback automático a DuckDuckGo si SearXNG no está activo
- [x] Re-ranking BM25 en Rust
- [x] SearchPage con identidad Flux
- [x] Paginación de resultados
- [x] Autocompletado en barra de URL
- [x] Re-ranking personalizado por historial del usuario (boost proporcional a frecuencia de visitas)
- [x] Caché de búsquedas en memoria (TTL 5 min — evita golpear SearXNG + engine en repetidas búsquedas)
- [x] Resumen IA de resultados (Gemini, endpoint separado — no bloquea los resultados principales)

### Backend + Persistencia

- [x] Auth JWT + bcrypt
- [x] Historial, bookmarks, tabs, preferencias
- [x] Grupos de tabs
- [x] Estadísticas de navegación (BrowsingStats, SiteVisit, HourlyActivity)
- [x] Focus Mode con BlockedSite
- [x] Gemini IA (chat, resúmenes)
- [x] Detección de canciones
- [x] Registro de descargas
- [x] **Migración a SQLite** — sin dependencia de PostgreSQL ni Docker
- [x] **Backend como exe standalone** — no requiere Node.js instalado
- [ ] Sincronización entre dispositivos *(UI lista en Settings, backend pendiente)*

### UI

- [x] Chrome React con identidad Flux
- [x] Barra de direcciones con búsqueda integrada
- [x] Sistema de tabs con grupos y colores
- [x] Split view / Side panel
- [x] Barra de bookmarks
- [x] Focus Mode
- [x] Reader Mode
- [x] Panel de descargas
- [x] Flux AI (Gemini) — página completa
- [x] Panel lateral flotante de IA (OrionAISidePanel) — contextual con URL y título
- [x] Selector de tema
- [x] Estadísticas de uso
- [x] Configuración completa
- [x] Nueva pestaña con clima, noticias RSS y Google Trends
- [x] Descargador de medios (yt-dlp bundleado) con progreso en tiempo real
- [x] Mute por pestaña
- [x] Panel de favoritos
- [x] Herramientas de desarrollador
- [x] **Servicio de traducción** — Gemini + fallback MyMemory (15 idiomas, sin API key extra)
- [x] Búsqueda por voz en nueva pestaña
- [x] OCR — extracción de texto desde imágenes (Gemini Vision)
- [x] Detección de canciones en página activa (Gemini)
- [x] Modo privado / incógnito por pestaña
- [x] Onboarding de bienvenida al primer arranque
- [x] Sistema de login y registro de usuario
- [x] Multi-tab con WebView nativo por pestaña (cada tab = WebView2 independiente)
- [x] Tab discard — libera RAM de pestañas inactivas > 10 min automáticamente
- [x] Panel de seguridad por sitio (HTTPS, trackers, tiempo de carga)
- [x] Panel de privacidad en tiempo real (trackers bloqueados, ads, cookies, datos ahorrados por sitio)
- [x] Historial visual con línea de tiempo (agrupado por Hoy / Ayer / fecha)

---

## Estructura del proyecto

```
flux-browser/
├── flux-engine/          ← Motor del browser (Rust)
│   ├── build.rs           ← copia yt-dlp.exe + flux-backend.exe al compilar
│   ├── bin/               ← yt-dlp.exe + flux-backend.exe (bundleados)
│   └── src/
│       ├── bin/browser.rs ← Ventana nativa (tao + wry) + sidecar backend
│       ├── api/           ← Axum HTTP server :4000
│       ├── js/            ← JavaScript runtime (QuickJS)
│       ├── security/      ← CSP · HTTPS · HSTS · ad blocker
│       ├── renderer/      ← OrionSoftRenderer (pixel buffer)
│       ├── layout/        ← Block + Inline layout
│       ├── style/         ← CSS cascade + UA stylesheet
│       ├── paint/         ← Display list
│       ├── parsing/       ← Tokenizer + DOM parser
│       ├── fetcher/       ← HTTP client + SecurityLayer
│       ├── extractor/     ← Metadata extractor
│       └── ranker/        ← BM25 ranking
├── flux-backend/         ← API de usuario (Node.js → exe standalone)
│   ├── prisma/schema.prisma ← SQLite, sin servidor de base de datos
│   └── src/
│       ├── routes/translationRoutes.ts ← traducción vía Gemini
│       └── services/geminiService.ts   ← IA + traducción + detección
├── scripts/
│   ├── download-yt-dlp.ps1  ← descarga yt-dlp antes de compilar
│   └── build-backend.ps1    ← compila backend → flux-backend.exe
├── searxng/               ← Config SearXNG (opcional, Docker :8080)
├── docker-compose.yml     ← SearXNG + Redis (opcional)
├── src/                   ← React UI (chrome del browser)
│   ├── components/browser/
│   ├── services/
│   │   └── translationService.ts ← traducción con fallback MyMemory
│   ├── hooks/
│   ├── pages/
│   └── contexts/
├── public/
├── index.html
├── vite.config.ts
└── package.json
```

---

## Contribuir

1. Fork del repositorio
2. Crear rama: `git checkout -b feature/nombre`
3. Commit: `git commit -m "feat: descripción"`
4. Push: `git push origin feature/nombre`
5. Abrir Pull Request

---

## Licencia

MIT © Gabriel Zapata
