import { loginUser, sessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: string; password?: string };
    if (!body.phone || !body.password) {
      return Response.json({ error: '请输入手机号和密码' }, { status: 400 });
    }

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
