import { getCurrentUser } from '@/lib/auth';
import { getAiSettings } from '@/lib/ai-settings';
import { getDb } from '@/db';
import { weeklyPlans, dailyMeals, shoppingItems, aiInsights } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

const SYSTEM_PROMPT = `你是"轻养"的专业注册营养师，负责为用户制定科学的 7 天健康饮食计划。

【第一原则：营养健康优先】
- 严格按照用户的身体数据和目标，计算每日所需热量和蛋白质
- 每餐保证营养均衡：优质蛋白 + 复合碳水 + 膳食纤维 + 健康脂肪
- 每天蔬菜不少于 500g，蛋白质摄入量按体重 1.6-2.0g/kg 计算
- 油脂控制，烹饪方式以蒸、煮、煎（少油）为主
- 菜品多样化，每天不重样，保证微量元素摄入全面
- 绝对不能因为冰箱里有什么就只吃什么，营养均衡永远是第一位

【第二原则：冰箱库存辅助】
- 在满足营养均衡的前提下，优先使用冰箱中已有的食材
- 临期（3 天内）的食材优先安排消耗，减少浪费
- 冰箱里没有但食谱需要的食材，全部列入 shoppingList 采购清单
- fromFridge 字段：冰箱里有的标 true，需要买的标 false

【其他要求】
- 每天 3 餐（早/午/晚），每餐 1-2 道菜，好吃易做，适合小厨房
- 同时生成 3-5 条 AI 洞察（观察/建议/警示）

返回格式：只返回一个 JSON 对象，不要 markdown，不要多余文字，直接从 { 开始到 } 结束。

JSON 结构示例：
{
  "plan": {
    "goal": "健康减脂并提升肌肉量",
    "targetCalories": 1800,
    "targetProtein": 95,
    "rationale": "简短说明为什么这样安排热量和蛋白分配",
    "days": [
      {
        "meals": [
          {
            "type": "breakfast",
            "dishes": [
              {
                "name": "菜名",
                "ingredients": [{ "name": "食材", "amount": "100g", "fromFridge": true }],
                "calories": 300,
                "protein": 15,
                "steps": ["步骤1", "步骤2"]
              }
            ]
          },
          { "type": "lunch", "dishes": [...] },
          { "type": "dinner", "dishes": [...] }
        ]
      }
    ],
    "shoppingList": [
      { "name": "食材名", "amount": "500g", "reason": "用于本周 3 顿午餐" }
    ]
  },
  "insights": [
    { "type": "suggestion", "category": "nutrition", "title": "标题", "content": "具体建议", "priority": 2 }
  ]
}

注意：
- type 只能是 breakfast / lunch / dinner / snack
- days 数组必须有 7 个元素，对应周一到周日
- 只返回 JSON，不要任何其他内容`;

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

