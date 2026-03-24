import { Response } from "express";
import { preferencesService } from "../services/preferentService";
import { AuthenticatedRequest } from "../types/authType";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export const preferencesController = {
  async get(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const prefs = await preferencesService.get(userId);
      res.json({ success: true, data: prefs });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  },

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const prefs = await preferencesService.update(userId, req.body);
      res.json({ success: true, data: prefs });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  },
};