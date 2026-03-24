import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || "3000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL || "",
  JWT_SECRET: process.env.JWT_SECRET || "your-secret-key",
  JWT_EXPIRE: process.env.JWT_EXPIRE || "7d",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || "",
  SEARXNG_URL: process.env.SEARXNG_URL || "http://localhost:8080",
};