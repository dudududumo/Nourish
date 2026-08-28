import { getChatGPTUser } from '@/app/chatgpt-auth';

const COACH_INSTRUCTIONS = `你是“轻养”的专业营养与健康行为教练。你面向一位希望健康减脂、改善身体组成、偏好好吃易做食物和低冲击训练的用户。

工作规则：
1. 每次建议必须分清：用户实测数据、合理推断、仍缺少的信息。不得把体脂秤的生物电阻抗估算当作诊断。
2. 解释为什么这样安排，包括热量范围、蛋白质分配、蔬果/纤维、饱腹感、库存临期与执行难度。
3. 未知实际年龄、性别、身高、疾病、用药、过敏、经期/孕哺、进食障碍或低血糖风险时，不给出激进热量缺口或强制断食方案。
4. 不诊断或替代医生。静息心率持续偏高、头晕心悸、晕厥、胸痛、月经异常或其他警示症状时建议及时复测并寻求医疗帮助。
5. 菜谱要具体、好吃、宿舍友好，并优先使用临期库存；调整后同步说明冰箱容量和采购影响。
6. 语气温和、直接、不羞辱，不把饮食或断食当惩罚。回答使用简体中文。
7. 涉及会变化或医学营养事实时优先通过 web_search 查阅权威一手来源，并简短列出来源链接。`;

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '请先使用 ChatGPT 账号登录。' }, { status: 401 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: 'AI 营养师尚未完成安全连接：需要先配置 OpenAI API 密钥。当前不会用模拟答案代替。' }, { status: 503 });
  const body = await request.json() as { question?: string; context?: unknown };
  if (!body.question?.trim()) return Response.json({ error: '请输入问题。' }, { status: 400 });

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5.6-terra',
      instructions: COACH_INSTRUCTIONS,
      input: `用户问题：${body.question}\n\n当前个人数据：${JSON.stringify(body.context ?? {})}`,
      reasoning: { effort: 'medium' },
      text: { verbosity: 'medium' },
      tools: [{ type: 'web_search' }],
      include: ['web_search_call.action.sources'],
      max_output_tokens: 1400,
      safety_identifier: user.userId.slice(0, 64),
    }),
  });
  const data = await response.json() as { output_text?: string; error?: { message?: string }; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
  if (!response.ok) return Response.json({ error: data.error?.message ?? 'AI 服务暂时不可用。' }, { status: response.status });
  const answer = data.output_text ?? data.output?.flatMap((item) => item.content ?? []).filter((item) => item.type === 'output_text').map((item) => item.text).join('\n') ?? '';
  return Response.json({ answer });
}
