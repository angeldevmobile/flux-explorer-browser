import { Response } from "express";
import db from "../config/db";
import { AuthenticatedRequest } from "../middleware/auth";
import { EncryptionService } from "../services/encryptionService";

export class UserController {
  static async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const user = db.prepare(
        "SELECT id, email, username, createdAt, updatedAt FROM User WHERE id = ?"
      ).get(userId) as { id: string; email: string; username: string; createdAt: string; updatedAt: string } | undefined;

      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

      const favCount = (db.prepare("SELECT COUNT(*) as c FROM Favorite WHERE userId = ?").get(userId) as { c: number }).c;
      const histCount = (db.prepare("SELECT COUNT(*) as c FROM History WHERE userId = ?").get(userId) as { c: number }).c;
      const tabCount = (db.prepare("SELECT COUNT(*) as c FROM Tab WHERE userId = ?").get(userId) as { c: number }).c;

      res.json({ data: { ...user, _count: { favorites: favCount, history: histCount, tabs: tabCount } } });
    } catch {
      res.status(500).json({ error: "Error al obtener perfil" });
    }
  }

  static async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { username, email } = req.body;

      if (email) {
        const existing = db.prepare("SELECT id FROM User WHERE email = ? AND id != ?").get(email, userId);
        if (existing) return res.status(400).json({ error: "El email ya está en uso" });
      }
      if (username) {
        const existing = db.prepare("SELECT id FROM User WHERE username = ? AND id != ?").get(username, userId);
        if (existing) return res.status(400).json({ error: "El username ya está en uso" });
      }

      const now = new Date().toISOString();
      if (username) db.prepare("UPDATE User SET username = ?, updatedAt = ? WHERE id = ?").run(username, now, userId);
      if (email) db.prepare("UPDATE User SET email = ?, updatedAt = ? WHERE id = ?").run(email, now, userId);

      const user = db.prepare("SELECT id, email, username, updatedAt FROM User WHERE id = ?").get(userId);
      res.json({ message: "Perfil actualizado", data: user });
    } catch {
      res.status(500).json({ error: "Error al actualizar perfil" });
    }
  }

  static async changePassword(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Contraseña actual y nueva son requeridas" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres" });
      }

      const user = db.prepare("SELECT password FROM User WHERE id = ?").get(userId) as { password: string } | undefined;
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

      const isValid = await EncryptionService.comparePassword(currentPassword, user.password);
      if (!isValid) return res.status(400).json({ error: "Contraseña actual incorrecta" });

      const hashed = await EncryptionService.hashPassword(newPassword);
      db.prepare("UPDATE User SET password = ?, updatedAt = ? WHERE id = ?").run(hashed, new Date().toISOString(), userId);
      res.json({ message: "Contraseña actualizada exitosamente" });
    } catch {
      res.status(500).json({ error: "Error al cambiar contraseña" });
    }
  }

  static async deleteAccount(req: AuthenticatedRequest, res: Response) {
    try {
      db.prepare("DELETE FROM User WHERE id = ?").run(req.userId!);
      res.json({ message: "Cuenta eliminada exitosamente" });
    } catch {
      res.status(500).json({ error: "Error al eliminar cuenta" });
    }
  }
}
