import { getCurrentUser } from '@/lib/auth';
import { getAiSettings } from '@/lib/ai-settings';
import { getDb } from '@/db';
import { weeklyPlans, dailyMeals } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { todayStr, dayOfWeekOf } from '@/lib/utils';

const ADJUST_PROMPT = `你是"轻养"的 AI 营养师"小养"。用户刚向你提出计划调整需求，请你根据他的指令，为【今天】重新制定一份科学的三餐安排。

原则：
1. 营养健康第一：严格按身体数据控制热量与蛋白质。
2. 充分响应用户的调整指令（如改目标、忌口、替换某餐、减少热量等）。
3. 冰箱现有食材优先使用，但缺的该买就买。
4. 每餐 1-2 道菜，好吃易做。
5. 优先选用中国家庭常见的成熟家常菜谱（如西红柿炒蛋、香煎鸡胸、清蒸鲈鱼），不要编造冷门或猎奇做法，确保步骤真实可操作。

只返回一个 JSON（不要 markdown、不要额外文字，直接从 { 开始）：
{
  "calories": 1700,
  "protein": 90,
  "reason": "一句话说明这次主要改了什么（例如：按用户要求把晚餐换成清淡高蛋白，总热量降低150kcal）",
  "meals": {
    "breakfast": [{"name":"菜名","calories":330,"protein":18,"ingredients":"食材1 50g, 食材2 1个","steps":["做法1","做法2","做法3"]}],
    "lunch": [{"name":"菜名","calories":540,"protein":32,"ingredients":"...","steps":["..."]}],
    "dinner": [{"name":"菜名","calories":460,"protein":26,"ingredients":"...","steps":["..."]}]
  }
}
每道菜必须带 steps 数组(3-5步做法)。`;

function extractAdjustJson(text: string): any {
  const t = text.trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch { /* ignore */ }
  }
  throw new Error('AI 返回的调整食谱无法解析');
}

type AdjustMeal = {
  name?: string;
  dishName?: string;
  calories?: number;
  protein?: number;
  ingredients?: string | any[];
  steps?: string[];
};
type AdjustPlan = {
  calories?: number;
  protein?: number;
  reason?: string;
  meals?: Record<string, AdjustMeal[]>;
};

function isValidMeals(meals?: Record<string, AdjustMeal[]>): boolean {
  return !!meals && Array.isArray(meals.breakfast) && Array.isArray(meals.lunch) && Array.isArray(meals.dinner);
}

type AiSettings = { endpoint: string; apiKey: string; model: string };

async function callAdjustAi(settings: AiSettings, userPrompt: string): Promise<string> {
  const response = await fetch(settings.endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${settings.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: ADJUST_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 3000,
    }),
  });
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? 'AI 服务暂时不可用。');
  return data.choices?.[0]?.message?.content ?? '';
}

function buildContext(body: { instruction?: string; context?: { measurements?: any; foods?: any; currentPlan?: any } }): string {
  const parts: string[] = [];
  if (body.context?.measurements) {
    parts.push(`用户身体数据：\n${JSON.stringify(body.context.measurements, null, 2)}`);
  }
  if (body.context?.foods) {
    parts.push(`冰箱现有食材：\n${JSON.stringify(body.context.foods, null, 2)}`);
  }
  if (body.context?.currentPlan) {
    parts.push(`当前周计划目标：${JSON.stringify(body.context.currentPlan)}`);
  }
  parts.push(`用户的调整指令：\n${body.instruction}`);
  return parts.join('\n\n');
}

function parseAdjustPlan(content: string): AdjustPlan {
  const result = extractAdjustJson(content);
  if (!isValidMeals(result.meals)) {
    throw new Error('AI 返回的调整数据缺少完整三餐。');
  }
  return result as AdjustPlan;
}

