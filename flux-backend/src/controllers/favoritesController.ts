import { Response } from "express";
import db from "../config/db";
import { AuthenticatedRequest } from "../middleware/auth";
import crypto from "crypto";

export class FavoriteController {
  static async getFavorites(req: AuthenticatedRequest, res: Response) {
    try {
      const favorites = db.prepare(
        "SELECT * FROM Favorite WHERE userId = ? ORDER BY createdAt DESC"
      ).all(req.userId!);
      res.json({ data: favorites });
    } catch {
      res.status(500).json({ error: "Error al obtener favoritos" });
    }
  }

  static async addFavorite(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { url, title, icon } = req.body;
      if (!url || !title) {
        return res.status(400).json({ error: "URL y título son requeridos" });
      }

      const existing = db.prepare(
        "SELECT id FROM Favorite WHERE url = ? AND userId = ?"
      ).get(url, userId);
      if (existing) return res.status(400).json({ error: "El favorito ya existe" });

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO Favorite (id, url, title, icon, createdAt, userId) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, url, title, icon ?? null, now, userId);

      const favorite = db.prepare("SELECT * FROM Favorite WHERE id = ?").get(id);
      res.status(201).json({ message: "Favorito agregado exitosamente", data: favorite });
    } catch {
      res.status(500).json({ error: "Error al agregar favorito" });
    }
  }

  static async deleteFavorite(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const existing = db.prepare("SELECT id FROM Favorite WHERE id = ? AND userId = ?").get(id, userId);
      if (!existing) return res.status(404).json({ error: "Favorito no encontrado" });
      db.prepare("DELETE FROM Favorite WHERE id = ?").run(id);
      res.json({ message: "Favorito eliminado exitosamente" });
    } catch {
      res.status(500).json({ error: "Error al eliminar favorito" });
    }
  }
}
