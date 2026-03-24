import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const tasksService = {
  async getAll(userId: string) {
    return prisma.quickTask.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(userId: string, text: string) {
    return prisma.quickTask.create({
      data: { text, userId },
    });
  },

  async toggle(id: string, userId: string) {
    const task = await prisma.quickTask.findFirst({ where: { id, userId } });
    if (!task) throw new Error("Task not found");
    return prisma.quickTask.update({
      where: { id },
      data: { completed: !task.completed },
    });
  },

  async delete(id: string, userId: string) {
    return prisma.quickTask.deleteMany({
      where: { id, userId },
    });
  },
};