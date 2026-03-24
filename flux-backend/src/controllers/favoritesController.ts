import { Response } from "express";
import prisma from "../config/prisma";
import { AuthenticatedRequest } from "../middleware/auth";

export class FavoriteController {
  /**
   * GET /api/favorites - Obtener todos los favoritos del usuario
   */
  static async getFavorites(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;

      const favorites = await prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ data: favorites });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener favoritos" });
    }
  }

  /**
   * POST /api/favorites - Agregar un favorito
   */
  static async addFavorite(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { url, title, icon } = req.body;

      if (!url || !title) {
        return res.status(400).json({ error: "URL y título son requeridos" });
      }

      // Verificar si ya existe el favorito
      const existing = await prisma.favorite.findFirst({
        where: { url, userId },
      });

      if (existing) {
        return res.status(400).json({ error: "El favorito ya existe" });
      }

      const favorite = await prisma.favorite.create({
        data: {
          url,
          title,
          icon,
          userId,
        },
      });

      res.status(201).json({ 
        message: "Favorito agregado exitosamente",
        data: favorite 
      });
    } catch (error) {
      res.status(500).json({ error: "Error al agregar favorito" });
    }
  }

  /**
   * DELETE /api/favorites/:id - Eliminar un favorito
   */
  static async deleteFavorite(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      // Verificar que el favorito pertenece al usuario
      const existing = await prisma.favorite.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        return res.status(404).json({ error: "Favorito no encontrado" });
      }

      await prisma.favorite.delete({
        where: { id },
      });

      res.json({ message: "Favorito eliminado exitosamente" });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar favorito" });
    }
  }
}