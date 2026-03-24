import path from "path";
import { PrismaClient } from "@prisma/client";

// Cuando el backend corre como exe compilado con pkg, process.pkg existe.
// El archivo flux.db se guarda junto al ejecutable, no en el cwd.
function getDbUrl(): string {
  if ((process as NodeJS.Process & { pkg?: unknown }).pkg) {
    const exeDir = path.dirname(process.execPath);
    return `file:${path.join(exeDir, "flux.db")}`;
  }
  return process.env.DATABASE_URL ?? "file:./flux.db";
}

process.env.DATABASE_URL = getDbUrl();

const prisma = new PrismaClient();

export default prisma;