import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/db';
import { shoppingItems, weeklyPlans } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// GET - 获取当前活跃计划的购物清单
export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const db = getDb();

  // 获取当前活跃的周计划
  const plan = await db.select()
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.userId, user.id), eq(weeklyPlans.status, 'active')))
    .orderBy(desc(weeklyPlans.createdAt))
    .limit(1)
    .get();

  let items: any[] = [];
  if (plan) {
    const rows = await db.select()
      .from(shoppingItems)
      .where(eq(shoppingItems.planId, plan.id))
      .orderBy(shoppingItems.id)
      .all();

    items = rows.map((row) => ({
      id: row.id,
      name: row.name,
      amount: row.amount,
      reason: row.reason,
      purchased: row.purchased === 1,
    }));
  }

  return Response.json({ items });
}

// PATCH - 标记某个购物项为已采购/未采购
export async function PATCH(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const body = await request.json();
  const { id, purchased } = body;

  if (typeof id !== 'number' || typeof purchased !== 'boolean') {
    return Response.json({ error: '参数无效。' }, { status: 400 });
  }

  const db = getDb();

  // 验证购物项属于当前用户
  const item = await db.select()
    .from(shoppingItems)
    .where(and(eq(shoppingItems.id, id), eq(shoppingItems.userId, user.id)))
    .get();

  if (!item) {
    return Response.json({ error: '购物项不存在。' }, { status: 404 });
  }

  // 更新采购状态
  await db.update(shoppingItems)
    .set({ purchased: purchased ? 1 : 0 })
    .where(eq(shoppingItems.id, id))
    .run();

  return Response.json({
    success: true,
    item: {
      id: item.id,
      name: item.name,
      amount: item.amount,
      reason: item.reason,
      purchased,
    },
  });
}
