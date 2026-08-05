import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const WORKOS_SESSION_COOKIE_NAME = 'qiuai_workos_session';
const SUPPORT_LOGIN_MAX_AGE_SECONDS = 60 * 60 * 2;

export function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim();
  const workspaceId = request.nextUrl.searchParams.get('workspaceId')?.trim();
  const redirectUrl = new URL('/enterprise', request.nextUrl.origin);

  if (workspaceId) {
    redirectUrl.searchParams.set('workspaceId', workspaceId);
  }
  redirectUrl.searchParams.set('support', 'admin');

  if (!token) {
    const loginUrl = new URL('/login', request.nextUrl.origin);
    loginUrl.searchParams.set(
      'next',
      `${redirectUrl.pathname}${redirectUrl.search}`
    );
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set({
    name: WORKOS_SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' || process.env.WORKOS_COOKIE_SECURE === 'true',
    path: '/',
    maxAge: SUPPORT_LOGIN_MAX_AGE_SECONDS
  });

  return response;
}
