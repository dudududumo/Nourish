import { getCurrentUser } from '@/lib/auth';
import { getAiSettings } from '@/lib/ai-settings';
import { getDb } from '@/db';
import { weeklyPlans, dailyMeals, shoppingItems, aiInsights } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// 非常简单的 system prompt：让 AI 用自然语言输出 7 天食谱
// 格式越简单，AI 越不容易出错
const SYSTEM_PROMPT = `你是一位专业营养师。请根据用户的身体数据、目标和冰箱库存，为他/她制定未来 7 天的健康饮食计划。

要求：
1. 营养健康第一：每餐有优质蛋白、蔬菜、适量碳水
2. 冰箱里有的食材优先用，没有的就需要买
3. 菜品好吃易做，适合小厨房
4. 每天 3 餐，菜不重样

请严格按照下面的格式输出，不要加其他内容：

【本周目标】健康减脂增肌
【每日热量】约1700千卡，蛋白质约90克
【方案说明】一句话说明为什么这样安排

【第1天】
早餐：菜名（主要食材）
午餐：菜名（主要食材）
晚餐：菜名（主要食材）

【第2天】
早餐：菜名（主要食材）
午餐：菜名（主要食材）
晚餐：菜名（主要食材）

...以此类推到第7天...

【采购清单】
食材1 数量
食材2 数量

【营养师建议】
1. 建议内容
2. 建议内容
3. 建议内容

注意：
- 严格按照上面的格式，用【】标记每个部分
- 每天必须有早餐、午餐、晚餐
- 菜名后面用括号写主要食材
- 不要用markdown，不要用代码块
- 直接输出文字即可`;

// 从 AI 返回的文本中解析出结构化的周计划
function parseWeeklyPlan(text: string): {
  goal: string;
  targetCalories: number;
  targetProtein: number;
  rationale: string;
  days: Array<{ breakfast: string; lunch: string; dinner: string }>;
  shoppingList: Array<{ name: string; amount: string }>;
  suggestions: string[];
} {
  const result = {
    goal: '健康饮食',
    targetCalories: 1800,
    targetProtein: 80,
    rationale: 'AI 营养师为你制定的个性化饮食计划。',
    days: [] as Array<{ breakfast: string; lunch: string; dinner: string }>,
    shoppingList: [] as Array<{ name: string; amount: string }>,
    suggestions: [] as string[],
  };

  // 提取目标
  const goalMatch = text.match(/【本周目标】[：:]?\s*(.+)/);
  if (goalMatch) result.goal = goalMatch[1].trim();

  // 提取热量和蛋白
  const calMatch = text.match(/【每日热量】[：:]?\s*约?(\d+)\s*千卡/);
  if (calMatch) result.targetCalories = parseInt(calMatch[1]);
  const proteinMatch = text.match(/蛋白质约?(\d+)\s*克/);
  if (proteinMatch) result.targetProtein = parseInt(proteinMatch[1]);

  // 提取方案说明
  const rationaleMatch = text.match(/【方案说明】[：:]?\s*(.+?)(?=\n【|$)/s);
  if (rationaleMatch) result.rationale = rationaleMatch[1].trim();

  // 提取每天的三餐（支持"第X天"格式）
  const dayRegex = /【第\s*(\d+)\s*天】\s*\n([\s\S]*?)(?=\n【第\s*\d+\s*天】|\n【采购清单】|\n【营养师建议】|$)/g;
  let dayMatch;
  while ((dayMatch = dayRegex.exec(text)) !== null) {
    const dayText = dayMatch[2];
    const day = { breakfast: '', lunch: '', dinner: '' };

    const b = dayText.match(/早餐[：:]\s*(.+)/);
    const l = dayText.match(/午餐[：:]\s*(.+)/);
    const d = dayText.match(/晚餐[：:]\s*(.+)/);

    if (b) day.breakfast = b[1].trim();
    if (l) day.lunch = l[1].trim();
    if (d) day.dinner = d[1].trim();

    // 至少要有两餐才算一天
    if ((b ? 1 : 0) + (l ? 1 : 0) + (d ? 1 : 0) >= 2) {
      result.days.push(day);
    }
  }

  // 如果第X天格式没匹配到，试试用"周一/周二..."格式
  if (result.days.length === 0) {
    const weekdayRegex = /【?(周[一二三四五六日天])】?\s*\n([\s\S]*?)(?=\n【?周[一二三四五六日天]】?|\n【采购清单】|\n【营养师建议】|$)/g;
    let wMatch;
    while ((wMatch = weekdayRegex.exec(text)) !== null) {
      const dayText = wMatch[2];
      const day = { breakfast: '', lunch: '', dinner: '' };

      const b = dayText.match(/早餐[：:]\s*(.+)/);
      const l = dayText.match(/午餐[：:]\s*(.+)/);
      const d = dayText.match(/晚餐[：:]\s*(.+)/);

      if (b) day.breakfast = b[1].trim();
      if (l) day.lunch = l[1].trim();
      if (d) day.dinner = d[1].trim();

      if ((b ? 1 : 0) + (l ? 1 : 0) + (d ? 1 : 0) >= 2) {
        result.days.push(day);
      }
    }
  }

  // 如果还没有，按数字编号的天来提取（1. xxx / 2. xxx）
  if (result.days.length === 0) {
    const numberedDayRegex = /(?:^|\n)(\d+)\.\s*[^\n]*\n([\s\S]*?)(?=(?:^|\n)\d+\.\s*|\n【|$)/g;
    let nMatch;
    while ((nMatch = numberedDayRegex.exec(text)) !== null) {
      const dayText = nMatch[2];
      const day = { breakfast: '', lunch: '', dinner: '' };

      const b = dayText.match(/早餐[：:]\s*(.+)/);
      const l = dayText.match(/午餐[：:]\s*(.+)/);
      const d = dayText.match(/晚餐[：:]\s*(.+)/);

      if (b) day.breakfast = b[1].trim();
      if (l) day.lunch = l[1].trim();
      if (d) day.dinner = d[1].trim();

      if ((b ? 1 : 0) + (l ? 1 : 0) + (d ? 1 : 0) >= 2) {
        result.days.push(day);
      }
    }
  }

  // 提取采购清单
  const shoppingSection = text.match(/【采购清单】\s*\n([\s\S]*?)(?=\n【营养师建议】|$)/);
  if (shoppingSection) {
    const lines = shoppingSection[1].split('\n').filter((l) => l.trim());
    for (const line of lines) {
      const trimmed = line.trim().replace(/^[-•*\d.]+\s*/, '');
      if (!trimmed) continue;
      // 尝试分离名称和数量
      const parts = trimmed.split(/\s+(.+)/);
      if (parts.length >= 2) {
        result.shoppingList.push({ name: parts[0], amount: parts[1] });
      } else {
        result.shoppingList.push({ name: trimmed, amount: '适量' });
      }
    }
  }

  // 提取营养师建议
  const suggestionSection = text.match(/【营养师建议】\s*\n([\s\S]*?)$/);
  if (suggestionSection) {
    const lines = suggestionSection[1].split('\n').filter((l) => l.trim());
    for (const line of lines) {
      const trimmed = line.trim().replace(/^[-•*\d.]+\s*/, '');
      if (trimmed && trimmed.length > 5) {
        result.suggestions.push(trimmed);
      }
    }
  }

  return result;
}

