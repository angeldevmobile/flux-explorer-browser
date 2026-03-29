import db from "../config/db";
import crypto from "crypto";

function boolPrefs(prefs: Record<string, unknown>) {
  return {
    ...prefs,
    blockTrackers: !!prefs.blockTrackers,
    blockThirdPartyCookies: !!prefs.blockThirdPartyCookies,
    antiFingerprint: !!prefs.antiFingerprint,
    forceHttps: !!prefs.forceHttps,
    blockMining: !!prefs.blockMining,
  };
}

export const preferencesService = {
  get(userId: string) {
    let prefs = db.prepare("SELECT * FROM UserPreference WHERE userId = ?").get(userId) as Record<string, unknown> | undefined;
    if (!prefs) {
      const id = crypto.randomUUID();
      db.prepare(
        "INSERT INTO UserPreference (id, userId) VALUES (?, ?)"
      ).run(id, userId);
      prefs = db.prepare("SELECT * FROM UserPreference WHERE userId = ?").get(userId) as Record<string, unknown>;
    }
    return boolPrefs(prefs);
  },

  update(userId: string, data: Partial<{
    theme: string; defaultZoom: number; blockTrackers: boolean;
    blockThirdPartyCookies: boolean; antiFingerprint: boolean;
    forceHttps: boolean; blockMining: boolean;
  }>) {
    const existing = db.prepare("SELECT id FROM UserPreference WHERE userId = ?").get(userId);
    if (!existing) {
      const id = crypto.randomUUID();
      db.prepare("INSERT INTO UserPreference (id, userId) VALUES (?, ?)").run(id, userId);
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(typeof val === 'boolean' ? (val ? 1 : 0) : val);
    }
    if (fields.length > 0) {
      values.push(userId);
      db.prepare(`UPDATE UserPreference SET ${fields.join(', ')} WHERE userId = ?`).run(...values);
    }

    const prefs = db.prepare("SELECT * FROM UserPreference WHERE userId = ?").get(userId) as Record<string, unknown>;
    return boolPrefs(prefs);
  },
};
