import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { getDb } from "./db.js";

const BCRYPT_ROUNDS = 12;
const SESSION_EXPIRY_DAYS = 30;

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  is_admin: number;
  created_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token: string;
  created_at: string;
  expires_at: string;
}

function sessionExpiryDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_EXPIRY_DAYS);
  return d.toISOString();
}

export function registerUser(
  username: string,
  password: string,
  displayName: string,
): { user: UserRow; token: string } {
  const db = getDb();

  if (!username || username.length < 2) {
    throw new AuthError("Username must be at least 2 characters");
  }
  if (!password || password.length < 8) {
    throw new AuthError("Password must be at least 8 characters");
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username);
  if (existing) {
    throw new AuthError("Username already taken");
  }

  const userCount = (
    db.prepare("SELECT COUNT(*) as count FROM users").get() as {
      count: number;
    }
  ).count;
  const isAdmin = userCount === 0 ? 1 : 0;

  const userId = uuidv4();
  const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);

  db.prepare(
    `INSERT INTO users (id, username, display_name, password_hash, is_admin, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
  ).run(userId, username, displayName || username, passwordHash, isAdmin);

  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId) as UserRow;

  const token = createSession(userId);
  return { user, token };
}

export function loginUser(
  username: string,
  password: string,
): { user: UserRow; token: string } {
  const db = getDb();

  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as UserRow | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw new AuthError("Invalid username or password");
  }

  const token = createSession(user.id);
  return { user, token };
}

function createSession(userId: string): string {
  const db = getDb();
  const sessionId = uuidv4();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = sessionExpiryDate();

  db.prepare(
    `INSERT INTO sessions (id, user_id, token, created_at, expires_at)
     VALUES (?, ?, ?, datetime('now'), ?)`,
  ).run(sessionId, userId, token, expiresAt);

  return token;
}

export function validateSession(token: string): UserRow | null {
  if (!token) return null;
  const db = getDb();

  const session = db
    .prepare(
      `SELECT s.*, u.* FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > datetime('now')`,
    )
    .get(token) as (SessionRow & UserRow) | undefined;

  if (!session) return null;

  return {
    id: session.user_id,
    username: session.username,
    display_name: session.display_name,
    password_hash: session.password_hash,
    is_admin: session.is_admin,
    created_at: session.created_at,
  };
}

export function deleteSession(token: string): void {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function deleteAllUserSessions(userId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function getUserCount(): number {
  const db = getDb();
  return (
    db.prepare("SELECT COUNT(*) as count FROM users").get() as {
      count: number;
    }
  ).count;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: UserRow;
    }
  }
}

function getTokenFromReq(req: Request): string {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  // Fall back to httpOnly cookie
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    for (const pair of cookieHeader.split(";")) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) continue;
      const key = pair.slice(0, eqIdx).trim();
      if (key === "drawbook_auth") {
        return decodeURIComponent(pair.slice(eqIdx + 1).trim());
      }
    }
  }
  return "";
}

export function multiUserAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = getTokenFromReq(req);

  const user = validateSession(token);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.userId = user.id;
  req.user = user;
  next();
}
