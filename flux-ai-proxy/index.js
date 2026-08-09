const express = require('express');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// Railway sirve detrás de su propio proxy: sin esto req.ip devolvería
// siempre la IP interna de Railway y el limitador no distinguiría clientes.
app.set('trust proxy', 1);

app.use(express.json({ limit: '20mb' }));

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('[flux-ai-proxy] ERROR: GEMINI_API_KEY no configurada');
  process.exit(1);
}

const API_TOKEN = process.env.FLUX_API_TOKEN;
if (!API_TOKEN) {
  console.error('[flux-ai-proxy] ERROR: FLUX_API_TOKEN no configurada');
  console.error('[flux-ai-proxy] Sin token el proxy quedaria abierto a cualquiera.');
  process.exit(1);
}

// El modelo lo decide el proxy, no el cliente.
//
// Motivo: el nombre del modelo iba escrito en el backend, que se compila
// dentro del ejecutable de Flux. Cuando Google retira un modelo (paso con
// gemini-2.0-flash, que empezo a devolver 404) habria que recompilar los
// 132 MB y pedirle a cada usuario que se los descargue otra vez.
//
// Teniendolo aqui, cambiar de modelo es editar una variable en Railway.
// Para ver los disponibles con tu clave:
//   curl "https://generativelanguage.googleapis.com/v1beta/models?key=TU_CLAVE"
const MODELO = process.env.GEMINI_MODEL || 'gemini-flash-latest';

const genAI = new GoogleGenerativeAI(API_KEY);

//   Autenticacion                        
//
// Aviso: este token viaja dentro del ejecutable de Flux, que se distribuye
// a los usuarios. Cualquiera puede extraerlo del binario, asi que NO es un
// secreto fuerte. Sirve para frenar el abuso casual (escaneres, alguien que
// encuentre la URL suelta), no a un atacante decidido. La proteccion real de
// la cuota es el limitador de peticiones de mas abajo.

function tokenValido(recibido) {
  if (!recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(API_TOKEN);
  // timingSafeEqual exige longitudes iguales y ademas evita filtrar
  // informacion por el tiempo de comparacion.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requiereToken(req, res, next) {
  if (!tokenValido(req.get('x-flux-token'))) {
    return res.status(401).json({ error: 'no autorizado' });
  }
  next();
}

//   Cuotas                           
//
// Tres capas, cada una para un problema distinto:
//
//   1. Rafaga por IP      - evita que un bucle descontrolado sature el proxy.
//   2. Diaria por equipo  - reparte la cuota entre usuarios sin pedirles
//                           registro ni API key. Se apoya en un UUID que Flux
//                           genera al instalarse; es esquivable regenerandolo,
//                           pero cubre el caso real (uso intensivo honesto),
//                           no a un atacante decidido.
//   3. Tope global        - el unico limite que garantiza que la factura de
//                           Gemini no se dispare pase lo que pase.
//
// Aviso: los contadores viven en memoria, asi que se reinician cuando Railway
// reinicia el contenedor. Para una beta es aceptable (peca de permisivo, no de
// restrictivo). Si el proyecto crece, esto deberia ir a Redis o a la base.

const RAFAGA_MS = 60 * 1000;
const RAFAGA_MAX = 20;

const LIMITE_DIARIO_EQUIPO = 60;
const LIMITE_DIARIO_GLOBAL = 3000;

const rafagas = new Map();   // ip     -> { n, reinicio }
const diarios = new Map();   // equipo -> { n, dia }
let globalHoy = { n: 0, dia: diaActual() };

function diaActual() {
  return new Date().toISOString().slice(0, 10); // AAAA-MM-DD en UTC
}

// Purga periodica: sin esto los Map crecerian con cada IP y cada equipo
// nuevo hasta agotar la memoria del contenedor.
setInterval(() => {
  const ahora = Date.now();
  for (const [ip, reg] of rafagas) {
    if (ahora > reg.reinicio) rafagas.delete(ip);
  }
  const hoy = diaActual();
  for (const [equipo, reg] of diarios) {
    if (reg.dia !== hoy) diarios.delete(equipo);
  }
}, RAFAGA_MS).unref();

function limitaPeticiones(req, res, next) {
  const hoy = diaActual();

  // 1. Rafaga por IP
  const ip = req.ip || 'desconocida';
  const ahora = Date.now();
  const raf = rafagas.get(ip);
  if (!raf || ahora > raf.reinicio) {
    rafagas.set(ip, { n: 1, reinicio: ahora + RAFAGA_MS });
  } else if (raf.n >= RAFAGA_MAX) {
    const faltan = Math.ceil((raf.reinicio - ahora) / 1000);
    res.set('Retry-After', String(faltan));
    return res.status(429).json({ error: 'demasiadas peticiones seguidas', reintentar_en: faltan });
  } else {
    raf.n += 1;
  }

  // 2. Tope global del dia
  if (globalHoy.dia !== hoy) globalHoy = { n: 0, dia: hoy };
  if (globalHoy.n >= LIMITE_DIARIO_GLOBAL) {
    return res.status(503).json({
      error: 'servicio de IA no disponible por hoy',
      detalle: 'Se alcanzo el limite diario compartido. Vuelve manana.',
    });
  }

  // 3. Cuota diaria del equipo
  const equipo = req.get('x-flux-device') || `ip:${ip}`;
  const dia = diarios.get(equipo);
  if (!dia || dia.dia !== hoy) {
    diarios.set(equipo, { n: 1, dia: hoy });
  } else if (dia.n >= LIMITE_DIARIO_EQUIPO) {
    return res.status(429).json({
      error: 'limite diario alcanzado',
      detalle: `Has usado tus ${LIMITE_DIARIO_EQUIPO} consultas de hoy. Se renueva a medianoche.`,
      limite: LIMITE_DIARIO_EQUIPO,
    });
  } else {
    dia.n += 1;
  }

  globalHoy.n += 1;

  // Cabeceras informativas para que la UI pueda mostrar cuanto queda.
  const usadas = diarios.get(equipo).n;
  res.set('X-Flux-Quota-Limit', String(LIMITE_DIARIO_EQUIPO));
  res.set('X-Flux-Quota-Remaining', String(Math.max(0, LIMITE_DIARIO_EQUIPO - usadas)));

  next();
}

//   Rutas                            

// Health check: sin token, porque Railway lo consulta para saber si el
// contenedor esta vivo. No revela nada ni consume cuota.
app.get('/health', (_req, res) => res.json({ ok: true }));

// Generacion de texto
app.post('/ai/generate', requiereToken, limitaPeticiones, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt requerido' });

    const m = genAI.getGenerativeModel({ model: MODELO });
    const result = await m.generateContent(prompt);
    res.json({ text: result.response.text() });
  } catch (err) {
    console.error('[flux-ai-proxy] /ai/generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Generacion con imagen (vision)
app.post('/ai/generate-vision', requiereToken, limitaPeticiones, async (req, res) => {
  try {
    const { imageBase64, mimeType, prompt } = req.body;
    if (!imageBase64 || !prompt) return res.status(400).json({ error: 'imageBase64 y prompt requeridos' });

    const m = genAI.getGenerativeModel({ model: MODELO });
    const result = await m.generateContent([
      { inlineData: { data: imageBase64, mimeType: mimeType || 'image/jpeg' } },
      prompt,
    ]);
    res.json({ text: result.response.text() });
  } catch (err) {
    console.error('[flux-ai-proxy] /ai/generate-vision error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[flux-ai-proxy] Corriendo en puerto ${PORT}`));
