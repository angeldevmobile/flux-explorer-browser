import jwt from "jsonwebtoken";
import db from "../config/db";
import { EncryptionService } from "./encryptionService";
import { env } from "../config/env";
import crypto from "crypto";

const JWT_SECRET = env.JWT_SECRET;
const JWT_EXPIRES_IN = env.JWT_EXPIRE;

export interface RegisterData {
  email: string;
  password: string;
  username: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export class AuthService {
  static async register(data: RegisterData) {
    const existing = db.prepare("SELECT id FROM User WHERE email = ?").get(data.email);
    if (existing) throw new Error("El email ya está registrado");

    const existingUsername = db.prepare("SELECT id FROM User WHERE username = ?").get(data.username);
    if (existingUsername) throw new Error("El nombre de usuario ya está en uso");

    const hashedPassword = await EncryptionService.hashPassword(data.password);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      "INSERT INTO User (id, email, password, username, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, data.email, hashedPassword, data.username, now, now);

    const user = db.prepare("SELECT id, email, username, createdAt FROM User WHERE id = ?").get(id) as {
      id: string; email: string; username: string; createdAt: string;
    };

    const token = this.generateToken(user.id);
    return { user, token };
  }

  static async login(data: LoginData) {
    const user = db.prepare("SELECT * FROM User WHERE email = ?").get(data.email) as {
      id: string; email: string; password: string; username: string;
    } | undefined;

    if (!user) throw new Error("Credenciales inválidas");

    const isPasswordValid = await EncryptionService.comparePassword(data.password, user.password);
    if (!isPasswordValid) throw new Error("Credenciales inválidas");

    const token = this.generateToken(user.id);
    return { user: { id: user.id, email: user.email, username: user.username }, token };
  }

  static async localLogin() {
    const email = "local@flux.app";
    const username = "local";

    let user = db.prepare("SELECT id, email, username FROM User WHERE email = ?").get(email) as {
      id: string; email: string; username: string;
    } | undefined;

    if (!user) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const hashedPassword = await EncryptionService.hashPassword("flux-local-" + id);
      db.prepare(
        "INSERT INTO User (id, email, password, username, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, email, hashedPassword, username, now, now);
      user = { id, email, username };
    }

    const token = this.generateToken(user.id);
    return token;
  }

  static generateToken(userId: string): string {
    // @ts-expect-error — JWT_EXPIRES_IN es un valor ms válido
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  static verifyToken(token: string): { userId: string } {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  }
}
