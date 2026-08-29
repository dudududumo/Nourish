import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/db';
import { aiInsights } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  try {
    const db = getDb();
    const rows = await db.select()
      .from(aiInsights)
      .where(eq(aiInsights.userId, user.id))
      .orderBy(desc(aiInsights.createdAt))
      .limit(50)
      .all();
    return Response.json({
      insights: rows.map((r) => ({
        id: r.id, type: r.type, category: r.category,
        title: r.title, content: r.content, priority: r.priority, readAt: r.readAt, createdAt: r.createdAt,
      })),
    });
  } catch {
    return Response.json({ insights: [] });
  }
}