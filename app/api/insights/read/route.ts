import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/db';
import { aiInsights } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const body = await request.json() as { id?: number; all?: boolean };
  const db = getDb();
  const now = new Date().toISOString();

  if (body.all) {
    await db.update(aiInsights)
      .set({ readAt: now })
      .where(and(eq(aiInsights.userId, user.id), eq(aiInsights.readAt, '' as any)));
  } else if (body.id) {
    await db.update(aiInsights)
      .set({ readAt: now })
      .where(and(eq(aiInsights.id, body.id), eq(aiInsights.userId, user.id)));
  }

  return Response.json({ ok: true });
}
