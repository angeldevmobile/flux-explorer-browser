import { Response } from "express";
import prisma from "../config/prisma";
import { AuthenticatedRequest } from "../middleware/auth";

export class AiHistoryController {
  static async getHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const limit = Number(req.query.limit) || 50;

      const conversations = await prisma.aiConversation.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: { id: true, query: true, response: true, createdAt: true },
      });

      res.json({ data: conversations });
    } catch {
      res.status(500).json({ error: "Error al obtener historial AI" });
    }
  }

  static async saveConversation(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { query, response } = req.body;

      if (!query || !response) {
        return res.status(400).json({ error: "query y response son requeridos" });
      }

      const conversation = await prisma.aiConversation.create({
        data: { query, response, userId },
      });

      res.status(201).json({ data: conversation });
    } catch {
      res.status(500).json({ error: "Error al guardar conversación AI" });
    }
  }

  static async deleteConversation(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const existing = await prisma.aiConversation.findFirst({ where: { id, userId } });
      if (!existing) return res.status(404).json({ error: "No encontrado" });

      await prisma.aiConversation.delete({ where: { id } });
      res.json({ message: "Eliminado" });
    } catch {
      res.status(500).json({ error: "Error al eliminar" });
    }
  }

  static async clearHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      await prisma.aiConversation.deleteMany({ where: { userId } });
      res.json({ message: "Historial AI limpiado" });
    } catch {
      res.status(500).json({ error: "Error al limpiar historial AI" });
    }
  }
}
