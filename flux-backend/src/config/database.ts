import db from "./db";

export async function connectDatabase(): Promise<void> {
  try {
    // Verify DB is accessible
    db.prepare("SELECT 1").get();
  } catch (error) {
    process.stderr.write(`[Flux] Error al conectar con SQLite: ${error}\n`);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  db.close();
}
