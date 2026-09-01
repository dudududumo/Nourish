import { getCurrentUser } from '@/lib/auth';
import { getAiSettings } from '@/lib/ai-settings';
import { getDb } from '@/db';
import { weeklyPlans, dailyMeals, shoppingItems, aiInsights } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { todayStr, addDays, dayOfWeekOf } from '@/lib/utils';

const SYSTEM_PROMPT = `你是"轻养"的专业注册营养师，负责为用户制定科学的 7 天健康饮食计划。

【核心原则】
1. 营养健康第一：严格按身体数据算热量蛋白，每餐优质蛋白+碳水+蔬菜+健康脂肪
2. 冰箱库存第二：有就优先用，没有就采购，绝不因库存降低营养标准
3. 每天 3 餐，好吃易做，适合小厨房

【输出要求 - 非常重要】
你必须返回一个合法的 JSON 对象，格式如下：

{
  "goal": "健康减脂增肌",
  "targetCalories": 1700,
  "targetProtein": 90,
  "rationale": "一句话说明",
  "days": [
    {
      "breakfast": [{"name": "菜名", "calories": 300, "protein": 15, "ingredients": "食材1 100g, 食材2 50g", "steps": ["做法步骤1", "做法步骤2", "做法步骤3"]}],
      "lunch": [{"name": "菜名", "calories": 500, "protein": 30, "ingredients": "...", "steps": ["..."]}],
      "dinner": [{"name": "菜名", "calories": 450, "protein": 25, "ingredients": "...", "steps": ["..."]}]
    }
  ],
  "shoppingList": [{"name": "食材", "amount": "500g"}],
  "insights": [{"type": "suggestion", "title": "标题", "content": "内容", "priority": 2}]
}

规则：
- 只返回 JSON，不要任何解释、不要 markdown、不要代码块
- days 数组必须有 7 个对象，对应第1天到第7天
- 每餐是数组，1-2 道菜
- ingredients 用逗号分隔的字符串，不用数组
- 每道菜必须带 steps 数组，3-5 步，写清楚具体做法（用怎样的火候、顺序、是否焯水/煎/煮、大约几分钟），适合小厨房，简洁实用
- 优先选用中国家庭常见的成熟菜谱（如西红柿炒蛋、香煎鸡胸、清蒸鲈鱼这类广为人知的家常菜），不要编造冷门或猎奇做法，确保步骤真实、可操作，用户按步骤就能做出来
- 直接从 { 开始，到 } 结束`;

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

// 从自然语言文本中提取菜品（兜底方案，当 JSON 完全解析失败时使用）
function parseMealsFromText(text: string): any[] {
  const days: any[] = [];
  // 按"第X天"或日期分割
  const dayRegex = /(?:第\s*(\d+)\s*天|Day\s*\d+|周[一二三四五六日])[^\n]*\n([\s\S]*?)(?=(?:第\s*\d+\s*天|Day\s*\d+|周[一二三四五六日]|$))/gi;
  let match;
  while ((match = dayRegex.exec(text)) !== null) {
    const dayText = match[2];
    const day: any = { breakfast: [], lunch: [], dinner: [] };

    // 提取早餐
    const breakfastMatch = dayText.match(/(?:早餐|早饭|早)[：:]([^\n]+)/);
    if (breakfastMatch) day.breakfast.push({ name: breakfastMatch[1].trim(), calories: 0, protein: 0, ingredients: '' });

    // 提取午餐
    const lunchMatch = dayText.match(/(?:午餐|午饭|中)[：:]([^\n]+)/);
    if (lunchMatch) day.lunch.push({ name: lunchMatch[1].trim(), calories: 0, protein: 0, ingredients: '' });

    // 提取晚餐
    const dinnerMatch = dayText.match(/(?:晚餐|晚饭|晚)[：:]([^\n]+)/);
    if (dinnerMatch) day.dinner.push({ name: dinnerMatch[1].trim(), calories: 0, protein: 0, ingredients: '' });

    // 只要有一餐就保留
    if (day.breakfast.length > 0 || day.lunch.length > 0 || day.dinner.length > 0) {
      days.push(day);
    }
  }

  // 如果按天分割没找到，尝试从整体文本提取一顿的（至少当 1 天用）
  if (days.length === 0) {
    const day: any = { breakfast: [], lunch: [], dinner: [] };
    const b = text.match(/(?:早餐|早饭)[：:]([^\n]+)/);
    const l = text.match(/(?:午餐|午饭)[：:]([^\n]+)/);
    const d = text.match(/(?:晚餐|晚饭)[：:]([^\n]+)/);
    if (b) day.breakfast.push({ name: b[1].trim(), calories: 0, protein: 0, ingredients: '' });
    if (l) day.lunch.push({ name: l[1].trim(), calories: 0, protein: 0, ingredients: '' });
    if (d) day.dinner.push({ name: d[1].trim(), calories: 0, protein: 0, ingredients: '' });
    if (day.breakfast.length > 0 || day.lunch.length > 0 || day.dinner.length > 0) {
      days.push(day);
    }
  }

  return days;
}

