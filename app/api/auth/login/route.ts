import { loginUser, sessionCookie } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: string; password?: string };
    if (!body.phone || !body.password) {
      return Response.json({ error: '请输入手机号和密码' }, { status: 400 });
    }
    const source = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    const rate = await enforceRateLimit('login', `${source}:${body.phone}`, 8, 15 * 60);
    if (!rate.allowed) return Response.json({ error: '尝试次数过多，请稍后再试。' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } });

    const { user, token } = await loginUser(body.phone, body.password);

    return Response.json({ user }, {
      headers: { 'Set-Cookie': sessionCookie(token) },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '登录失败' },
      { status: 401 },
    );
  }
}
