import { Response } from "express";
import { focusService } from "../services/focusService";
import { AuthenticatedRequest } from "../types/authType";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function getErrorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    return (err as { code: string }).code;
  }
  return undefined;
}

export const focusController = {
  async getBlockedSites(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const sites = await focusService.getBlockedSites(userId);
      res.json({ success: true, data: sites });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  },

  async addBlockedSite(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { domain } = req.body;

      if (!domain) {
        return res.status(400).json({ success: false, error: "domain is required" });
      }

      const cleaned = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const site = await focusService.addBlockedSite(userId, cleaned);
      res.status(201).json({ success: true, data: site });
    } catch (error: unknown) {
      if (getErrorCode(error) === "P2002") {
        return res.status(409).json({ success: false, error: "Site already blocked" });
      }
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  },

  async removeBlockedSite(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      await focusService.removeBlockedSite(id, userId);
      res.json({ success: true });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  },

  async startSession(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { durationMs } = req.body;

      if (!durationMs || durationMs <= 0) {
        return res.status(400).json({ success: false, error: "Valid durationMs required" });
      }

      const session = await focusService.startSession(userId, durationMs);
      res.status(201).json({ success: true, data: session });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  },

  async endSession(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { elapsedMs, completed } = req.body;
      await focusService.endSession(id, userId, elapsedMs, completed);
      res.json({ success: true });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  },

  async getSessionHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const sessions = await focusService.getSessionHistory(userId);
      res.json({ success: true, data: sessions });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  },
};