# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Este proyecto usa [versionado semántico](https://semver.org/lang/es/).

---

## [0.1.0-beta.1] — 2026-08-09

Primera beta pública. El foco de este ciclo fue que el bloqueador de anuncios
funcionara de verdad y que el consumo de recursos dejara de escalar sin control.

### Añadido

- **Motor de bloqueo real.** Se integró el crate `adblock` (el mismo que usa
  Brave) con EasyList, EasyPrivacy, las listas de uBlock Origin y sus
  scriptlets: unas 150.000 reglas frente a los ~60 dominios escritos a mano que
  había antes. Arranca en ~100 ms.
- **Actualización automática de listas.** Se refrescan cada 24 h en segundo
  plano hacia `%LOCALAPPDATA%\Flux\filters`. Las correcciones llegan sin
  descargar una versión nueva del navegador. Las listas embebidas quedan como
  respaldo si no hay red.
- **Filtrado cosmético por sitio.** CSS y scriptlets específicos de cada
  dominio, tomados de las mismas listas.
- **Suspensión de pestañas en segundo plano.** Usa `TrySuspend`/`Resume` de
  WebView2: libera memoria conservando el estado, sin recargar ni perder el
  scroll al volver. No suspende pestañas que estén reproduciendo audio.
- **Pausa de render en ventanas ocultas.** `SetIsVisible(false)` al minimizar y
  en pestañas de fondo.

### Corregido

- **El bloqueador nunca funcionó.** Dos fallos lo anulaban por completo: el
  parseo de host descartaba todas las URLs `https://` (extraía `"https"` como
  nombre de host), y `SetResponse(None)` en WebView2 no cancela la petición
  —es el valor por defecto y significa "seguí a la red"—, así que hacía falta
  devolver una respuesta 403 real.
- **Los scriptlets estaban inertes.** Faltaba llamar a `use_resources()`, de
  modo que el motor reconocía las reglas `##+js(...)` pero no tenía el código
  que debían inyectar.
- **Páginas enteras caían por un falso positivo.** El filtro de seguridad
  aplicaba coincidencia de texto sobre la URL completa en las navegaciones de
  nivel superior: un `?utm_source=taboola.com` bastaba para tumbar el sitio y
  mostrar la pantalla de error.
- **Anuncios reemplazados por bloques blancos.** Al cancelar la petición el
  elemento conservaba su espacio reservado. Ahora se colapsa.
- **El botón "Saltar anuncio" de YouTube quedaba inutilizable.** Se ocultaba
  por CSS y luego se intentaba pulsar, con lo que el anuncio no se podía saltar
  ni automáticamente ni a mano.
- **Recarga de página en cada video de YouTube.** La detección de errores del
  reproductor comprobaba que el cartel existiera en el DOM, pero YouTube lo
  mantiene siempre presente y oculto.
- **Los anuncios volvían tras el primer tropiezo.** El interruptor de seguridad
  de SABR era global de sesión; ahora se guarda por video.
- **Consumo de CPU constante en YouTube.** Un bucle de `requestAnimationFrame`
  ejecutaba 60 consultas al DOM por segundo de forma indefinida. Ahora sólo se
  activa mientras hay un anuncio en pantalla.

### Cambiado

- Se abandonó el intento de salirse de SABR borrando `serverAbrStreamingUrl`:
  rompía la reproducción cuando YouTube sólo entrega formatos cifrados. Lo
  sustituye el scriptlet `brave-yt-sabr-fix.js`, que trabaja *con* SABR
  reescribiendo el tiempo de espera reservado para el anuncio.
- Se desactivaron funciones de Edge que envían datos a terceros: SmartScreen,
  sugerencias de optimización de Google y autocompletado contra servidores.

### Limitaciones conocidas

- **YouTube puede mostrar anuncios de video.** Los inserta dentro del mismo
  stream y por el mismo dominio que el video, así que ningún filtro de red
  puede separarlos. Los que aparezcan se pueden saltar.
- **~1,2 GB de RAM con una pestaña.** Es el piso del motor Chromium sobre el
  que está construido. Como referencia, Edge usa 1,36 GB en la misma página.
- **Ejecutable de 132 MB**, de los cuales 98 son un backend Node.js empaquetado.
- **Sin firma digital**: Windows mostrará un aviso de SmartScreen al abrirlo.

[0.1.0-beta.1]: https://github.com/angeldevmobile/flux-explorer-browser/releases/tag/v0.1.0-beta.1
