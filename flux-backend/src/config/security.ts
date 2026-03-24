import cors from "cors";
import helmet from "helmet";
import { Express } from "express";
import { env } from "./env";

export function configureSecurity(app: Express): void {
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  app.use(cors({
    origin: [
      env.FRONTEND_URL,
      "http://localhost:8080",
      "http://localhost:8082",
      "http://localhost:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));

  console.log("Seguridad configurada");
}