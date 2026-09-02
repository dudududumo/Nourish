import { getCurrentUser } from '@/lib/auth';
import { getAiSettings } from '@/lib/ai-settings';
import { getDb } from '@/db';
import { weeklyPlans, dailyMeals } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { todayStr, addDays, dayOfWeekOf } from '@/lib/utils';

const SYSTEM_PROMPT = `你是"轻养"的 AI 营养与饮食规划助手，负责生成可供用户确认的饮食建议。你不是医生或注册营养师。

【输出要求 - 非常重要】
你必须返回一个合法的 JSON 对象，格式如下（days 数组长度必须等于要求的天数）：

{
  "days": [
    {"breakfast": [{"name":"菜名","calories":300,"protein":15,"ingredients":"食材1 100g, 食材2 50g","steps":["做法1","做法2","做法3"]}],
     "lunch": [{"name":"菜名","calories":500,"protein":30,"ingredients":"...","steps":["..."]}],
     "dinner": [{"name":"菜名","calories":450,"protein":25,"ingredients":"...","steps":["..."]}]}
  ]
}

规则：
- 只返回 JSON，不要任何解释、不要 markdown、不要代码块
- days 数组必须有且仅有要求的那么多天，顺序对齐下面的日期列表
- 每餐 1-2 道菜，优质蛋白+碳水+蔬菜
- ingredients 用逗号分隔的字符串，不用数组
- 每道菜带 steps 数组（3-5 步，火候/顺序/时长）
- 优先选用中国家庭常见成熟菜谱，确保步骤真实可操作
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
  throw new Error(`无法解析 AI 返回的数据：${text.slice(0, 500)}`);
}

const MEAL_TYPES: Array<[string, string]> = [
  ['breakfast', '早餐'], ['lunch', '午餐'], ['dinner', '晚餐'], ['snack', '加餐'],
];

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const settings = await getAiSettings(user.id);
  if (!settings) return Response.json({ error: '请先在"营养师 → AI 设置"中配置接口、模型和密钥。' }, { status: 503 });

  const db = getDb();
  const plan = await db.select()
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.userId, user.id), eq(weeklyPlans.status, 'active')))
    .orderBy(desc(weeklyPlans.createdAt))
    .limit(1)
    .get();

  if (!plan) return Response.json({ error: '还没有生成本周计划。' }, { status: 404 });

  // 续补范围：今天 ~ 第 7 天（today+6），与周计划展示窗口对齐
  const today = todayStr();
  const rollEndStr = addDays(today, 6);

  const existingRows = await db.select({ date: dailyMeals.date })
    .from(dailyMeals)
    .where(eq(dailyMeals.planId, plan.id))
    .all();
  const existingDates = new Set(existingRows.map((r) => r.date));

  const missing: Array<{ date: string; dayOfWeek: number }> = [];
  for (let offset = 0; offset <= 6; offset++) {
    const dateStr = addDays(today, offset);
    if (existingDates.has(dateStr)) continue;
    missing.push({ date: dateStr, dayOfWeek: dayOfWeekOf(dateStr) });
  }

  if (missing.length === 0) {
    return Response.json({ rolled: false, daysAdded: 0, weekEnd: plan.weekEnd });
  }

  const userPrompt = `请为以下 ${missing.length} 天续补健康饮食计划，每天 3 餐（早餐/午餐/晚餐）：

${missing.map((m, i) => `第${i + 1}天：${m.date}`).join('\n')}

要求：
1. 每天营养均衡，优质蛋白+碳水+蔬菜，好吃易做
2. days 数组必须严格按上面的顺序返回 ${missing.length} 个对象
3. 只返回 JSON`;

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
    const raw = extractJson(content);
    const rawDays = raw?.days;
    if (!Array.isArray(rawDays) || rawDays.length === 0) {
      throw new Error('AI 未返回有效的 days 数据');
    }

    const now = new Date().toISOString();
    const allMeals: any[] = [];

    for (let i = 0; i < missing.length; i++) {
      const day = rawDays[i];
      if (!day) break;

      for (const [type] of MEAL_TYPES) {
        const dishes = day[type];
        if (!dishes || !Array.isArray(dishes) || dishes.length === 0) continue;
        let sortIdx = 0;
        for (const dish of dishes) {
          const dishName = dish.name || dish.dishName || dish.title || '未知菜品';
          let ingredientsArr: any[] = [];
          if (typeof dish.ingredients === 'string' && dish.ingredients) {
            ingredientsArr = dish.ingredients.split(/[,，、]/).map((s: string) => ({
              name: s.trim(), amount: '', fromFridge: false,
            })).filter((x: any) => x.name);
          } else if (Array.isArray(dish.ingredients)) {
            ingredientsArr = dish.ingredients;
          }
          allMeals.push({
            planId: plan.id,
            userId: user.id,
            date: missing[i].date,
            dayOfWeek: missing[i].dayOfWeek,
            mealType: type,
            dishName,
            calories: dish.calories ?? dish.cal ?? 0,
            protein: dish.protein ?? dish.proteinG ?? 0,
            ingredientsJson: JSON.stringify(ingredientsArr),
            stepsJson: JSON.stringify(dish.steps || []),
            sortOrder: sortIdx++,
            createdAt: now,
          });
        }
      }
    }

    let added = 0;
    if (allMeals.length > 0) {
      for (const meal of allMeals) {
        await db.insert(dailyMeals).values(meal);
      }
      added = allMeals.length;
    }

    await db.update(weeklyPlans)
      .set({ weekEnd: rollEndStr, updatedAt: now })
      .where(eq(weeklyPlans.id, plan.id));

    return Response.json({ rolled: true, daysAdded: missing.length, mealsAdded: added, weekEnd: rollEndStr });
  } catch (e) {
    const isDev = process.env.NODE_ENV !== 'production';
    const message = e instanceof Error ? e.message : '续期失败，请稍后再试。';
    if (isDev) {
      console.error('[plan roll] 续期失败:', message, e instanceof Error ? e.stack : undefined);
      return Response.json({ error: message }, { status: 502 });
    }
    return Response.json({ error: message }, { status: 502 });
  }
}