// 从菜名字符串中提取食材和估算热量
function parseDish(dishStr: string): { name: string; ingredients: Array<{ name: string; amount: string }>; calories: number; protein: number } {
  let name = dishStr;
  let ingredients: Array<{ name: string; amount: string }> = [];

  // 提取括号里的食材
  const parenMatch = dishStr.match(/[（(]([^）)]+)[）)]/);
  if (parenMatch) {
    name = dishStr.replace(/[（(][^）)]+[）)]/, '').trim();
    const ingStr = parenMatch[1];
    const parts = ingStr.split(/[,，、]/);
    ingredients = parts.map((p) => {
      const trimmed = p.trim();
      // 尝试提取数量
      const amountMatch = trimmed.match(/(\d+\s*g|\d+\s*克|\d+\s*ml|\d+\s*个|\d+\s*只|适量|少许|若干)/);
      if (amountMatch) {
        return {
          name: trimmed.replace(amountMatch[0], '').trim() || trimmed,
          amount: amountMatch[0],
        };
      }
      return { name: trimmed, amount: '适量' };
    }).filter((i) => i.name);
  }

  // 粗略估算热量（按菜名长度和关键词估算）
  let calories = 300;
  let protein = 15;
  const lower = dishStr.toLowerCase();
  if (lower.includes('鸡腿') || lower.includes('鸡胸') || lower.includes('牛肉') || lower.includes('虾')) {
    calories = 400; protein = 30;
  } else if (lower.includes('蛋') || lower.includes('豆腐')) {
    calories = 250; protein = 18;
  } else if (lower.includes('沙拉') || lower.includes('蔬菜')) {
    calories = 150; protein = 5;
  }
  if (lower.includes('饭') || lower.includes('面') || lower.includes('米')) {
    calories += 150;
  }

  return { name, ingredients, calories, protein };
}

