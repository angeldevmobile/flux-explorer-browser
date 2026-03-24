import { Response } from "express";
import { statsService } from "../services/statsService";
import { AuthenticatedRequest } from "../types/authType";

export const statsController = {
  async getTodayStats(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const stats = await statsService.getTodayStats(userId);
      const topSites = await statsService.getTopSites(userId);
      const hourlyUsage = await statsService.getHourlyUsage(userId);

      res.json({
        success: true,
        data: {
          ...stats,
          dataSavedBytes: stats.dataSavedBytes.toString(),
          topSites,
          hourlyUsage,
        },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  },

  async recordVisit(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { domain, minutes } = req.body;
      if (!domain || typeof domain !== "string") {
        res.status(400).json({ success: false, error: "domain is required" });
        return;
      }
      await statsService.recordSiteVisit(userId, domain, minutes || 1);
      res.json({ success: true });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  },

  async incrementMinutes(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { minutes } = req.body;
      await statsService.incrementMinutes(userId, minutes || 1);
      res.json({ success: true });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  },

  async syncPrivacy(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { trackersBlocked, dataSavedBytes } = req.body;
      if (typeof trackersBlocked !== "number" || typeof dataSavedBytes !== "number") {
        res.status(400).json({ success: false, error: "Invalid data" });
        return;
      }
      await statsService.syncPrivacyStats(userId, trackersBlocked, dataSavedBytes);
      res.json({ success: true });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  },

  async getWeeklyStats(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const days = Math.min(Number(req.query.days) || 7, 30);
      const data = await statsService.getWeeklyStats(userId, days);
      res.json({ success: true, data });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  },
};