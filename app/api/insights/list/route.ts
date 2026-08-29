import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/db';
import { aiInsights } from '@/db/schema';
import { eq, desc, and, isNull, or } from 'drizzle-orm';

// 只返回未读洞察；scope=all 全部未读，body 只身体类，fridge 只冰箱类
export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const scope = new URL(request.url).searchParams.get('scope') || 'all';

  try {
    const db = getDb();
    const conds: ReturnType<typeof eq>[] = [
      eq(aiInsights.userId, user.id),
      or(isNull(aiInsights.readAt), eq(aiInsights.readAt, ''))!,
    ];
    if (scope === 'body') {
      conds.push(eq(aiInsights.category, 'body'));
    } else if (scope === 'fridge') {
      conds.push(eq(aiInsights.category, 'fridge'));
    }

    const rows = await db.select()
      .from(aiInsights)
      .where(and(...conds))
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