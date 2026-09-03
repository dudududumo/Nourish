import { getCurrentUser } from '@/lib/auth';
import { getAiSettings } from '@/lib/ai-settings';
import { formatKnowledgeContext, retrieveNutritionKnowledge } from '@/lib/nutrition-knowledge';

const COACH_INSTRUCTIONS = `你是"轻养"的专业营养与健康行为教练。你面向一位希望健康减脂、改善身体组成、偏好好吃易做食物和低冲击训练的用户。

工作规则：
1. 每次建议必须分清：用户实测数据、合理推断、仍缺少的信息。不得把体脂秤的生物电阻抗估算当作诊断。
2. 解释为什么这样安排，包括热量范围、蛋白质分配、蔬果/纤维、饱腹感、库存临期与执行难度。
3. 未知实际年龄、性别、身高、疾病、用药、过敏、经期/孕哺、进食障碍或低血糖风险时，不给出激进热量缺口或强制断食方案。
4. 不诊断或替代医生。静息心率持续偏高、头晕心悸、晕厥、胸痛、月经异常或其他警示症状时建议及时复测并寻求医疗帮助。
5. 菜谱要具体、好吃、宿舍友好，并优先使用临期库存；调整后同步说明冰箱容量和采购影响。
6. 语气温和、直接、不羞辱，不把饮食或断食当惩罚。回答使用简体中文。
7. 优先采用以下知识库原则：WHO 成人活动建议、CDC 渐进减重原则、体脂秤 BIA 只看标准化条件下的长期趋势、中国居民膳食指南的食物多样与均衡原则。涉及医学判断时明确建议咨询医生，不编造来源。`;

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const settings = await getAiSettings(user.id);
  if (!settings) return Response.json({ error: '请先在"营养师 → AI 设置"中配置接口、模型和密钥。' }, { status: 503 });

  const body = await request.json() as { question?: string; context?: unknown };
  if (!body.question?.trim()) return Response.json({ error: '请输入问题。' }, { status: 400 });
  const retrieved = retrieveNutritionKnowledge(body.question);

  try {
    const response = await fetch(settings.endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${settings.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: COACH_INSTRUCTIONS },
          { role: 'user', content: `用户问题：${body.question}\n\n当前个人数据：${JSON.stringify(body.context ?? {})}\n\n检索到的权威知识：\n${formatKnowledgeContext(retrieved)}\n\n仅在相关时使用上述知识；引用时使用对应来源名，不要编造未提供的来源。` },
        ],
        temperature: 0.3,
        max_tokens: 1600,
      }),
    });
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) return Response.json({ error: data.error?.message ?? 'AI 服务暂时不可用。' }, { status: response.status });
    const answer = data.choices?.[0]?.message?.content ?? '';
    return Response.json({ answer, retrieval: { strategy: 'keyword+character-bigram', entries: retrieved.map(({ id, title, source, sourceUrl, score }) => ({ id, title, source, sourceUrl, score })) } });
  } catch (e) {
    return Response.json({ error: '连接 AI 服务失败，请检查网络和配置。' }, { status: 502 });
  }
}
