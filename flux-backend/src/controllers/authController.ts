import { Request, Response } from "express";
import { AuthService } from "../services/authService";
import prisma from "../config/prisma";
import { AuthenticatedRequest } from "../types/authType";

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { email, password, username } = req.body;

      if (!email || !password || !username) {
        return res.status(400).json({ 
          error: "Email, password y username son requeridos" 
        });
      }

      const result = await AuthService.register({ email, password, username });

      res.status(201).json({
        message: "Usuario registrado exitosamente",
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Error al registrar usuario" });
      }
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ 
          error: "Email y password son requeridos" 
        });
      }

      const result = await AuthService.login({ email, password });

      res.json({
        message: "Login exitoso",
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(401).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Error al iniciar sesión" });
      }
    }
  }

  static async getCurrentUser(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          createdAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      res.json({ data: user });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener usuario" });
    }
  }
}