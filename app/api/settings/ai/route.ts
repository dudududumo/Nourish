import { getCurrentUser } from '@/lib/auth';
import { getAiSettings, saveAiSettings } from '@/lib/ai-settings';

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const settings = await getAiSettings(user.id);
  return Response.json(settings ? { configured: true, provider: settings.provider, endpoint: settings.endpoint, model: settings.model } : { configured: false });
}

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const body = await request.json() as { provider?: string; endpoint?: string; model?: string; apiKey?: string };
  if (!body.provider?.trim() || !body.endpoint?.trim() || !body.model?.trim() || !body.apiKey?.trim()) return Response.json({ error: '请填写完整配置。' }, { status: 400 });

  try {
    await saveAiSettings(user.id, { provider: body.provider.trim(), endpoint: body.endpoint.trim(), model: body.model.trim(), apiKey: body.apiKey.trim() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '保存失败。' }, { status: 400 });
  }
  return Response.json({ ok: true });
}
