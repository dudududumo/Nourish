import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { users, sessions } from '@/db/schema';

export type AuthUser = {
  id: string;
  phone: string;
  nickname: string | null;
};

const SESSION_DAYS = 30;
const SESSION_COOKIE = 'nourish_session';

function generateId(): string {
  return crypto.randomUUID();
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 48);
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'nourish_salt_v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

function getSessionTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

export async function registerUser(phone: string, password: string, nickname?: string): Promise<AuthUser> {
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    throw new Error('请输入正确的手机号');
  }
  if (password.length < 6) {
    throw new Error('密码至少 6 位');
  }

  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.phone, phone)).get();
  if (existing) {
    throw new Error('该手机号已注册');
  }

  const id = generateId();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    id,
    phone,
    passwordHash,
    nickname: nickname || null,
    createdAt: now,
    updatedAt: now,
  });

  return { id, phone, nickname: nickname || null };
}

export async function loginUser(phone: string, password: string): Promise<{ user: AuthUser; token: string }> {
  if (!phone || !password) {
    throw new Error('请输入手机号和密码');
  }

  const db = getDb();
  const user = await db.select().from(users).where(eq(users.phone, phone)).get();
  if (!user) {
    throw new Error('手机号或密码错误');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new Error('手机号或密码错误');
  }

  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    id: generateId(),
    userId: user.id,
    token,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  });

  return {
    user: { id: user.id, phone: user.phone, nickname: user.nickname },
    token,
  };
}

export async function logoutUser(token: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function getCurrentUser(cookieHeader: string | null): Promise<AuthUser | null> {
  const token = getSessionTokenFromCookie(cookieHeader);
  if (!token) return null;

  const db = getDb();
  const session = await db.select().from(sessions).where(eq(sessions.token, token)).get();
  if (!session) return null;

  // Check if expired
  if (new Date(session.expiresAt) < new Date()) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return null;
  }

  const user = await db.select().from(users).where(eq(users.id, session.userId)).get();
  if (!user) return null;

  return { id: user.id, phone: user.phone, nickname: user.nickname };
}

export function sessionCookie(token: string, days = SESSION_DAYS): string {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  return `${SESSION_COOKIE}=${token}; Path=/; Expires=${expires}; HttpOnly; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`;
}

export { SESSION_COOKIE };