// 归一化 AI 返回的各种结构，统一成我们期望的格式
function normalizePlan(raw: any): {
  plan: { goal: string; targetCalories: number; targetProtein: number; rationale: string; days: any[]; shoppingList: any[] };
  insights: any[];
} {
  // 顶层可能直接就是数据，也可能包了一层 plan
  const planObj = raw.plan || raw.weekPlan || raw.mealPlan || raw.data || raw;

  // 尝试找到 days 数组
  let days: any[] = [];
  if (Array.isArray(planObj.days)) days = planObj.days;
  else if (Array.isArray(planObj.meals)) days = planObj.meals;
  else if (Array.isArray(planObj.weeklyMeals)) days = planObj.weeklyMeals;
  else if (Array.isArray(planObj.schedule)) days = planObj.schedule;
  else if (Array.isArray(raw.days)) days = raw.days;

  // 归一化每一天的结构：统一转成 { breakfast: [], lunch: [], dinner: [] } 形式
  const normalizedDays = days.slice(0, 7).map((day: any) => {
    const result: any = { breakfast: [], lunch: [], dinner: [], snack: [] };

    // 形式1：直接按 mealType 分组的对象（我们推荐的格式）
    for (const type of ['breakfast', 'lunch', 'dinner', 'snack']) {
      if (day[type]) {
        const arr = Array.isArray(day[type]) ? day[type] : [day[type]];
        result[type] = arr.map((d: any) => typeof d === 'string' ? { name: d, calories: 0, protein: 0, ingredients: '' } : d);
      }
    }

    // 形式2：meals 数组 + type 字段
    if (Array.isArray(day.meals) && result.breakfast.length === 0 && result.lunch.length === 0) {
      for (const meal of day.meals) {
        const type = meal.type || 'dinner';
        let dishes: any[] = [];
        if (Array.isArray(meal.dishes)) dishes = meal.dishes;
        else if (meal.name) dishes = [meal];
        if (result[type]) result[type] = [...result[type], ...dishes];
      }
    }

    return result;
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

  // 从今天开始，连续 7 天
  const weekStartStr = todayStr();
  const weekEndStr = addDays(weekStartStr, 6);

  const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  // Build days array from today
  const days: Array<{ date: string; dayOfWeek: number; label: string }> = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStartStr, i);
    const ourDayOfWeek = dayOfWeekOf(date);
    days.push({
      date,
      dayOfWeek: ourDayOfWeek,
      label: i === 0 ? '今天' : i === 1 ? '明天' : weekdayNames[ourDayOfWeek],
    });
  }

  const userPrompt = `用户身体数据：
${JSON.stringify(body.measurements || {})}

用户目标：${body.goal || '健康减脂，提升肌肉量'}
执行条件：${body.constraints || '宿舍环境，小锅，简单易做，好吃不水煮'}

冰箱现有食材（仅供参考，优先使用但不能牺牲营养均衡）：
${JSON.stringify(body.foods || [], null, 2)}

冰箱分区容量：
${JSON.stringify(body.zones || [], null, 2)}

未来 7 天日期（从今天开始）：
第1天（${days[0].label}）：${days[0].date}
第2天（${days[1].label}）：${days[1].date}
第3天（${days[2].label}）：${days[2].date}
第4天（${days[3].label}）：${days[3].date}
第5天（${days[4].label}）：${days[4].date}
第6天（${days[5].label}）：${days[5].date}
第7天（${days[6].label}）：${days[6].date}

重要提醒：
1. 先根据身体数据和目标，计算出科学的每日热量和蛋白质目标
2. 再设计 7 天营养均衡的食谱（优质蛋白+碳水+蔬菜+健康脂肪）
3. 最后看看冰箱里有什么，能替换的替换，不能替换的就列入采购清单
4. 绝对不能因为冰箱里食材少就降低营养标准
5. days 数组必须包含 7 天，对应上面的第1天到第7天

请生成未来 7 天（从今天开始）的完整食谱，每天 3 餐，并返回 JSON 格式。同时生成 3-5 条 AI 洞察。`;

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

    // 先尝试 JSON 解析
    let rawResult: any = null;
    let parseError = '';
    try {
      rawResult = extractJson(content);
    } catch (e: any) {
      parseError = e.message;
      console.warn('[weekly plan] JSON 解析失败，尝试文本兜底解析');
    }

    let result: any = null;
    if (rawResult) {
      result = normalizePlan(rawResult);
    }

    // 如果 JSON 解析后没有 days，尝试从文本提取（兜底方案）
    if (!result || !result.plan.days || result.plan.days.length === 0) {
      console.warn('[weekly plan] 结构归一化后没有数据，使用文本兜底解析');
      const textDays = parseMealsFromText(content);
      if (textDays.length > 0) {
        result = {
          plan: {
            goal: '健康饮食计划',
            targetCalories: 1800,
            targetProtein: 80,
            rationale: 'AI 营养师根据你的身体数据和冰箱库存生成的个性化计划。',
            days: textDays,
            shoppingList: [],
          },
          insights: [{
            type: 'observation',
            title: '计划已生成',
            content: `AI 为你生成了 ${textDays.length} 天的饮食计划，可在周计划中查看详情。`,
            priority: 1,
          }],
        };
      }
    }

    // 最后校验：还是没有的话报错
    if (!result || !result.plan.days || result.plan.days.length === 0) {
      const contentPreview = content.slice(0, 800);
      throw new Error(
        `AI 返回的数据无法解析。\n` +
        `JSON 解析错误：${parseError || '无'}\n` +
        `AI 返回内容预览：${contentPreview}`
      );
    }

    const actualDays = Math.min(result.plan.days.length, 7);
    console.log(`[weekly plan] AI 返回了 ${result.plan.days.length} 天数据，使用前 ${actualDays} 天`);

    const db = getDb();
    const now = new Date().toISOString();

    // Archive previous active plan
    await db.update(weeklyPlans)
      .set({ status: 'archived', updatedAt: now })
      .where(and(eq(weeklyPlans.userId, user.id), eq(weeklyPlans.status, 'active')));

    // Insert new weekly plan
    const planResult = await db.insert(weeklyPlans).values({
      userId: user.id,
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
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
    // 有几天算几天，不强制 7 天
    // 支持两种结构：{breakfast: [], lunch: [], dinner: []} 和 {meals: [{type, dishes: []}]}
    const allMeals: any[] = [];
    const aiDays = result.plan.days;
    const mealTypes: Array<[string, string]> = [
      ['breakfast', '早餐'], ['lunch', '午餐'], ['dinner', '晚餐'], ['snack', '加餐'],
    ];
    for (let i = 0; i < actualDays; i++) {
      const day = aiDays[i];
      if (!day) {
        console.warn(`[weekly plan] 第 ${i} 天数据缺失，跳过`);
        continue;
      }

      // 收集这天所有菜，按 mealType 分组
      const dishesByType: Record<string, any[]> = {};

      // 结构1：直接按 mealType 分组（推荐格式）
      for (const [type] of mealTypes) {
        if (day[type] && Array.isArray(day[type]) && day[type].length > 0) {
          dishesByType[type] = day[type];
        }
      }

      // 结构2：meals 数组形式（兜底）
      if (Object.keys(dishesByType).length === 0 && Array.isArray(day.meals)) {
        for (const meal of day.meals) {
          const type = meal.type || 'dinner';
          if (meal.dishes && Array.isArray(meal.dishes)) {
            dishesByType[type] = (dishesByType[type] || []).concat(meal.dishes);
          } else if (meal.name) {
            dishesByType[type] = (dishesByType[type] || []).concat([meal]);
          }
        }
      }

      // 写入数据库
      let sortIdx = 0;
      for (const [type] of mealTypes) {
        const dishes = dishesByType[type];
        if (!dishes || dishes.length === 0) continue;
        for (const dish of dishes) {
          const dishName = dish.name || dish.dishName || dish.title || '未知菜品';
          const calories = dish.calories ?? dish.cal ?? 0;
          const protein = dish.protein ?? dish.proteinG ?? 0;
          // ingredients 可能是字符串（逗号分隔）或数组
          let ingredientsArr: any[] = [];
          if (typeof dish.ingredients === 'string' && dish.ingredients) {
            ingredientsArr = dish.ingredients.split(/[,，、]/).map((s: string) => ({
              name: s.trim(),
              amount: '',
              fromFridge: false,
            })).filter((x: any) => x.name);
          } else if (Array.isArray(dish.ingredients)) {
            ingredientsArr = dish.ingredients;
          }
          allMeals.push({
            planId,
            userId: user.id,
            date: days[i].date,
            dayOfWeek: days[i].dayOfWeek,
            mealType: type,
            dishName,
            calories,
            protein,
            ingredientsJson: JSON.stringify(ingredientsArr),
            stepsJson: JSON.stringify(dish.steps || []),
            sortOrder: sortIdx++,
            createdAt: now,
          });
        }
      }
    }
    const mealsInserted = allMeals.length;
    if (mealsInserted > 0) {
      // 逐条插入，绕开 drizzle D1 批量插入 autoIncrement 主键为 null 的 bug
      for (const meal of allMeals) {
        await db.insert(dailyMeals).values(meal);
      }
    }

    // Insert shopping items
    let shoppingInserted = 0;
    if (result.plan.shoppingList && Array.isArray(result.plan.shoppingList) && result.plan.shoppingList.length > 0) {
      for (const item of result.plan.shoppingList) {
        await db.insert(shoppingItems).values({
          planId,
          userId: user.id,
          name: item.name,
          amount: item.amount,
          reason: item.reason,
          purchased: 0,
          createdAt: now,
        });
      }
      shoppingInserted = result.plan.shoppingList.length;
    }

    // Insert AI insights
    let insightsInserted = 0;
    if (result.insights && Array.isArray(result.insights) && result.insights.length > 0) {
      for (const ins of result.insights) {
        await db.insert(aiInsights).values({
          userId: user.id,
          type: ins.type || 'suggestion',
          category: ins.category || 'nutrition',
          title: ins.title,
          content: ins.content,
          priority: ins.priority || 0,
          relatedPlanId: planId,
          createdAt: now,
        });
      }
      insightsInserted = result.insights.length;
    }

    return Response.json({ planId, weekStart: weekStartStr, weekEnd: weekEndStr, mealsInserted, shoppingInserted, insightsInserted });
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

  const meals = (await db.select()
    .from(dailyMeals)
    .where(eq(dailyMeals.planId, plan.id))
    .all()).map((m: any) => ({
      ...m,
      name: m.dishName,
      ingredients: JSON.parse(m.ingredientsJson || '[]'),
      steps: JSON.parse(m.stepsJson || '[]'),
    }));

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
