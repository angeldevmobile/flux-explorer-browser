import { Response } from "express";
import prisma from "../config/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { EncryptionService } from "../services/encrytionService";

export class UserController {
  /**
   * GET /api/user/profile
   */
  static async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              favorites: true,
              history: true,
              tabs: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      res.json({ data: user });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener perfil" });
    }
  }

  /**
   * PUT /api/user/profile - Actualizar perfil
   */
  static async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { username, email } = req.body;

      // Verificar unicidad si cambian
      if (email) {
        const existing = await prisma.user.findFirst({
          where: { email, NOT: { id: userId } },
        });
        if (existing) {
          return res.status(400).json({ error: "El email ya está en uso" });
        }
      }

      if (username) {
        const existing = await prisma.user.findFirst({
          where: { username, NOT: { id: userId } },
        });
        if (existing) {
          return res.status(400).json({ error: "El username ya está en uso" });
        }
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(username && { username }),
          ...(email && { email }),
        },
        select: {
          id: true,
          email: true,
          username: true,
          updatedAt: true,
        },
      });

      res.json({ message: "Perfil actualizado", data: user });
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar perfil" });
    }
  }

  /**
   * PUT /api/user/password - Cambiar contraseña
   */
  static async changePassword(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: "Contraseña actual y nueva son requeridas",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          error: "La nueva contraseña debe tener al menos 6 caracteres",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const isValid = await EncryptionService.comparePassword(
        currentPassword,
        user.password
      );

      if (!isValid) {
        return res.status(400).json({ error: "Contraseña actual incorrecta" });
      }

      const hashedPassword = await EncryptionService.hashPassword(newPassword);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      res.json({ message: "Contraseña actualizada exitosamente" });
    } catch (error) {
      res.status(500).json({ error: "Error al cambiar contraseña" });
    }
  }

  /**
   * DELETE /api/user - Eliminar cuenta
   */
  static async deleteAccount(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;

      await prisma.user.delete({
        where: { id: userId },
      });

      res.json({ message: "Cuenta eliminada exitosamente" });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar cuenta" });
    }
  }
}