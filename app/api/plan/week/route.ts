import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/db';
import { weeklyPlans, dailyMeals } from '@/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';

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
    return Response.json({ plan: null, days: [] });
  }

  // Get all daily meals for this plan, sorted by date and sortOrder
  const meals = await db.select()
    .from(dailyMeals)
    .where(eq(dailyMeals.planId, plan.id))
    .orderBy(asc(dailyMeals.date), asc(dailyMeals.sortOrder))
    .all();

  // Group meals by date
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
        meals: {
          breakfast: [],
          lunch: [],
          dinner: [],
          snack: [],
        },
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

  // Convert map to sorted array
  const days = Array.from(daysMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return Response.json({
    plan,
    days,
  });
}
