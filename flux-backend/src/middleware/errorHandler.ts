import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  status?: number;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("Error:", err.message);

  const status = err.status || 500;
  const message = err.message || "Error interno del servidor";

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Ruta no encontrada" });
}