// 归一化 AI 返回的各种结构，统一成我们期望的格式
function normalizePlan(raw: any): {
  plan: { goal: string; targetCalories: number; targetProtein: number; rationale: string; days: any[]; shoppingList: any[] };
  insights: any[];
} {
  // 尝试找到 plan 对象（可能叫 plan / weekPlan / mealPlan / data）
  const planObj = raw.plan || raw.weekPlan || raw.mealPlan || raw.data || raw;
  // 尝试找到 days 数组（可能叫 days / meals / weeklyMeals / schedule）
  let days: any[] = [];
  if (Array.isArray(planObj.days)) days = planObj.days;
  else if (Array.isArray(planObj.meals)) days = planObj.meals;
  else if (Array.isArray(planObj.weeklyMeals)) days = planObj.weeklyMeals;
  else if (Array.isArray(planObj.schedule)) days = planObj.schedule;
  else if (Array.isArray(raw.days)) days = raw.days;
  // 如果还没有，尝试找是否是按 mealType 分组的对象
  if (days.length === 0 && raw.breakfast) {
    days = [{ meals: [
      { type: 'breakfast', dishes: Array.isArray(raw.breakfast) ? raw.breakfast : [raw.breakfast] },
      { type: 'lunch', dishes: Array.isArray(raw.lunch) ? raw.lunch : [raw.lunch] },
      { type: 'dinner', dishes: Array.isArray(raw.dinner) ? raw.dinner : [raw.dinner] },
    ] }];
  }

  // 归一化每一天的结构
  const normalizedDays = days.slice(0, 7).map((day: any) => {
    // 尝试找到当天的 meals
    let meals: any[] = [];
    if (Array.isArray(day.meals)) meals = day.meals;
    else if (Array.isArray(day.dishes)) meals = [{ type: 'lunch', dishes: day.dishes }];
    else {
      // 按 mealType 分组的对象形式
      const types: Array<[string, string]> = [
        ['breakfast', '早餐'], ['lunch', '午餐'], ['dinner', '晚餐'], ['snack', '加餐'],
      ];
      for (const [type, name] of types) {
        if (day[type]) {
          const arr = Array.isArray(day[type]) ? day[type] : [day[type]];
          meals.push({ type, name, dishes: arr });
        }
      }
    }
    return { ...day, meals };
  });

  // 归一化购物清单
  let shoppingList: any[] = [];
  if (Array.isArray(planObj.shoppingList)) shoppingList = planObj.shoppingList;
  else if (Array.isArray(planObj.shopping_items)) shoppingList = planObj.shopping_items;
  else if (Array.isArray(planObj.groceryList)) shoppingList = planObj.groceryList;
  else if (Array.isArray(raw.shoppingList)) shoppingList = raw.shoppingList;

  // 归一化洞察
  let insights: any[] = [];
  if (Array.isArray(raw.insights)) insights = raw.insights;
  else if (Array.isArray(raw.suggestions)) insights = raw.suggestions.map((s: any) => ({ ...s, type: 'suggestion' }));
  else if (Array.isArray(planObj.insights)) insights = planObj.insights;

  return {
    plan: {
      goal: planObj.goal || planObj.objective || '健康饮食',
      targetCalories: planObj.targetCalories ?? planObj.dailyCalories ?? planObj.calories ?? 1800,
      targetProtein: planObj.targetProtein ?? planObj.dailyProtein ?? planObj.protein ?? 80,
      rationale: planObj.rationale || planObj.explanation || planObj.reason || 'AI 营养师根据你的身体数据和冰箱库存生成的个性化计划。',
      days: normalizedDays,
      shoppingList,
    },
    insights,
  };
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

用户目标：${body.goal || '健康减脂，提升肌肉量'}
执行条件：${body.constraints || '宿舍环境，小锅，简单易做，好吃不水煮'}

冰箱现有食材（仅供参考，优先使用但不能牺牲营养均衡）：
${JSON.stringify(body.foods || [], null, 2)}

冰箱分区容量：
${JSON.stringify(body.zones || [], null, 2)}

本周日期：
周一：${days[0].date}
周二：${days[1].date}
周三：${days[2].date}
周四：${days[3].date}
周五：${days[4].date}
周六：${days[5].date}
周日：${days[6].date}

重要提醒：
1. 先根据身体数据和目标，计算出科学的每日热量和蛋白质目标
2. 再设计 7 天营养均衡的食谱（优质蛋白+碳水+蔬菜+健康脂肪）
3. 最后看看冰箱里有什么，能替换的替换，不能替换的就列入采购清单
4. 绝对不能因为冰箱里食材少就降低营养标准

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
        max_tokens: 12000,
      }),
    });

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) return Response.json({ error: data.error?.message ?? 'AI 服务暂时不可用。' }, { status: response.status });

    const content = data.choices?.[0]?.message?.content ?? '';
    const rawResult = extractJson(content);
    const result = normalizePlan(rawResult);

    // 如果归一化后还是没有 days，返回详细错误信息方便排查
    if (!result.plan.days || result.plan.days.length === 0) {
      const rawPreview = JSON.stringify(rawResult).slice(0, 800);
      const normalizedPreview = JSON.stringify(result).slice(0, 500);
      throw new Error(
        `AI 返回的数据格式不正确：无法提取 7 天食谱。\n` +
        `AI 原始结构：${rawPreview}\n` +
        `归一化后：${normalizedPreview}`
      );
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
