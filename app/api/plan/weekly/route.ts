import { getCurrentUser } from '@/lib/auth';
import { getAiSettings } from '@/lib/ai-settings';
import { getDb } from '@/db';
import { weeklyPlans, dailyMeals, shoppingItems, aiInsights } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

const SYSTEM_PROMPT = `你是"轻养"的专业营养 AI 规划师。你需要根据用户的身体数据和冰箱库存，生成 7 天的完整周食谱。

重要规则：
1. 必须返回严格的 JSON 格式，不能有任何 Markdown、解释文字或额外内容。
2. 优先使用冰箱中临期（3天内）的食材，减少浪费。
3. 每天 3 餐（早/午/晚），每餐 1-2 道菜，好吃易做，适合宿舍或小厨房。
4. 考虑用户目标（减脂/增肌/维持），合理分配热量和蛋白质。
5. 菜品多样化，不要重复太多。
6. 不给出激进热量缺口，安全第一。
7. 同时生成 3-5 条 AI 洞察（观察/建议/警示）。

返回 JSON 格式：
{
  "plan": {
    "goal": "健康减脂并提升肌肉量",
    "targetCalories": 1800,
    "targetProtein": 95,
    "rationale": "为什么这样安排，包括热量范围和蛋白质分配的原因",
    "days": [
      {
        "date": "2026-08-29",
        "dayOfWeek": 0,
        "meals": [
          {
            "type": "breakfast",
            "name": "早餐",
            "dishes": [
              {
                "name": "菜名",
                "ingredients": [{ "name": "食材", "amount": "100g", "fromFridge": true }],
                "calories": 300,
                "protein": 15,
                "steps": ["步骤1", "步骤2"]
              }
            ],
            "calories": 450,
            "protein": 25
          },
          { "type": "lunch", "name": "午餐", "dishes": [...], "calories": 650, "protein": 40 },
          { "type": "dinner", "name": "晚餐", "dishes": [...], "calories": 550, "protein": 30 }
        ]
      }
    ],
    "shoppingList": [
      { "name": "食材名", "amount": "500g", "reason": "用于本周 3 顿午餐" }
    ]
  },
  "insights": [
    {
      "type": "suggestion",
      "category": "nutrition",
      "title": "建议增加蔬菜摄入",
      "content": "根据你的冰箱库存，本周蔬菜种类偏少，建议增加绿叶菜补充膳食纤维。",
      "priority": 2
    }
  ]
}

只返回 JSON，不要任何其他文字。

重要：你必须只输出一个合法的 JSON 对象，不要用 markdown 代码块包裹，不要有任何前缀或后缀文字，不要有解释。直接从 { 开始，到 } 结束。`;

