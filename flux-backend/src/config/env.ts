import dotenv from "dotenv";
dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret === "your-secret-key" || jwtSecret.length < 32) {
  throw new Error(
    "JWT_SECRET no está configurado o es inseguro. " +
    "Genera uno con: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\" " +
    "y agrégalo al archivo .env"
  );
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL no está configurada en .env");
}

export const env = {
  PORT: parseInt(process.env.PORT || "3000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: dbUrl,
  JWT_SECRET: jwtSecret,
  JWT_EXPIRE: process.env.JWT_EXPIRE || "7d",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || "",
  SEARXNG_URL: process.env.SEARXNG_URL || "http://34.229.141.6:8080",
};