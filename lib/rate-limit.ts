import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { rateLimits } from '@/db/schema';

async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export async function enforceRateLimit(bucket: string, identifier: string, limit: number, windowSeconds: number) {
  const key = `${bucket}:${await digest(identifier)}`;
  const now = Math.floor(Date.now() / 1000);
  const db = getDb();
  const current = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).get();
  if (!current || now - current.windowStart >= windowSeconds) {
    await db.insert(rateLimits).values({ key, windowStart: now, count: 1, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: rateLimits.key, set: { windowStart: now, count: 1, updatedAt: new Date().toISOString() } });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }
  if (current.count >= limit) return { allowed: false, remaining: 0, retryAfter: Math.max(1, windowSeconds - (now - current.windowStart)) };
  await db.update(rateLimits).set({ count: current.count + 1, updatedAt: new Date().toISOString() }).where(eq(rateLimits.key, key));
  return { allowed: true, remaining: limit - current.count - 1, retryAfter: 0 };
}
