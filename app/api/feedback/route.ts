import { and, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/db';
import { planFeedback, weeklyPlans } from '@/db/schema';
import { todayStr } from '@/lib/utils';

export async function POST(request: Request) {
  const user = await getCurrentUser(request.headers.get('cookie'));
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { planId?: number; execution?: string };
  if (!Number.isInteger(body.planId) || !['difficult', 'okay', 'smooth'].includes(body.execution ?? '')) return Response.json({ error: '反馈参数无效。' }, { status: 400 });
  const plan = await getDb().select({ id: weeklyPlans.id }).from(weeklyPlans).where(and(eq(weeklyPlans.id, body.planId!), eq(weeklyPlans.userId, user.id))).get();
  if (!plan) return Response.json({ error: '计划不存在。' }, { status: 404 });
  const date = todayStr();
  const createdAt = new Date().toISOString();
  await getDb().insert(planFeedback).values({ userId: user.id, planId: plan.id, date, execution: body.execution!, createdAt }).onConflictDoUpdate({ target: [planFeedback.userId, planFeedback.planId, planFeedback.date], set: { execution: body.execution!, createdAt } });
  return Response.json({ ok: true, date, execution: body.execution });
}
