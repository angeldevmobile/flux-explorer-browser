import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const preferencesService = {
  async get(userId: string) {
    let prefs = await prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await prisma.userPreference.create({
        data: { userId },
      });
    }

    return prefs;
  },

  async update(userId: string, data: Partial<{
    theme: string;
    defaultZoom: number;
    blockTrackers: boolean;
    blockThirdPartyCookies: boolean;
    antiFingerprint: boolean;
    forceHttps: boolean;
    blockMining: boolean;
  }>) {
    return prisma.userPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  },
};