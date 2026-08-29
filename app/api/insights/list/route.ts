import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/db';
import { aiInsights } from '@/db/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';

// scope=all 返回全部；body 返回身体/营养/习惯类；fridge 只返回冰箱类
export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const scope = new URL(request.url).searchParams.get('scope') || 'all';

  try {
    const db = getDb();
    const conds = [eq(aiInsights.userId, user.id)];
    if (scope === 'body') {
      conds.push(inArray(aiInsights.category, ['body', 'nutrition', 'habit']));
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