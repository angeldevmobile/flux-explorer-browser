# Trabajo pendiente y notas técnicas

Notas de trabajo del bloqueador de anuncios y el consumo de recursos.
Todas las cifras son medidas, no estimaciones: método al final del documento.

---

## Estado actual (medido)

Con **una pestaña** en YouTube reproduciendo video:

| Componente | Procesos | RAM |
|---|---|---|
| renderer | 4 | 583 MB |
| gpu-process | 1 | 252 MB |
| principal | 1 | 160 MB |
| utility | 3 | 101 MB |
| **backend Node** | 1 | **74 MB** |
| Rust (Flux) | 1 | 43 MB |
| crashpad | 1 | 21 MB |
| **Total** | **12** | **1.234 MB** |

Referencia: Edge con perfil limpio y el mismo video usa **1.360 MB**.

Otras cifras:

| Métrica | Valor |
|---|---|
| RAM, 5 pestañas sin suspensión | 2.257 MB |
| RAM, 5 pestañas con suspensión | **1.638 MB** (−27 %) |
| GPU, ventana visible | 4,75 % |
| GPU, ventana minimizada | **0 %** |
| Coste por consulta del filtro (release) | 7,2 µs |
| Arranque del motor de filtrado (release) | ~100 ms |
| Tamaño del `.exe` | 131 MB (98 son el Node empaquetado) |

---

## Pendiente

### 1. Portar `flux-backend` a Rust — *prioridad alta, semanas*

**Beneficio:** 74 MB de RAM, un proceso menos, y el `.exe` baja de 131 MB a ~33 MB.

**Alcance real:** 7.671 líneas de TypeScript, 22 archivos de rutas, 16 modelos Prisma.
Cubre autenticación, historial, favoritos, notas, tareas, focus, estadísticas,
IA, descargas, traducción, clima, noticias y tendencias.

**Cómo abordarlo.** Por fases, nunca de golpe: dejar el backend partido entre dos
lenguajes a medio camino es peor que no empezarlo.

1. Rutas sin estado compartido: `weatherRoutes`, `trendsRoutes`, `newsRoutes`,
   `translationRoutes`. Son proxies HTTP, se portan casi directas a Axum.
2. Rutas con SQLite pero sin autenticación: `historyRoutes`, `favoritesRoutes`,
   `notesRoutes`, `taskRoutes`. Migrar Prisma a `sqlx` con las mismas tablas.
3. Autenticación y sesión (`auth.ts`, `users.ts`, `sync.ts`) al final: es lo
   que rompe todo si sale mal.

Durante la transición conviene que ambos backends convivan detrás del mismo
puerto, moviendo rutas de a una.

### 2. Fusionar los dos WebViews del chrome — *prioridad media, riesgo alto*

Hoy conviven `chrome_view` (UI React) y `content_view` (página web) superpuestos
en la misma ventana. Fusionarlos ahorra un renderer, unos ~100 MB.

**Por qué no se hizo:** implica rehacer posicionamiento, z-order, propagación de
eventos, el panel de IA y el arrastre de ventana. Alto riesgo de romper una UI
que funciona, a cambio de una ganancia moderada. Merece una sesión dedicada solo
a esto, con capturas de antes y después.

### 3. Anuncios de YouTube (SABR) — *mantenimiento continuo*

No es una tarea que se cierre. YouTube inserta los anuncios **dentro del mismo
stream de video y por el mismo dominio**, así que ningún filtro de red puede
separarlos.

La mitigación actual es el scriptlet `brave-yt-sabr-fix.js`, que reescribe el
`backoffTimeMs` y fuerza una sesión sin slot de anuncio. Se inyecta vía las
reglas de `FLUX_RULES` en `flux-engine/src/adblocker/mod.rs`.

**Ya está preparado para sobrevivir:** las listas y los scriptlets se actualizan
solos cada 24 h desde `%LOCALAPPDATA%\Flux\filters`. Cuando Google cambie el
contrato y Brave publique la corrección, llega sola sin recompilar.

Si algún día deja de funcionar del todo, la única alternativa conocida es
**suplantar el cliente de innertube** (pedir la respuesta del player fingiendo
ser el cliente de TV o el embebido, como hace `yt-dlp`). Es más efectivo pero
mucho más frágil: puede afectar la sesión iniciada, las recomendaciones y la
calidad máxima disponible.

### 4. Verificar el spinner de arranque de video

