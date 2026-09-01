import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/db';
import { weeklyPlans, dailyMeals } from '@/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { todayStr, addDays, dayOfWeekOf } from '@/lib/utils';

type Dish = {
  id: number;
  name: string;
  calories: number;
  protein: number;
  ingredients: any[];
  steps: string[];
  mealType: string;
  sortOrder: number;
};

type DayMeals = {
  breakfast: Dish[];
  lunch: Dish[];
  dinner: Dish[];
  snack: Dish[];
};

type DayData = {
  date: string;
  dayOfWeek: number;
  meals: DayMeals;
  calories: number;
  protein: number;
};

type WindowDay = DayData & {
  label: 'dayBeforeYesterday' | 'yesterday' | 'today' | 'tomorrow' | 'weekday';
  hasData: boolean;
};

const EMPTY_MEALS: DayMeals = { breakfast: [], lunch: [], dinner: [], snack: [] };

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const db = getDb();

  // Get active plan
  const plan = await db.select()
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.userId, user.id), eq(weeklyPlans.status, 'active')))
    .orderBy(desc(weeklyPlans.createdAt))
    .limit(1)
    .get();

  if (!plan) {
    return Response.json({ plan: null, days: [], needsRoll: false });
  }

  // Get all daily meals for this plan, grouped by date
  const meals = await db.select()
    .from(dailyMeals)
    .where(eq(dailyMeals.planId, plan.id))
    .orderBy(asc(dailyMeals.date), asc(dailyMeals.sortOrder))
    .all();

  const daysMap = new Map<string, DayData>();

  for (const meal of meals) {
    const dish: Dish = {
      id: meal.id,
      name: meal.dishName,
      calories: meal.calories || 0,
      protein: meal.protein || 0,
      ingredients: JSON.parse(meal.ingredientsJson || '[]'),
      steps: JSON.parse(meal.stepsJson || '[]'),
      mealType: meal.mealType,
      sortOrder: meal.sortOrder,
    };

    if (!daysMap.has(meal.date)) {
      daysMap.set(meal.date, {
        date: meal.date,
        dayOfWeek: meal.dayOfWeek,
        meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
        calories: 0,
        protein: 0,
      });
    }

    const day = daysMap.get(meal.date)!;
    const mealType = meal.mealType as keyof DayMeals;

    if (day.meals[mealType]) {
      day.meals[mealType].push(dish);
    }

    day.calories += dish.calories;
    day.protein += dish.protein;
  }

  // 展示窗口：今天 ~ 第 7 天（从今天开始的完整一周）
  const today = todayStr();
  const windowDays: WindowDay[] = [];
  for (let offset = 0; offset <= 6; offset++) {
    const dateStr = addDays(today, offset);
    const dayData = daysMap.get(dateStr);
    const ourDayOfWeek = dayOfWeekOf(dateStr);

    const label: WindowDay['label'] = offset === 0 ? 'today' : offset === 1 ? 'tomorrow' : 'weekday';

    windowDays.push({
      date: dateStr,
      dayOfWeek: ourDayOfWeek,
      label,
      meals: dayData?.meals ?? EMPTY_MEALS,
      calories: dayData?.calories ?? 0,
      protein: dayData?.protein ?? 0,
      hasData: !!dayData,
    });
  }

  // 明天及未来（窗口内 index 1..6）有缺失则需续期补齐
  const needsRoll = windowDays.some((d, idx) => idx >= 1 && !d.hasData);

  return Response.json({
    plan,
    days: windowDays,
    needsRoll,
  });
}