// Generate weekly plan
export async function POST(request: Request) {
  try {
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

    // 从今天开始的 7 天
    const weekStart = new Date();
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const days: Array<{ date: string; dayOfWeek: number; label: string }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const jsDay = d.getDay();
      const ourDayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
      days.push({
        date: d.toISOString().split('T')[0],
        dayOfWeek: ourDayOfWeek,
        label: i === 0 ? '今天' : i === 1 ? '明天' : weekdayNames[jsDay],
      });
    }

    const userPrompt = `用户身体数据：
${JSON.stringify(body.measurements || {})}

用户目标：${body.goal || '健康减脂，提升肌肉量'}
执行条件：${body.constraints || '宿舍环境，小锅，简单易做，好吃不水煮'}

冰箱现有食材（优先使用，没有的就列入采购清单）：
${JSON.stringify(body.foods || [], null, 2)}

未来 7 天：
第1天（${days[0].label}，${days[0].date}）
第2天（${days[1].label}，${days[1].date}）
第3天（${days[2].label}，${days[2].date}）
第4天（${days[3].label}，${days[3].date}）
第5天（${days[4].label}，${days[4].date}）
第6天（${days[5].label}，${days[5].date}）
第7天（${days[6].label}，${days[6].date}）

请按照规定的格式输出这 7 天的饮食计划。`;

    // 调用 AI
    const response = await fetch(settings.endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${settings.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 8000,
      }),
    });

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) {
      return Response.json({ error: `AI 服务返回错误：${data.error?.message ?? response.statusText}` }, { status: 502 });
    }

    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content) {
      return Response.json({ error: 'AI 返回了空内容，请稍后再试。' }, { status: 502 });
    }

    // 解析文本
    const parsed = parseWeeklyPlan(content);

    // 至少要有 1 天的数据
    if (parsed.days.length === 0) {
      // 如果解析失败，用 AI 原文的前 500 字当错误信息
      return Response.json({
        error: `无法解析 AI 返回的食谱格式。AI 返回内容预览：${content.slice(0, 500)}`,
      }, { status: 500 });
    }

    const actualDays = Math.min(parsed.days.length, 7);
    console.log(`[周计划] 解析成功，共 ${actualDays} 天`);

    const db = getDb();
    const now = new Date().toISOString();

    // 归档之前的活跃计划
    await db.update(weeklyPlans)
      .set({ status: 'archived', updatedAt: now })
      .where(and(eq(weeklyPlans.userId, user.id), eq(weeklyPlans.status, 'active')));

    // 插入新计划
    const planResult = await db.insert(weeklyPlans).values({
      userId: user.id,
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      status: 'active',
      goal: parsed.goal,
      targetCalories: parsed.targetCalories,
      targetProtein: parsed.targetProtein,
      rationale: parsed.rationale,
      createdAt: now,
      updatedAt: now,
    }).returning({ id: weeklyPlans.id });

    const planId = planResult[0].id;

    // 插入每日菜品
    const allMeals: any[] = [];
    const mealTypes = ['breakfast', 'lunch', 'dinner'] as const;
    const mealLabels: Record<string, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };

    for (let i = 0; i < actualDays; i++) {
      const day = parsed.days[i];
      if (!day) continue;

      for (const mealType of mealTypes) {
        const dishStr = day[mealType as keyof typeof day];
        if (!dishStr) continue;

        const dish = parseDish(dishStr);
        allMeals.push({
          planId,
          userId: user.id,
          date: days[i].date,
          dayOfWeek: days[i].dayOfWeek,
          mealType,
          dishName: dish.name || `${mealLabels[mealType]}菜品`,
          calories: dish.calories,
          protein: dish.protein,
          ingredientsJson: JSON.stringify(dish.ingredients),
          stepsJson: JSON.stringify([]),
          sortOrder: 0,
          createdAt: now,
        });
      }
    }

    let mealsInserted = 0;
    if (allMeals.length > 0) {
      await db.insert(dailyMeals).values(allMeals);
      mealsInserted = allMeals.length;
    }

    // 插入采购清单
    let shoppingInserted = 0;
    if (parsed.shoppingList.length > 0) {
      await db.insert(shoppingItems).values(
        parsed.shoppingList.map((item) => ({
          planId,
          userId: user.id,
          name: item.name,
          amount: item.amount,
          reason: '',
          purchased: 0,
          createdAt: now,
        }))
      );
      shoppingInserted = parsed.shoppingList.length;
    }

    // 插入 AI 洞察
    let insightsInserted = 0;
    if (parsed.suggestions.length > 0) {
      const insightValues = parsed.suggestions.slice(0, 5).map((s, idx) => ({
        userId: user.id,
        type: 'suggestion' as const,
        category: 'nutrition',
        title: s.length > 20 ? s.slice(0, 20) + '...' : s,
        content: s,
        priority: 5 - idx,
        createdAt: now,
      }));
      await db.insert(aiInsights).values(insightValues);
      insightsInserted = insightValues.length;
    }

    console.log(`[周计划] 写入完成：${mealsInserted} 道菜，${shoppingInserted} 项采购，${insightsInserted} 条建议`);

    return Response.json({
      planId,
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      mealsInserted,
      shoppingInserted,
      insightsInserted,
      daysGenerated: actualDays,
    });
  } catch (e: any) {
    console.error('[周计划生成错误]', e);
    return Response.json({
      error: `生成失败：${e.message || '未知错误'}`,
    }, { status: 500 });
  }
}
