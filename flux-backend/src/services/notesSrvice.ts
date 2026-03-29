import db from "../config/db";
import crypto from "crypto";

export const notesService = {
  getAll(userId: string) {
    return db.prepare(
      "SELECT * FROM QuickNote WHERE userId = ? ORDER BY createdAt DESC"
    ).all(userId);
  },

  create(userId: string, data: { text: string; url: string; color: string }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO QuickNote (id, text, url, color, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, data.text, data.url, data.color, userId, now, now);
    return db.prepare("SELECT * FROM QuickNote WHERE id = ?").get(id);
  },

  delete(id: string, userId: string) {
    return db.prepare("DELETE FROM QuickNote WHERE id = ? AND userId = ?").run(id, userId);
  },
};