function extractJson(text: string): any {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try { return JSON.parse(trimmed); } catch { /* fall through */ }
  }
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch { /* fall through */ }
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)); } catch { /* fall through */ }
  }
  throw new Error(`无法解析 AI 返回的食谱数据。原始内容前500字：${text.slice(0, 500)}`);
}

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getSunday(mondayStr: string): string {
  const d = new Date(mondayStr);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

// Generate weekly plan
export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const settings = await getAiSettings(user.id);
  if (!settings) return Response.json({ error: '请先在"营养师 → AI 设置"中配置接口、模型和密钥。' }, { status: 503 });

  const body = await request.json() as {
    measurements?: Record<string, string>;
    zones?: Array<{ id: string; name: string; type: string; capacity: number; used: number }>;
    foods?: Array<{ name: string; zone: string; amount: string; days: number }>;
    goal?: string;
    constraints?: string;
  };

  const monday = getMonday(new Date());
  const sunday = getSunday(monday);

  // Build days array for the current week
  const days: Array<{ date: string; dayOfWeek: number }> = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    days.push({ date: d.toISOString().split('T')[0], dayOfWeek: i });
  }

  const userPrompt = `用户身体数据：
${JSON.stringify(body.measurements || {})}

冰箱库存：
${JSON.stringify(body.foods || [], null, 2)}

冰箱分区容量：
${JSON.stringify(body.zones || [], null, 2)}

用户目标：${body.goal || '健康减脂，提升肌肉量'}
执行条件：${body.constraints || '宿舍环境，小锅，简单易做，好吃不水煮'}

本周日期：
周一：${days[0].date}
周二：${days[1].date}
周三：${days[2].date}
周四：${days[3].date}
周五：${days[4].date}
周六：${days[5].date}
周日：${days[6].date}

请生成本周（周一到周日）的完整食谱，每天 3 餐，并返回 JSON 格式。同时生成 3-5 条 AI 洞察。`;

  try {
    const response = await fetch(settings.endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${settings.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) return Response.json({ error: data.error?.message ?? 'AI 服务暂时不可用。' }, { status: response.status });

    const content = data.choices?.[0]?.message?.content ?? '';
    const result = extractJson(content);

    if (!result.plan?.days || !Array.isArray(result.plan.days) || result.plan.days.length === 0) {
      const resultPreview = JSON.stringify(result).slice(0, 500);
      throw new Error(`AI 返回的数据格式不正确：plan.days 不存在或为空数组。原始内容前500字：${resultPreview}`);
    }

    const db = getDb();
    const now = new Date().toISOString();

    // Archive previous active plan
    await db.update(weeklyPlans)
      .set({ status: 'archived', updatedAt: now })
      .where(and(eq(weeklyPlans.userId, user.id), eq(weeklyPlans.status, 'active')));

    // Insert new weekly plan
    const planResult = await db.insert(weeklyPlans).values({
      userId: user.id,
      weekStart: monday,
      weekEnd: sunday,
      status: 'active',
      goal: result.plan.goal,
      targetCalories: result.plan.targetCalories,
      targetProtein: result.plan.targetProtein,
      rationale: result.plan.rationale,
      createdAt: now,
      updatedAt: now,
    }).returning({ id: weeklyPlans.id });

    const planId = planResult[0].id;

    // Insert daily meals
    // 使用我们自己计算的日期，不依赖 AI 返回的 date / dayOfWeek
    const allMeals: any[] = [];
    const aiDays = result.plan.days;
    for (let i = 0; i < 7; i++) {
      const day = aiDays[i];
      if (!day) {
        console.warn(`[weekly plan] 第 ${i} 天数据缺失，跳过`);
        continue;
      }
      if (!day.meals || !Array.isArray(day.meals)) {
        console.warn(`[weekly plan] 第 ${i} 天（${days[i].date}）没有 meals 数组，跳过`);
        continue;
      }
      for (const meal of day.meals) {
        // 兼容不同结构：有 dishes 数组就遍历，没有就把 meal 本身当作一道菜
        let dishes: any[] = [];
        if (meal.dishes && Array.isArray(meal.dishes) && meal.dishes.length > 0) {
          dishes = meal.dishes;
        } else {
          dishes = [meal];
        }
        for (let j = 0; j < dishes.length; j++) {
          const dish = dishes[j];
          const dishName = dish.name || dish.dishName || dish.title || '未知菜品';
          const calories = dish.calories ?? dish.cal ?? 0;
          const protein = dish.protein ?? dish.proteinG ?? 0;
          allMeals.push({
            planId,
            userId: user.id,
            date: days[i].date,
            dayOfWeek: i,
            mealType: meal.type || 'dinner',
            dishName,
            calories,
            protein,
            ingredientsJson: JSON.stringify(dish.ingredients || []),
            stepsJson: JSON.stringify(dish.steps || []),
            sortOrder: j,
            createdAt: now,
          });
        }
      }
    }
    const mealsInserted = allMeals.length;
    if (mealsInserted > 0) {
      await db.insert(dailyMeals).values(allMeals);
    }

    // Insert shopping items
    let shoppingInserted = 0;
    if (result.plan.shoppingList && Array.isArray(result.plan.shoppingList) && result.plan.shoppingList.length > 0) {
      await db.insert(shoppingItems).values(
        result.plan.shoppingList.map((item: any) => ({
          planId,
          userId: user.id,
          name: item.name,
          amount: item.amount,
          reason: item.reason,
          purchased: 0,
          createdAt: now,
        }))
      );
      shoppingInserted = result.plan.shoppingList.length;
    }

    // Insert AI insights
    let insightsInserted = 0;
    if (result.insights && Array.isArray(result.insights) && result.insights.length > 0) {
      await db.insert(aiInsights).values(
        result.insights.map((ins: any) => ({
          userId: user.id,
          type: ins.type || 'suggestion',
          category: ins.category || 'nutrition',
          title: ins.title,
          content: ins.content,
          priority: ins.priority || 0,
          relatedPlanId: planId,
          createdAt: now,
        }))
      );
      insightsInserted = result.insights.length;
    }

    return Response.json({ planId, weekStart: monday, weekEnd: sunday, mealsInserted, shoppingInserted, insightsInserted });
  } catch (e) {
    const isDev = process.env.NODE_ENV !== 'production';
    const message = e instanceof Error ? e.message : '生成失败，请稍后再试。';
    const stack = e instanceof Error ? e.stack : undefined;
    if (isDev) {
      console.error('[weekly plan] 生成失败:', message, stack);
      return Response.json({ error: message, stack }, { status: 502 });
    }
    return Response.json({ error: message }, { status: 502 });
  }
}

// Get current active weekly plan
export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const db = getDb();

  const plan = await db.select()
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.userId, user.id), eq(weeklyPlans.status, 'active')))
    .orderBy(desc(weeklyPlans.createdAt))
    .limit(1)
    .get();

  if (!plan) return Response.json({ plan: null, meals: [], shoppingList: [], insights: [] });

  const meals = await db.select()
    .from(dailyMeals)
    .where(eq(dailyMeals.planId, plan.id))
    .all();

  const shopping = await db.select()
    .from(shoppingItems)
    .where(eq(shoppingItems.planId, plan.id))
    .all();

  const insights = await db.select()
    .from(aiInsights)
    .where(and(eq(aiInsights.userId, user.id), eq(aiInsights.relatedPlanId, plan.id)))
    .orderBy(desc(aiInsights.priority), desc(aiInsights.createdAt))
    .limit(10)
    .all();

  return Response.json({ plan, meals, shoppingList: shopping, insights });
}
