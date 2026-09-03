import { getCurrentUser } from '@/lib/auth';
import { getAiSettings } from '@/lib/ai-settings';
import { BODY_PARSE_PROMPT_VERSION, sanitizeBodyMetrics } from '@/lib/body-metrics';

const SYSTEM_PROMPT = `你是"轻养"的身体数据提取助手。用户会上传一张智能体脂秤（如米家、华为等）的报告截图，请你从图片中准确提取各项身体指标。

提取要求：
1. 只返回 JSON，不要任何解释文字、不要 markdown 代码块
2. 遇到看不清、找不到的指标就省略该字段，不要编造
3. 数值只保留数字部分，去掉单位；例如 "53.4 kg" -> "53.4"、"26.5%" -> "26.5"
4. 返回格式如下：

{"体重":"53.4","BMI":"20.9","体脂率":"26.5","脂肪量":"14.2","肌肉量":"37.0","肌肉率":"69.3","骨骼肌":"19.5","去脂体重":"39.2","体水分":"52.8","蛋白质率":"15.5","骨量":"2.2","骨盐率":"4.1","内脏脂肪":"7","基础代谢":"1217","腰臀比":"1.1","心率":"102","身体得分":"80","身体年龄":"18"}`;

function extractJson(text: string): any {
  const trimmed = text.trim();
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch { /* fall through */ }
  }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)); } catch { /* fall through */ }
  }
  throw new Error('无法从 AI 返回内容中解析 JSON');
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const settings = await getAiSettings(user.id);
  if (!settings) return Response.json({ error: '请先在"营养师 → AI 设置"中配置接口、模型和密钥。' }, { status: 503 });

  const body = await request.json() as { image?: string };
  if (!body.image || !body.image.startsWith('data:image')) {
    return Response.json({ error: '缺少有效的图片数据。' }, { status: 400 });
  }

  const imageHeader = body.image.slice(0, body.image.indexOf(','));
  if (!/^data:image\/(jpeg|png|webp);base64$/i.test(imageHeader)) {
    return Response.json({ error: '仅支持 JPG、PNG 或 WebP 图片。' }, { status: 400 });
  }
  if (body.image.length > 8_000_000) {
    return Response.json({ error: '图片过大，请压缩到 6MB 以内再上传。' }, { status: 413 });
  }

  // 控制图片大小，避免请求体过大
  const image = body.image;

  const userPrompt = '请识别这张体脂秤报告截图中的身体指标，并按要求返回 JSON。';

  try {
    const response = await fetch(settings.endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${settings.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
      error?: { message?: string };
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    if (!response.ok) {
      const msg = data.error?.message ?? 'AI 服务暂时不可用。';
      // 若模型不支持视觉，给出可操作的提示
      const visionHint = /image|vision|多模态|multimodal/i.test(msg)
        ? '，当前配置的模型可能不支持图片识别，建议选手动填写'
        : '';
      return Response.json({ error: msg + visionHint }, { status: response.status });
    }

    let content = data.choices?.[0]?.message?.content ?? '';
    if (Array.isArray(content)) {
      content = content.filter((c): c is { text: string } => typeof c === 'object' && c !== null && typeof c.text === 'string').map((c) => c.text).join('\n');
    }
    if (!content) return Response.json({ error: 'AI 未能识别出内容，请尝试手动填写。' });

    const raw = extractJson(content);
    // 只保留合法指标，过滤掉非字符串/空值
    const metrics = sanitizeBodyMetrics(raw);

    if (Object.keys(metrics).length === 0) {
      return Response.json({ error: '未能识别出有效指标，请换张清晰的截图或手动填写。' });
    }

    return Response.json({
      metrics,
      message: `已从图片解析出 ${Object.keys(metrics).length} 项指标 ✨`,
      meta: { model: settings.model, promptVersion: BODY_PARSE_PROMPT_VERSION, durationMs: Date.now() - startedAt, usage: data.usage },
    });
  } catch {
    return Response.json({ error: '解析失败，请换张清晰的截图或手动填写。' }, { status: 500 });
  }
}
