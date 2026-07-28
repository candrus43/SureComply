import { getDb, queryOne, execute, saveDb } from "./db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export interface User {
  id: number;
  email: string;
  name: string;
  company_name: string | null;
}

export interface Session {
  id: string;
  user_id: number;
  created_at: string;
}

function generateSessionId(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function ensureSessionsTable(): Promise<void> {
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  saveDb();
}

export async function createSession(userId: number): Promise<string> {
  await ensureSessionsTable();
  const sessionId = generateSessionId();
  execute("INSERT INTO sessions (id, user_id) VALUES (?, ?)", [sessionId, userId]);
  saveDb();
  return sessionId;
}

export async function getSessionFromRequest(request: Request): Promise<User | null> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies["session"];
  if (!sessionId) return null;

  await ensureSessionsTable();
  const session = queryOne<Session>(
    "SELECT * FROM sessions WHERE id = ?",
    [sessionId]
  );
  if (!session) return null;

  const user = queryOne<User>(
    "SELECT id, email, name, company_name FROM users WHERE id = ?",
    [session.user_id]
  );
  return user ?? null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await ensureSessionsTable();
  execute("DELETE FROM sessions WHERE id = ?", [sessionId]);
  saveDb();
}

export async function login(
  email: string,
  password: string
): Promise<{ user: User; sessionId: string } | null> {
  const user = queryOne<{ id: number; email: string; name: string; company_name: string | null; password_hash: string }>(
    "SELECT id, email, name, company_name, password_hash FROM users WHERE email = ?",
    [email.toLowerCase().trim()]
  );
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  const sessionId = await createSession(user.id);
  return {
    user: { id: user.id, email: user.email, name: user.name, company_name: user.company_name },
    sessionId,
  };
}

export async function signup(
  email: string,
  password: string,
  name: string
): Promise<{ user: User; sessionId: string } | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = queryOne<{ id: number }>(
    "SELECT id FROM users WHERE email = ?",
    [normalizedEmail]
  );
  if (existing) return null;

  const passwordHash = await bcrypt.hash(password, 10);
  execute(
    "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
    [normalizedEmail, passwordHash, name.trim()]
  );
  saveDb();

  const user = queryOne<User>(
    "SELECT id, email, name, company_name FROM users WHERE email = ?",
    [normalizedEmail]
  );
  if (!user) return null;

  const sessionId = await createSession(user.id);
  return { user, sessionId };
}

function parseCookies(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx > 0) {
      result[part.substring(0, idx).trim()] = decodeURIComponent(part.substring(idx + 1).trim());
    }
  });
  return result;
}

export function setSessionCookie(sessionId: string): string {
  return `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
}

export function clearSessionCookie(): string {
  return `session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
