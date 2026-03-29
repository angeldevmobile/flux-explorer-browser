import db from "../config/db";
import crypto from "crypto";

export const focusService = {
  getBlockedSites(userId: string) {
    return db.prepare("SELECT * FROM BlockedSite WHERE userId = ?").all(userId);
  },

  addBlockedSite(userId: string, domain: string) {
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO BlockedSite (id, domain, userId) VALUES (?, ?, ?)").run(id, domain, userId);
    return db.prepare("SELECT * FROM BlockedSite WHERE id = ?").get(id);
  },

  removeBlockedSite(id: string, userId: string) {
    return db.prepare("DELETE FROM BlockedSite WHERE id = ? AND userId = ?").run(id, userId);
  },

  startSession(userId: string, durationMs: number) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO FocusSession (id, durationMs, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)"
    ).run(id, durationMs, userId, now, now);
    const s = db.prepare("SELECT * FROM FocusSession WHERE id = ?").get(id) as Record<string, unknown>;
    return { ...s, completed: !!s.completed };
  },

  endSession(id: string, userId: string, elapsedMs: number, completed: boolean) {
    const now = new Date().toISOString();
    return db.prepare(
      "UPDATE FocusSession SET elapsedMs = ?, completed = ?, updatedAt = ? WHERE id = ? AND userId = ?"
    ).run(elapsedMs, completed ? 1 : 0, now, id, userId);
  },

  getSessionHistory(userId: string, limit = 20) {
    return (db.prepare(
      "SELECT * FROM FocusSession WHERE userId = ? ORDER BY createdAt DESC LIMIT ?"
    ).all(userId, limit) as (Record<string, unknown> & { completed: number })[])
      .map(s => ({ ...s, completed: !!s.completed }));
  },
};
