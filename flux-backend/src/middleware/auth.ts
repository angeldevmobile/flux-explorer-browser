import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/authService";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Token no proporcionado" });
    }

    const { userId } = AuthService.verifyToken(token);
    req.userId = userId;

    next();
  } catch (error) {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
};