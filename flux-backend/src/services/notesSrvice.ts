import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const notesService = {
  async getAll(userId: string) {
    return prisma.quickNote.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(userId: string, data: { text: string; url: string; color: string }) {
    return prisma.quickNote.create({
      data: { ...data, userId },
    });
  },

  async delete(id: string, userId: string) {
    return prisma.quickNote.deleteMany({
      where: { id, userId },
    });
  },
};