import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/db';
import { weeklyPlans, dailyMeals, aiInsights } from '@/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { todayStr } from '@/lib/utils';

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const db = getDb();
  const today = todayStr();

  // Get active plan
  const plan = await db.select()
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.userId, user.id), eq(weeklyPlans.status, 'active')))
    .orderBy(desc(weeklyPlans.createdAt))
    .limit(1)
    .get();

  // Today's meals
  let todayMeals: any[] = [];
  if (plan) {
    todayMeals = await db.select()
      .from(dailyMeals)
      .where(and(eq(dailyMeals.planId, plan.id), eq(dailyMeals.date, today)))
      .orderBy(dailyMeals.sortOrder)
      .all();
  }

  // Group by meal type
  const mealsByType: Record<string, any[]> = {};
  for (const meal of todayMeals) {
    if (!mealsByType[meal.mealType]) mealsByType[meal.mealType] = [];
    mealsByType[meal.mealType].push({
      ...meal,
      name: meal.dishName,
      ingredients: JSON.parse(meal.ingredientsJson || '[]'),
      steps: JSON.parse(meal.stepsJson || '[]'),
    });
  }

  // Calculate today's totals
  const todayCalories = todayMeals.reduce((s, m) => s + (m.calories || 0), 0);
  const todayProtein = todayMeals.reduce((s, m) => s + (m.protein || 0), 0);

  // Unread insights (top 5 by priority)
  const insights = await db.select()
    .from(aiInsights)
    .where(and(eq(aiInsights.userId, user.id), isNull(aiInsights.readAt)))
    .orderBy(desc(aiInsights.priority), desc(aiInsights.createdAt))
    .limit(5)
    .all();

  return Response.json({
    plan,
    today: {
      date: today,
      calories: todayCalories,
      protein: todayProtein,
      meals: mealsByType,
    },
    insights,
    hasPlan: !!plan,
  });
}
