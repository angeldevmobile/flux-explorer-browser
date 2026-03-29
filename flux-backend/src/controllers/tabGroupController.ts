import { Response } from "express";
import db from "../config/db";
import { AuthenticatedRequest } from "../types/authType";
import crypto from "crypto";

export class TabGroupController {
  static async getAll(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const groups = db.prepare(
        "SELECT * FROM TabGroup WHERE userId = ? ORDER BY createdAt ASC"
      ).all(userId) as { id: string; name: string; color: string; collapsed: number; userId: string; createdAt: string }[];

      const tabs = db.prepare(
        "SELECT id, groupId FROM Tab WHERE userId = ? AND groupId IS NOT NULL"
      ).all(userId) as { id: string; groupId: string }[];

      const result = groups.map((g) => ({
        ...g,
        collapsed: !!g.collapsed,
        tabIds: tabs.filter((t) => t.groupId === g.id).map((t) => t.id),
      }));

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { name, color, tabIds } = req.body;
      if (!name || typeof name !== "string" || !color) {
        return res.status(400).json({ success: false, error: "name and color are required" });
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO TabGroup (id, name, color, userId, createdAt) VALUES (?, ?, ?, ?, ?)"
      ).run(id, name.slice(0, 50), color, userId, now);

      if (Array.isArray(tabIds) && tabIds.length > 0) {
        const updateTab = db.prepare(
          "UPDATE Tab SET groupId = ? WHERE id = ? AND userId = ?"
        );
        for (const tabId of tabIds) updateTab.run(id, tabId, userId);
      }

      const group = db.prepare("SELECT * FROM TabGroup WHERE id = ?").get(id) as Record<string, unknown>;
      res.status(201).json({ success: true, data: { ...group, tabIds: tabIds || [] } });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  static async addTab(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { groupId } = req.params;
      const { tabId } = req.body;
      if (!tabId) return res.status(400).json({ success: false, error: "tabId is required" });

      const group = db.prepare("SELECT id FROM TabGroup WHERE id = ? AND userId = ?").get(groupId, userId);
      if (!group) return res.status(404).json({ success: false, error: "Group not found" });

      db.prepare("UPDATE Tab SET groupId = ? WHERE id = ? AND userId = ?").run(groupId, tabId, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  static async removeTab(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { tabId } = req.params;
      db.prepare("UPDATE Tab SET groupId = NULL WHERE id = ? AND userId = ?").run(tabId, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const group = db.prepare("SELECT id FROM TabGroup WHERE id = ? AND userId = ?").get(id, userId);
      if (!group) return res.status(404).json({ success: false, error: "Group not found" });

      db.prepare("UPDATE Tab SET groupId = NULL WHERE groupId = ? AND userId = ?").run(id, userId);
      db.prepare("DELETE FROM TabGroup WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }
}
