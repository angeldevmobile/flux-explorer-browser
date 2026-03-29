import { Response } from "express";
import db from "../config/db";
import { AuthenticatedRequest } from "../middleware/auth";
import crypto from "crypto";

export class HistoryController {
  static async getHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { search, limit = 50 } = req.query;

      let rows;
      if (search) {
        const term = `%${search}%`;
        rows = db.prepare(
          "SELECT * FROM History WHERE userId = ? AND (url LIKE ? OR title LIKE ?) ORDER BY timestamp DESC LIMIT ?"
        ).all(userId, term, term, Number(limit));
      } else {
        rows = db.prepare(
          "SELECT * FROM History WHERE userId = ? ORDER BY timestamp DESC LIMIT ?"
        ).all(userId, Number(limit));
      }
      res.json({ data: rows });
    } catch {
      res.status(500).json({ error: "Error al obtener historial" });
    }
  }

  static async addHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { url, title } = req.body;
      if (!url || !title) return res.status(400).json({ error: "URL y título son requeridos" });

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO History (id, url, title, timestamp, userId) VALUES (?, ?, ?, ?, ?)"
      ).run(id, url, title, now, userId);

      const history = db.prepare("SELECT * FROM History WHERE id = ?").get(id);
      res.status(201).json({ message: "Historial actualizado", data: history });
    } catch {
      res.status(500).json({ error: "Error al agregar historial" });
    }
  }

  static async deleteHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const existing = db.prepare("SELECT id FROM History WHERE id = ? AND userId = ?").get(id, userId);
      if (!existing) return res.status(404).json({ error: "Entrada no encontrada" });
      db.prepare("DELETE FROM History WHERE id = ?").run(id);
      res.json({ message: "Entrada eliminada exitosamente" });
    } catch {
      res.status(500).json({ error: "Error al eliminar entrada" });
    }
  }

  static async clearHistory(req: AuthenticatedRequest, res: Response) {
    try {
      db.prepare("DELETE FROM History WHERE userId = ?").run(req.userId!);
      res.json({ message: "Historial limpiado exitosamente" });
    } catch {
      res.status(500).json({ error: "Error al limpiar historial" });
    }
  }
}
