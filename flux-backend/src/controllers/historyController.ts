import { Response } from "express";
import prisma from "../config/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { Prisma } from "@prisma/client";

export class HistoryController {
  /**
   * GET /api/history - Obtener el historial del usuario
   */
  static async getHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { search, limit = 50 } = req.query;

      const where: Prisma.HistoryWhereInput = { userId };

      // Búsqueda opcional
      if (search) {
        where.OR = [
          { url: { contains: search as string, mode: 'insensitive' } },
          { title: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const history = await prisma.history.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: Number(limit),
      });

      res.json({ data: history });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener historial" });
    }
  }

  /**
   * POST /api/history - Agregar entrada al historial
   */
  static async addHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { url, title } = req.body;

      if (!url || !title) {
        return res.status(400).json({ error: "URL y título son requeridos" });
      }

      const history = await prisma.history.create({
        data: {
          url,
          title,
          userId,
        },
      });

      res.status(201).json({ 
        message: "Historial actualizado",
        data: history 
      });
    } catch (error) {
      res.status(500).json({ error: "Error al agregar historial" });
    }
  }

  /**
   * DELETE /api/history/:id - Eliminar entrada del historial
   */
  static async deleteHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const existing = await prisma.history.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        return res.status(404).json({ error: "Entrada no encontrada" });
      }

      await prisma.history.delete({
        where: { id },
      });

      res.json({ message: "Entrada eliminada exitosamente" });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar entrada" });
    }
  }

  /**
   * DELETE /api/history - Limpiar todo el historial
   */
  static async clearHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;

      await prisma.history.deleteMany({
        where: { userId },
      });

      res.json({ message: "Historial limpiado exitosamente" });
    } catch (error) {
      res.status(500).json({ error: "Error al limpiar historial" });
    }
  }
}