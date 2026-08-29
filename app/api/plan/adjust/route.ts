import { getCurrentUser } from '@/lib/auth';
import { getAiSettings } from '@/lib/ai-settings';
import { getDb } from '@/db';
import { weeklyPlans, dailyMeals } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

const ADJUST_PROMPT = `你是"轻养"的 AI 营养师"小养"。用户刚向你提出计划调整需求，请你根据他的指令，为【今天】重新制定一份科学的三餐安排。

原则：
1. 营养健康第一：严格按身体数据控制热量与蛋白质。
2. 充分响应用户的调整指令（如改目标、忌口、替换某餐、减少热量等）。
3. 冰箱现有食材优先使用，但缺的该买就买。
4. 每餐 1-2 道菜，好吃易做。

只返回一个 JSON（不要 markdown、不要额外文字，直接从 { 开始）：
{
  "calories": 1700,
  "protein": 90,
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

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const settings = await getAiSettings(user.id);
  if (!settings) return Response.json({ error: '请先在"营养师 → AI 设置"中配置接口、模型和密钥。' }, { status: 503 });

  const body = await request.json() as {
    instruction: string;
    goal?: string;
    context?: { measurements?: any; foods?: any; currentPlan?: any };
  };

  if (!body.instruction?.trim()) {
    return Response.json({ error: '缺少调整指令。' }, { status: 400 });
  }

  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  // 找到当前 active 计划
  const plan = await db.select()
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.userId, user.id), eq(weeklyPlans.status, 'active')))
    .orderBy(desc(weeklyPlans.createdAt))
    .limit(1)
    .get();

  if (!plan) {
    return Response.json({ error: '还没有可调整的计划，请先在首页生成周计划。' }, { status: 400 });
  }

  const contextParts: string[] = [];
  if (body.context?.measurements) {
    contextParts.push(`用户身体数据：\n${JSON.stringify(body.context.measurements, null, 2)}`);
  }
  if (body.context?.foods) {
    contextParts.push(`冰箱现有食材：\n${JSON.stringify(body.context.foods, null, 2)}`);
  }
  if (body.context?.currentPlan) {
    contextParts.push(`当前周计划目标：${JSON.stringify(body.context.currentPlan)}`);
  }
  contextParts.push(`用户的调整指令：\n${body.instruction}`);

  const userPrompt = contextParts.join('\n\n');

  try {
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
    if (!response.ok) return Response.json({ error: data.error?.message ?? 'AI 服务暂时不可用。' }, { status: response.status });

    const content = data.choices?.[0]?.message?.content ?? '';
    const result = extractAdjustJson(content);
    if (!result.meals || !Array.isArray(result.meals.breakfast) || !Array.isArray(result.meals.lunch) || !Array.isArray(result.meals.dinner)) {
      throw new Error('AI 返回的调整数据缺少完整三餐。');
    }

    const jsDay = new Date().getDay();
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

    // 删除今天旧的三餐，替换为新的
    await db.delete(dailyMeals)
      .where(and(eq(dailyMeals.planId, plan.id), eq(dailyMeals.date, today)));

    // 插入今天新的三餐
    const mealTypes: Array<[string, string]> = [['breakfast', '早餐'], ['lunch', '午餐'], ['dinner', '晚餐']];
    let sortIdx = 0;
    for (const [type] of mealTypes) {
      const dishes = result.meals[type] || [];
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
          planId: plan.id,
          userId: user.id,
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

    // 更新计划目标（如有）
    if (body.goal) {
      await db.update(weeklyPlans)
        .set({ goal: body.goal, updatedAt: now })
        .where(eq(weeklyPlans.id, plan.id));
    }

    return Response.json({ ok: true, date: today, calories: result.calories, protein: result.protein });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '调整失败，请稍后再试。';
    console.error('[plan adjust]', msg);
    return Response.json({ error: msg }, { status: 502 });
  }
}