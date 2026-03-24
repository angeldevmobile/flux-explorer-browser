import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const focusService = {
  // --- Blocked Sites ---
  async getBlockedSites(userId: string) {
    return prisma.blockedSite.findMany({ where: { userId } });
  },

  async addBlockedSite(userId: string, domain: string) {
    return prisma.blockedSite.create({
      data: { domain, userId },
    });
  },

  async removeBlockedSite(id: string, userId: string) {
    return prisma.blockedSite.deleteMany({
      where: { id, userId },
    });
  },

  // --- Focus Sessions ---
  async startSession(userId: string, durationMs: number) {
    return prisma.focusSession.create({
      data: { durationMs, userId },
    });
  },

  async endSession(id: string, userId: string, elapsedMs: number, completed: boolean) {
    return prisma.focusSession.updateMany({
      where: { id, userId },
      data: { elapsedMs, completed },
    });
  },

  async getSessionHistory(userId: string, limit = 20) {
    return prisma.focusSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
};