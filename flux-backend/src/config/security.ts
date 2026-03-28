import cors from "cors";
import helmet from "helmet";
import { Express } from "express";
import { env } from "./env";

// Orígenes permitidos: FRONTEND_URL del .env más los orígenes fijos.
// "flux://localhost" es el custom protocol que usa flux-browser.exe en producción.
const allowedOrigins: string[] = [
  env.FRONTEND_URL,
  "flux://localhost",   // producción: custom protocol del motor Rust
];
if (env.NODE_ENV === "development") {
  allowedOrigins.push(
    "http://localhost:8080",
    "http://localhost:8082",
    "http://localhost:5173",
  );
}

export function configureSecurity(app: Express): void {
  app.use(
    helmet({
      // CSP: permite scripts/estilos propios y bloquea el resto por defecto.
      // El proxy desactiva CSP en sus respuestas al reescribir HTML,
      // pero protege las rutas /api/* del backend.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      // Necesario para que WebView2 pueda embeber el frontend en el chrome_view.
      crossOriginEmbedderPolicy: false,
      // Evita que el navegador infiera el MIME type.
      noSniff: true,
      // Fuerza HTTPS en producción.
      strictTransportSecurity: env.NODE_ENV === "production"
        ? { maxAge: 31536000, includeSubDomains: true }
        : false,
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        // Permitir peticiones sin origin (ej: el proceso Rust local, curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS bloqueado para origen: ${origin}`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );
}