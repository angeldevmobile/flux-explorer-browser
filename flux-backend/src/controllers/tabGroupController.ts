import { Response } from "express";
import prisma from "../config/prisma";
import { AuthenticatedRequest } from "../types/authType";

export class TabGroupController {
  static async getAll(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const groups = await prisma.tabGroup.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });

      // Obtener tabs con groupId para saber qué tabs están en cada grupo
      const tabs = await prisma.tab.findMany({
        where: { userId, groupId: { not: null } },
        select: { id: true, groupId: true },
      });

      const result = groups.map((g) => ({
        ...g,
        tabIds: tabs.filter((t) => t.groupId === g.id).map((t) => t.id),
      }));

      res.json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { name, color, tabIds } = req.body;

      if (!name || typeof name !== "string" || !color) {
        return res.status(400).json({ success: false, error: "name and color are required" });
      }

      const group = await prisma.tabGroup.create({
        data: { name: name.slice(0, 50), color, userId },
      });

      // Asignar tabs al grupo
      if (Array.isArray(tabIds) && tabIds.length > 0) {
        await prisma.tab.updateMany({
          where: { id: { in: tabIds }, userId },
          data: { groupId: group.id },
        });
      }

      res.status(201).json({
        success: true,
        data: { ...group, tabIds: tabIds || [] },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  }

  static async addTab(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { groupId } = req.params;
      const { tabId } = req.body;

      if (!tabId) {
        return res.status(400).json({ success: false, error: "tabId is required" });
      }

      // Verificar que el grupo pertenece al usuario
      const group = await prisma.tabGroup.findFirst({ where: { id: groupId, userId } });
      if (!group) return res.status(404).json({ success: false, error: "Group not found" });

      await prisma.tab.updateMany({
        where: { id: tabId, userId },
        data: { groupId },
      });

      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  }

  static async removeTab(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { tabId } = req.params;

      await prisma.tab.updateMany({
        where: { id: tabId, userId },
        data: { groupId: null },
      });

      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const group = await prisma.tabGroup.findFirst({ where: { id, userId } });
      if (!group) return res.status(404).json({ success: false, error: "Group not found" });

      // Desagrupar tabs
      await prisma.tab.updateMany({
        where: { groupId: id, userId },
        data: { groupId: null },
      });

      await prisma.tabGroup.delete({ where: { id } });

      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  }
}