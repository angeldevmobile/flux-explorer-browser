import prisma from "./prisma";

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log("Base de datos SQLite conectada exitosamente");
  } catch (error) {
    console.error("Error al conectar con SQLite:", error);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log("Base de datos desconectada");
}