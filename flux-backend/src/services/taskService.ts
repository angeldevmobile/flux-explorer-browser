import db from "../config/db";
import crypto from "crypto";

export const tasksService = {
  getAll(userId: string) {
    return (db.prepare(
      "SELECT * FROM QuickTask WHERE userId = ? ORDER BY createdAt DESC"
    ).all(userId) as { id: string; text: string; completed: number; userId: string; createdAt: string; updatedAt: string }[])
      .map(t => ({ ...t, completed: !!t.completed }));
  },

  create(userId: string, text: string) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO QuickTask (id, text, completed, userId, createdAt, updatedAt) VALUES (?, ?, 0, ?, ?, ?)"
    ).run(id, text, userId, now, now);
    const task = db.prepare("SELECT * FROM QuickTask WHERE id = ?").get(id) as { completed: number } & Record<string, unknown>;
    return { ...task, completed: !!task.completed };
  },

  toggle(id: string, userId: string) {
    const task = db.prepare("SELECT * FROM QuickTask WHERE id = ? AND userId = ?").get(id, userId) as { completed: number } & Record<string, unknown> | undefined;
    if (!task) throw new Error("Task not found");
    const newVal = task.completed ? 0 : 1;
    const now = new Date().toISOString();
    db.prepare("UPDATE QuickTask SET completed = ?, updatedAt = ? WHERE id = ?").run(newVal, now, id);
    const updated = db.prepare("SELECT * FROM QuickTask WHERE id = ?").get(id) as { completed: number } & Record<string, unknown>;
    return { ...updated, completed: !!updated.completed };
  },

  delete(id: string, userId: string) {
    return db.prepare("DELETE FROM QuickTask WHERE id = ? AND userId = ?").run(id, userId);
  },
};
