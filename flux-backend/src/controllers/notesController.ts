import { Response } from "express";
import { notesService } from "../services/notesSrvice";
import { AuthenticatedRequest } from "../types/authType";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export const notesController = {
  async getAll(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const notes = await notesService.getAll(userId);
      res.json({ success: true, data: notes });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  },

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { text, url, color } = req.body;

      if (!text || !url) {
        return res.status(400).json({ success: false, error: "text and url are required" });
      }

      const note = await notesService.create(userId, { text, url, color: color || "" });
      res.status(201).json({ success: true, data: note });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  },

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      await notesService.delete(id, userId);
      res.json({ success: true });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  },
};