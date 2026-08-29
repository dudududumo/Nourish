import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/db';
import { coachMessages } from '@/db/schema';
import { eq, desc, asc, and } from 'drizzle-orm';

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  try {
    const db = getDb();
    const rows = await db.select()
      .from(coachMessages)
      .where(eq(coachMessages.userId, user.id))
      .orderBy(asc(coachMessages.createdAt))
      .limit(300)
      .all();
    return Response.json({ messages: rows.map((r) => ({ role: r.role, content: r.content, createdAt: r.createdAt })) });
  } catch {
    return Response.json({ messages: [] });
  }
}

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const body = await request.json() as { messages?: Array<{ role: string; content: string }>; role?: string; content?: string };
  const now = new Date().toISOString();
  const db = getDb();

  const toSave = Array.isArray(body.messages) && body.messages.length
    ? body.messages
    : (body.role && body.content ? [{ role: body.role, content: body.content }] : []);

  for (const m of toSave) {
    if (!m.content) continue;
    await db.insert(coachMessages).values({
      userId: user.id,
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
      createdAt: now,
    });
  }

  return Response.json({ ok: true, count: toSave.length });
}