import { Response } from "express";
import { tasksService } from "../services/taskService";
import { AuthenticatedRequest } from "../types/authType";

export const tasksController = {
  async getAll(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const tasks = await tasksService.getAll(userId);
      res.json({ success: true, data: tasks });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  },

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { text } = req.body;

      if (!text) {
        return res.status(400).json({ success: false, error: "text is required" });
      }

      const task = await tasksService.create(userId, text);
      res.status(201).json({ success: true, data: task });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  },

  async toggle(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const task = await tasksService.toggle(id, userId);
      res.json({ success: true, data: task });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  },

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      await tasksService.delete(id, userId);
      res.json({ success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  },
};