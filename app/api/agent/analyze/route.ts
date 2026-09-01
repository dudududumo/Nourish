import { getCurrentUser } from '@/lib/auth';
import { getAiSettings } from '@/lib/ai-settings';
import { getDb } from '@/db';
import { aiInsights } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

const SYSTEM_PROMPT = `你是"轻养"的 AI 营养师 Agent，主动监控用户的身体数据和冰箱变化。当检测到变化时，主动分析并给出个性化的洞察建议。

核心规则：
1. 必须返回严格的 JSON 格式，不能有任何 Markdown、解释文字或额外内容。
2. 洞察要具体、可操作，不要空泛的套话。
3. 生成 2-5 条最有分量的洞察，宁缺毋滥，不要为凑数硬凑。优先选真正值得用户注意的：健康风险、趋势异常、临期风险。数据少时允许只返回 1-2 条。
4. 优先关注：体重趋势、体脂变化、临期食材、营养均衡。

洞察类型说明：
- observation：客观观察，陈述事实和趋势
- suggestion： actionable 建议，告诉用户应该怎么做
- warning：需要注意的警示，可能存在的风险或问题

分类说明：
- body：身体数据相关（体重、体脂、肌肉等）
- fridge：冰箱/食材相关（临期、库存等）
- nutrition：营养均衡相关
- habit：生活习惯相关

返回 JSON 格式：
{
  "insights": [
    {
      "type": "suggestion",
      "category": "body",
      "title": "简洁的标题",
      "content": "具体的洞察内容，要有数据支撑和可操作的建议，不要空泛。",
      "priority": 2
    }
  ]
}

priority 说明：0=普通，1=较重要，2=重要，3=非常重要。

只返回 JSON，不要任何其他文字。`;

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
  throw new Error('无法解析 AI 返回的洞察数据');
}

type InsightType = 'observation' | 'suggestion' | 'warning';
type InsightCategory = 'body' | 'fridge' | 'nutrition' | 'habit';

interface Insight {
  type: InsightType;
  category: InsightCategory;
  title: string;
  content: string;
  priority: number;
}

// Trigger proactive AI analysis when body data or fridge data changes
export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const settings = await getAiSettings(user.id);
  if (!settings) return Response.json({ error: '请先在"营养师 → AI 设置"中配置接口、模型和密钥。' }, { status: 503 });

  const body = await request.json() as {
    triggerType: 'body' | 'fridge' | 'both';
    changes: string;
    measurements?: Record<string, string>;
    foods?: Array<{ name: string; zone: string; amount: string; days: number }>;
    zones?: Array<{ id: string; name: string; type: string; capacity: number; used: number }>;
  };

  if (!body.triggerType || !body.changes) {
    return Response.json({ error: '缺少 triggerType 或 changes 参数。' }, { status: 400 });
  }

  const triggerLabel = body.triggerType === 'body'
    ? '身体数据变化'
    : body.triggerType === 'fridge'
      ? '冰箱数据变化'
      : '身体数据和冰箱数据同时变化';

  const userPrompt = `触发类型：${triggerLabel}

变化描述：
${body.changes}
${body.measurements ? `
当前身体数据：
${JSON.stringify(body.measurements, null, 2)}` : ''}${body.foods ? `
当前冰箱食材：
${JSON.stringify(body.foods, null, 2)}` : ''}${body.zones ? `
冰箱分区容量：
${JSON.stringify(body.zones, null, 2)}` : ''}

请根据以上变化数据，主动分析并生成 2-5 条最有含金量的洞察建议。
要求：
- 只保留最值得注意的内容，不凑数，数量按实际值得说的来（2-5 条均可）
- 洞察要具体、有数据支撑、可操作
- 优先关注：体重趋势、体脂变化、临期食材、营养均衡
- 类型合理分配（观察/建议/警示）
- 返回严格的 JSON 格式`;

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
        temperature: 0.5,
        max_tokens: 2000,
      }),
    });

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) return Response.json({ error: data.error?.message ?? 'AI 服务暂时不可用。' }, { status: response.status });

    const content = data.choices?.[0]?.message?.content ?? '';
    const result = extractJson(content);

    const insights: Insight[] = Array.isArray(result.insights) ? result.insights : [];
    if (insights.length === 0) {
      return Response.json({ error: 'AI 未生成任何洞察。' }, { status: 502 });
    }

    const db = getDb();
    const now = new Date().toISOString();

    // 覆盖旧洞察：冰箱分析只保留本次冰箱类，身体分析只保留本次身体类，每日(both)清空重来
    if (body.triggerType === 'fridge') {
      await db.delete(aiInsights).where(and(eq(aiInsights.userId, user.id), eq(aiInsights.category, 'fridge')));
    } else if (body.triggerType === 'body') {
      await db.delete(aiInsights).where(and(eq(aiInsights.userId, user.id), inArray(aiInsights.category, ['body', 'nutrition', 'habit'])));
    } else if (body.triggerType === 'both') {
      await db.delete(aiInsights).where(eq(aiInsights.userId, user.id));
    }

    // Insert AI insights into database（逐条插入，绕开批量插入 autoIncrement 主键为 null 的 bug）
    // 按触发源强制归类：冰箱分析→fridge，身体分析→body，让洞察与来源可靠同步
    const forcedCategory = body.triggerType === 'fridge' ? 'fridge' : body.triggerType === 'body' ? 'body' : null;
    const inserted: any[] = [];
    for (const ins of insights) {
      const row = await db.insert(aiInsights).values({
        userId: user.id,
        type: ins.type || 'suggestion',
        category: forcedCategory ?? (ins.category || 'nutrition'),
        title: ins.title,
        content: ins.content,
        priority: ins.priority || 0,
        createdAt: now,
      }).returning();
      if (row[0]) inserted.push(row[0]);
    }

    return Response.json({ insights: inserted, count: inserted.length });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : '分析失败，请稍后再试。' }, { status: 502 });
  }
}
