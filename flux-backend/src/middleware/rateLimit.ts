import rateLimit from "express-rate-limit";

// Límite global: 1000 requests por 15 min
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: "Demasiadas solicitudes, intenta más tarde" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Límite para auth: 20 intentos por 15 min
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Demasiados intentos de autenticación, espera 15 minutos" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Límite para API de voz: 100 requests por 15 min
export const voiceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Demasiadas solicitudes de voz, intenta más tarde" },
  standardHeaders: true,
  legacyHeaders: false,
});