async function writeDailyMeals(
  db: ReturnType<typeof getDb>,
  userId: number,
  planId: number,
  plan: AdjustPlan,
): Promise<string> {
  const today = todayStr();
  const now = new Date().toISOString();
  const dayOfWeek = dayOfWeekOf(today);

  await db.delete(dailyMeals)
    .where(and(eq(dailyMeals.planId, planId), eq(dailyMeals.date, today)));

  const mealTypes: Array<[string, string]> = [['breakfast', '早餐'], ['lunch', '午餐'], ['dinner', '晚餐']];
  let sortIdx = 0;
  for (const [type] of mealTypes) {
    const dishes = plan.meals?.[type] || [];
    for (const dish of dishes) {
      let ingredientsArr: any[] = [];
      if (typeof dish.ingredients === 'string' && dish.ingredients) {
        ingredientsArr = dish.ingredients.split(/[,，、]/).map((s: string) => ({
          name: s.trim(),
          amount: '',
          fromFridge: false,
        })).filter((x) => x.name);
      } else if (Array.isArray(dish.ingredients)) {
        ingredientsArr = dish.ingredients;
      }
      await db.insert(dailyMeals).values({
        planId,
        userId,
        date: today,
        dayOfWeek,
        mealType: type,
        dishName: dish.name || dish.dishName || '未知菜品',
        calories: dish.calories ?? 0,
        protein: dish.protein ?? 0,
        ingredientsJson: JSON.stringify(ingredientsArr),
        stepsJson: JSON.stringify(dish.steps || []),
        sortOrder: sortIdx++,
        createdAt: now,
      });
    }
  }
  return today;
}

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const settings = await getAiSettings(user.id);
  if (!settings) return Response.json({ error: '请先在"营养师 → AI 设置"中配置接口、模型和密钥。' }, { status: 503 });

  const body = await request.json() as {
    instruction?: string;
    goal?: string;
    mode?: 'preview' | 'apply';
    plan?: AdjustPlan;
    context?: { measurements?: any; foods?: any; currentPlan?: any };
  };

  const db = getDb();

  const plan = await db.select()
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.userId, user.id), eq(weeklyPlans.status, 'active')))
    .orderBy(desc(weeklyPlans.createdAt))
    .limit(1)
    .get();

  if (!plan) {
    return Response.json({ error: '还没有可调整的计划，请先在首页生成周计划。' }, { status: 400 });
  }

  try {
    // 预览：只生成方案，不落库
    if (body.mode === 'preview') {
      if (!body.instruction?.trim()) return Response.json({ error: '缺少调整指令。' }, { status: 400 });
      const content = await callAdjustAi(settings, buildContext(body));
      const result = parseAdjustPlan(content);
      return Response.json({
        ok: true,
        mode: 'preview',
        date: todayStr(),
        reason: result.reason ?? '',
        calories: result.calories ?? 0,
        protein: result.protein ?? 0,
        meals: result.meals,
      });
    }

    // 应用：写入前端传来的预览方案
    if (body.mode === 'apply') {
      if (!body.plan || !isValidMeals(body.plan.meals)) {
        return Response.json({ error: '缺少要应用的方案数据。' }, { status: 400 });
      }
      const today = await writeDailyMeals(db, user.id, plan.id, body.plan);
      if (body.goal) {
        await db.update(weeklyPlans)
          .set({ goal: body.goal, updatedAt: new Date().toISOString() })
          .where(eq(weeklyPlans.id, plan.id));
      }
      return Response.json({ ok: true, date: today, calories: body.plan.calories ?? 0, protein: body.plan.protein ?? 0 });
    }

    // 默认（聊天流程）：生成并直接落库
    if (!body.instruction?.trim()) return Response.json({ error: '缺少调整指令。' }, { status: 400 });
    const content = await callAdjustAi(settings, buildContext(body));
    const result = parseAdjustPlan(content);
    const today = await writeDailyMeals(db, user.id, plan.id, result);
    if (body.goal) {
      await db.update(weeklyPlans)
        .set({ goal: body.goal, updatedAt: new Date().toISOString() })
        .where(eq(weeklyPlans.id, plan.id));
    }
    return Response.json({ ok: true, date: today, calories: result.calories ?? 0, protein: result.protein ?? 0 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '调整失败，请稍后再试。';
    console.error('[plan adjust]', msg);
    return Response.json({ error: msg }, { status: 502 });
  }
}