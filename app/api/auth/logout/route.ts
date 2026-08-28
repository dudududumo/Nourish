import { logoutUser, clearSessionCookie, SESSION_COOKIE } from '@/lib/auth';

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const match = cookieHeader?.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
  if (match?.[1]) {
    await logoutUser(match[1]);
  }

  return Response.json({ ok: true }, {
    headers: { 'Set-Cookie': clearSessionCookie() },
  });
}
