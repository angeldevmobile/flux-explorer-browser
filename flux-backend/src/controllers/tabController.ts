import { Response } from "express";
import db from "../config/db";
import { AuthenticatedRequest } from "../types/authType";
import crypto from "crypto";

export class TabController {
  static async getTabs(req: AuthenticatedRequest, res: Response) {
    try {
      const tabs = db.prepare(
        "SELECT * FROM Tab WHERE userId = ? ORDER BY createdAt DESC"
      ).all(req.userId!);
      res.json({ data: tabs });
    } catch {
      res.status(500).json({ error: "Error al obtener tabs" });
    }
  }

  static async createTab(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { url, title, favicon } = req.body;
      if (!url || !title) return res.status(400).json({ error: "URL y título son requeridos" });

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO Tab (id, url, title, favicon, createdAt, userId) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, url, title, favicon ?? null, now, userId);

      const tab = db.prepare("SELECT * FROM Tab WHERE id = ?").get(id);
      res.status(201).json({ message: "Tab creada exitosamente", data: tab });
    } catch {
      res.status(500).json({ error: "Error al crear tab" });
    }
  }

  static async updateTab(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { url, title, favicon } = req.body;

      const existing = db.prepare("SELECT id FROM Tab WHERE id = ? AND userId = ?").get(id, userId);
      if (!existing) return res.status(404).json({ error: "Tab no encontrada" });

      db.prepare(
        "UPDATE Tab SET url = COALESCE(?, url), title = COALESCE(?, title), favicon = COALESCE(?, favicon) WHERE id = ?"
      ).run(url ?? null, title ?? null, favicon ?? null, id);

      const tab = db.prepare("SELECT * FROM Tab WHERE id = ?").get(id);
      res.json({ message: "Tab actualizada exitosamente", data: tab });
    } catch {
      res.status(500).json({ error: "Error al actualizar tab" });
    }
  }

  static async deleteTab(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const existing = db.prepare("SELECT id FROM Tab WHERE id = ? AND userId = ?").get(id, userId);
      if (!existing) return res.status(404).json({ error: "Tab no encontrada" });
      db.prepare("DELETE FROM Tab WHERE id = ?").run(id);
      res.json({ message: "Tab eliminada exitosamente" });
    } catch {
      res.status(500).json({ error: "Error al eliminar tab" });
    }
  }
}
