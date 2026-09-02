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

const PASSWORD_ITERATIONS = 210_000;

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function derivePassword(password: string, salt: Uint8Array, iterations = PASSWORD_ITERATIONS): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, material, 256);
  return new Uint8Array(bits);
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePassword(password, salt);
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${toBase64(salt)}$${toBase64(derived)}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // One-time compatibility for accounts created before PBKDF2 was introduced.
  if (!hash.startsWith('pbkdf2-sha256$')) {
    const legacy = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password + 'nourish_salt_v1'));
    const legacyHex = Array.from(new Uint8Array(legacy)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return legacyHex === hash;
  }
  const [algorithm, iterationsText, saltText, expectedText] = hash.split('$');
  if (algorithm !== 'pbkdf2-sha256' || !iterationsText || !saltText || !expectedText) return false;
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 100_000) return false;
  const computed = await derivePassword(password, fromBase64(saltText), iterations);
  const expected = fromBase64(expectedText);
  if (computed.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < computed.length; index++) difference |= computed[index] ^ expected[index];
  return difference === 0;
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

  if (!user.passwordHash.startsWith('pbkdf2-sha256$')) {
    await db.update(users).set({ passwordHash: await hashPassword(password), updatedAt: new Date().toISOString() }).where(eq(users.id, user.id));
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
  return `${SESSION_COOKIE}=${token}; Path=/; Expires=${expires}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`;
}

export { SESSION_COOKIE };
