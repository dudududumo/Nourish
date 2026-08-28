import { registerUser, sessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: string; password?: string; nickname?: string };
    if (!body.phone || !body.password) {
      return Response.json({ error: '请输入手机号和密码' }, { status: 400 });
    }

    const user = await registerUser(body.phone, body.password, body.nickname);
    const token = (await loginUserForRegister(body.phone, body.password)).token;

    return Response.json({ user }, {
      status: 201,
      headers: { 'Set-Cookie': sessionCookie(token) },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '注册失败' },
      { status: 400 },
    );
  }
}

// Helper to avoid circular import
async function loginUserForRegister(phone: string, password: string) {
  const { loginUser } = await import('@/lib/auth');
  return loginUser(phone, password);
}
