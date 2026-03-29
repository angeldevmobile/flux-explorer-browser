import { Response } from "express";
import db from "../config/db";
import { AuthenticatedRequest } from "../middleware/auth";
import crypto from "crypto";

export class AiHistoryController {
  static async getHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const limit = Number(req.query.limit) || 50;
      const rows = db.prepare(
        "SELECT id, query, response, createdAt FROM AiConversation WHERE userId = ? ORDER BY createdAt DESC LIMIT ?"
      ).all(req.userId!, limit);
      res.json({ data: rows });
    } catch {
      res.status(500).json({ error: "Error al obtener historial AI" });
    }
  }

  static async saveConversation(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { query, response } = req.body;
      if (!query || !response) return res.status(400).json({ error: "query y response son requeridos" });

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO AiConversation (id, query, response, userId, createdAt) VALUES (?, ?, ?, ?, ?)"
      ).run(id, query, response, userId, now);

      const conversation = db.prepare("SELECT * FROM AiConversation WHERE id = ?").get(id);
      res.status(201).json({ data: conversation });
    } catch {
      res.status(500).json({ error: "Error al guardar conversación AI" });
    }
  }

  static async deleteConversation(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const existing = db.prepare("SELECT id FROM AiConversation WHERE id = ? AND userId = ?").get(id, userId);
      if (!existing) return res.status(404).json({ error: "No encontrado" });
      db.prepare("DELETE FROM AiConversation WHERE id = ?").run(id);
      res.json({ message: "Eliminado" });
    } catch {
      res.status(500).json({ error: "Error al eliminar" });
    }
  }

  static async clearHistory(req: AuthenticatedRequest, res: Response) {
    try {
      db.prepare("DELETE FROM AiConversation WHERE userId = ?").run(req.userId!);
      res.json({ message: "Historial AI limpiado" });
    } catch {
      res.status(500).json({ error: "Error al limpiar historial AI" });
    }
  }
}
