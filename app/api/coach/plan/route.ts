import { getCurrentUser } from '@/lib/auth';
import { getAiSettings } from '@/lib/ai-settings';

const SYSTEM_PROMPT = `你是"轻养"的专业营养与健康行为教练。你的任务是根据用户的身体数据和冰箱库存，生成结构化的每日食谱。

重要规则：
1. 你必须返回严格的 JSON 格式，不能有任何 Markdown、解释文字或额外内容。
2. 每道菜必须有具体的食材、用量、热量和蛋白质估算。
3. 优先使用冰箱中临期（3天内）的食材。
4. 考虑用户的目标（减脂/增肌/维持），合理分配热量和蛋白质。
5. 菜谱要好吃易做，适合宿舍或小厨房环境。
6. 不给出激进热量缺口，安全第一。

返回的 JSON 格式必须如下：
{
  "summary": {
    "totalCalories": 1800,
    "totalProtein": 100,
    "rationale": "简要说明为什么这样安排，包括热量范围、蛋白质分配原则",
    "missingInfo": ["缺少的必要信息列表，如年龄、性别、身高等，如果都有则为空数组"]
  },
  "meals": [
    {
      "type": "breakfast",
      "name": "早餐",
      "calories": 450,
      "protein": 25,
      "dishes": [
        {
          "name": "菜名",
          "ingredients": [
            { "name": "食材名", "amount": "用量", "fromFridge": true/false }
          ],
          "calories": 300,
          "protein": 15,
          "steps": ["步骤1", "步骤2"]
        }
      ]
    },
    {
      "type": "lunch",
      "name": "午餐",
      "calories": 650,
      "protein": 40,
      "dishes": [...]
    },
    {
      "type": "dinner",
      "name": "晚餐",
      "calories": 550,
      "protein": 30,
      "dishes": [...]
    }
  ],
  "shoppingList": [
    { "name": "需要采购的食材", "amount": "用量", "reason": "为什么需要买" }
  ]
}

只返回 JSON，不要任何其他文字。`;

function extractJson(text: string): any {
  // Try to find JSON in the response (handle cases where model wraps in ```json)
  const trimmed = text.trim();

  // Direct JSON
  if (trimmed.startsWith('{')) {
    try { return JSON.parse(trimmed); } catch { /* fall through */ }
  }

  // Code block
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch { /* fall through */ }
  }

  // Find first { and last }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)); } catch { /* fall through */ }
  }

  throw new Error('无法解析 AI 返回的食谱数据');
}

// Generate meal plan
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
    currentPlan?: any;
    adjustRequest?: string;
  };

  let userPrompt = '';

  if (body.adjustRequest && body.currentPlan) {
    // Adjust existing plan
    userPrompt = `当前食谱：
${JSON.stringify(body.currentPlan, null, 2)}

用户要求调整：${body.adjustRequest}

请根据用户要求修改食谱，返回完整的新食谱 JSON。`;
  } else {
    // Generate new plan
    userPrompt = `用户身体数据：
${JSON.stringify(body.measurements || {})}

冰箱库存：
${JSON.stringify(body.foods || [], null, 2)}

冰箱分区容量：
${JSON.stringify(body.zones || [], null, 2)}

用户目标：${body.goal || '健康减脂，提升肌肉量'}
执行条件：${body.constraints || '宿舍环境，小锅，简单易做'}

请根据以上信息生成今日的完整食谱，返回 JSON 格式。`;
  }

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
        temperature: 0.4,
        max_tokens: 4000,
      }),
    });

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) return Response.json({ error: data.error?.message ?? 'AI 服务暂时不可用。' }, { status: response.status });

    const content = data.choices?.[0]?.message?.content ?? '';
    const plan = extractJson(content);

    return Response.json({ plan });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : '连接 AI 服务失败，请检查网络和配置。' }, { status: 502 });
  }
}
