import { getCurrentUser } from '@/lib/auth';
import { getAiSettings } from '@/lib/ai-settings';
import { formatKnowledgeContext, retrieveNutritionKnowledge } from '@/lib/nutrition-knowledge';

const SYSTEM_PROMPT = `你是"轻养"的 AI 营养师，名字叫"小养"。

你的性格：温暖、专业、有耐心，像一个贴心的营养师朋友。

你的工作方式：
1. 营养健康永远是第一位。你会根据用户的身体数据、目标，先制定科学的营养方案，再考虑冰箱库存。
2. 冰箱里的食材只是"优先使用"，不能因为要清库存而牺牲营养均衡。缺的食材该买就买。
3. 如果用户提到要调整目标、改计划，你要主动确认细节，确保理解正确。
4. 回答要简洁、实用，不要长篇大论，重点突出。
5. 可以适当使用 emoji，但不要太多，一两个就好。
6. 用简体中文回答。

注意事项：
- 不诊断或替代医生，涉及医学判断时建议咨询医生。
- 不给出激进的热量缺口或强制断食方案，安全第一。
- 语气温和、直接、不羞辱，不把饮食当惩罚。
- 营养目标使用范围表达，并说明会随年龄、体重、运动量与健康状况变化；资料不足时先补问。`;

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const settings = await getAiSettings(user.id);
  if (!settings) return Response.json({ error: '请先在"营养师 → AI 设置"中配置接口、模型和密钥。' }, { status: 503 });

  const body = await request.json() as {
    message: string;
    context?: {
      currentPlan?: any;
      measurements?: any;
      foods?: any;
    };
  };

  if (!body.message?.trim()) {
    return Response.json({ error: '请输入消息内容。' }, { status: 400 });
  }
  const retrieved = retrieveNutritionKnowledge(body.message);

  // Build context info for the AI
  const contextParts: string[] = [];

  if (body.context?.measurements) {
    contextParts.push(`用户身体数据：\n${JSON.stringify(body.context.measurements, null, 2)}`);
  }

  if (body.context?.foods) {
    contextParts.push(`冰箱库存：\n${JSON.stringify(body.context.foods, null, 2)}`);
  }

  if (body.context?.currentPlan) {
    contextParts.push(`当前周计划：\n${JSON.stringify(body.context.currentPlan, null, 2)}`);
  }

  const userPrompt = contextParts.length > 0
    ? `${contextParts.join('\n\n')}\n\n检索到的权威知识：\n${formatKnowledgeContext(retrieved)}\n\n用户说：${body.message}`
    : `检索到的权威知识：\n${formatKnowledgeContext(retrieved)}\n\n用户说：${body.message}`;

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
        max_tokens: 1200,
      }),
    });

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) return Response.json({ error: data.error?.message ?? 'AI 服务暂时不可用。' }, { status: response.status });

    const reply = data.choices?.[0]?.message?.content ?? '';
    return Response.json({ reply, retrieval: { strategy: 'keyword+character-bigram', entries: retrieved.map(({ id, title, source, sourceUrl, score }) => ({ id, title, source, sourceUrl, score })) } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : '连接 AI 服务失败，请检查网络和配置。' }, { status: 502 });
  }
}