Al bloquear el anuncio, YouTube conservaba el tiempo de espera reservado para
él y el video tardaba entre 4 y 16 s en arrancar. El scriptlet de Brave lo
corrige, pero **no se cronometró antes y después**. Falta medirlo.

---

## Trampas conocidas

Errores ya cometidos en este código. Vale la pena leerlos antes de tocar estas
zonas, porque ninguno da error: fallan en silencio.

**Comprobar que algo exista no es comprobar que se vea.** YouTube deja en el DOM,
ocultos, tanto el botón de saltar anuncio como el cartel de error. Un
`querySelector` los encuentra siempre. Esto causó dos bugs distintos: clicks a
un botón invisible y una recarga de página en cada video. Usar `_esVisible()`.

**`offsetParent !== null` no sirve como prueba de visibilidad.** Devuelve `null`
tanto para `display:none` como para cualquier elemento con `position: fixed`, y
YouTube pone el botón de saltar en contenedores fijos.

**Nunca ocultar por CSS un elemento que después se quiere pulsar.** Ocultar el
botón de saltar dejaba el anuncio imposible de saltar, ni por código ni a mano.

**Fijar `with_additional_browser_args` reemplaza los argumentos de `wry`.** Hay
que reponerlos manualmente, en especial `--autoplay-policy`: sin él los videos
dejan de reproducirse solos. Y `--disable-features` solo admite una aparición;
si se repite, la última gana.

**En WebView2, `SetResponse(None)` no cancela la petición.** Es el valor por
defecto y significa "seguí a la red". Para bloquear hay que construir una
respuesta real con `CreateWebResourceResponse`.

**Encoger una pestaña a 0×0 no la oculta para WebView2.** Sigue decodificando
video y componiendo. Hay que llamar `SetIsVisible(false)` explícitamente: un
WebView2 en modo ventana-hija no recibe la señal de oclusión de Chromium.

**Suspender una pestaña que reproduce audio corta la música.** Consultar siempre
`IsDocumentPlayingAudio` antes de `TrySuspend`.

**El rendimiento en debug no dice nada del real.** El motor de filtrado cuesta
7 µs por consulta en release y 468 µs en debug — 90× de diferencia por el motor
de expresiones regulares sin optimizar. Los umbrales de rendimiento solo se
exigen en release.

---

## Descartado tras medirlo

**Banderas de Chromium para bajar RAM.** No funcionan.

| Configuración | RAM |
|---|---|
| Base | 1.234 MB |
| Con banderas seguras | 1.235 MB |
| Con `--renderer-process-limit=1` | 1.188 MB |

Las banderas seguras no ahorran nada: esa memoria es contenido real de página,
no funciones desactivables. Limitar procesos ahorra 47 MB a cambio de debilitar
el aislamiento entre sitios — mal negocio para un navegador que se vende como
seguro. Las banderas se dejaron puestas igual porque quitan telemetría
(SmartScreen, hints de Google, autocompletado contra servidores).

**Salirse de SABR borrando `serverAbrStreamingUrl`.** Rompía la reproducción:
cuando YouTube solo entrega formatos cifrados el player se queda en "Se produjo
un error". Sustituido por el scriptlet de Brave, que trabaja *con* SABR.

---

## Cómo reproducir las mediciones

En builds de desarrollo hay tres variables de entorno. Están bajo
`debug_assertions` y **no existen en el binario de release** (verificado).

| Variable | Efecto |
|---|---|
| `FLUX_TEST_URL` | Reemplaza la página inicial |
| `FLUX_TEST_TABS=N` | Abre N pestañas extra con la misma página |
| `FLUX_BROWSER_ARGS` | Sustituye los argumentos de Chromium |

```bash
# Una pestaña
FLUX_TEST_URL="https://www.youtube.com/watch?v=..." ./flux-browser.exe

# Cinco pestañas, para medir cómo escala
FLUX_TEST_URL="https://www.youtube.com/watch?v=..." FLUX_TEST_TABS=4 ./flux-browser.exe
```

Dos advertencias sobre el método, aprendidas a base de mediciones inválidas:

- **Verificar que el video reproduzca de verdad** antes de anotar cifras. Si el
  contador `videodecode` de GPU está en 0, no hay reproducción y los números no
  valen. Un video de 19 s se acaba antes de que termines de medir: usar uno largo.
- **No recorrer el árbol de procesos solo por padre/hijo.** Windows recicla los
  PID y se cuelan procesos ajenos: en una medición arrastró `WindowsTerminal` y
  `powershell`, 155 MB que no eran del navegador. Filtrar también por nombre de
  ejecutable.
