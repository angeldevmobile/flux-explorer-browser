import express from "express";
import dotenv from "dotenv";
dotenv.config();

import { configureSecurity } from "./config/security";
import { connectDatabase } from "./config/database";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { globalLimiter, authLimiter, voiceLimiter } from "./middleware/rateLimit";

// Routes
import authRoutes from "./routes/auth";
import tabRoutes from "./routes/tabRoutes";
import favoriteRoutes from "./routes/favoritesRoutes";
import historyRoutes from "./routes/historyRoutes";
import voiceRoutes from "./routes/sync";
import searchRoutes from "./routes/searchRoutes";
import userRoutes from "./routes/users";
import db from "./config/db";
import notesRoutes from "./routes/notesRoutes";
import tasksRoutes from "./routes/taskRoutes";
import focusRoutes from "./routes/focusRoutes";
import statsRoutes from "./routes/statsRoutes";
import preferencesRoutes from "./routes/preferencesRoutes";
import tabGroupRoutes from "./routes/tabGroupRoutes";
import mediaRoutes from "./routes/mediaRoutes";
import suggestionsRoutes from "./routes/suggestionsRoutes";
import aiHistoryRoutes from "./routes/aiHistoryRoutes";
import visionRoutes from "./routes/visionRoutes";
import proxyRoutes from "./routes/proxyRoutes";
import trendsRoutes from "./routes/trendsRoutes";
import newsRoutes from "./routes/newsRoutes";
import weatherRoutes from "./routes/weatherRoutes";
import translationRoutes from "./routes/translationRoutes";

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsers FIRST
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Seguridad (Helmet + CORS) - ANTES DEL PROXY
configureSecurity(app);

// El proxy se registra DESPUÉS de seguridad para que CORS se aplique
app.use("/api/proxy", proxyRoutes);

// Rate limiting global
app.use(globalLimiter);

// Routes con rate limits específicos
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/tabs", tabRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/voice", voiceLimiter, voiceRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/user", userRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/focus", focusRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/preferences", preferencesRoutes);
app.use("/api/tab-groups", tabGroupRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/suggestions", suggestionsRoutes);
app.use("/api/ai-history", aiHistoryRoutes);
app.use("/api/vision", visionRoutes);
app.use("/api/trends", trendsRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/translation", translationRoutes);

// DEBUG: Log todas las peticiones
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.path} - Origin: ${req.get('origin')}`);
  next();
});

// Health Check
app.get("/api/health", async (_req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ status: "Backend Orion funcionando", database: "SQLite conectada", timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: "Backend Orion funcionando", database: "SQLite desconectada", timestamp: new Date().toISOString() });
  }
});

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start
async function start() {
  await connectDatabase();

  app.listen(PORT, () => {
    if (process.env.NODE_ENV !== "production") {
      process.stdout.write(`[Flux] Servidor en http://localhost:${PORT}\n`);
      process.stdout.write(`[Flux] Entorno: ${process.env.NODE_ENV}\n`);
    }
  });
}

start().catch((err) => {
  process.stderr.write(`[Flux] Error fatal: ${err}\n`);
  process.exit(1);
});

// Graceful Shutdown
process.on("SIGINT", () => {
  db.close();
  process.exit(0);
});