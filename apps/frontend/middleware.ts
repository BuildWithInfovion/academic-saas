import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Server-side route protection via httpOnly cookies.
 *
 * Both frontend (app.buildwithinfovion.com) and backend (api.buildwithinfovion.com)
 * share the root domain. Cookies are set with Domain=.buildwithinfovion.com so the
 * browser includes them on requests to ALL *.buildwithinfovion.com subdomains —
 * which means this Edge middleware can read them here on the Vercel domain.
 *
 * auth_rt_op   — operator/admin (7-day refresh token, dashboard only)
 * auth_rt      — portal users: parent, teacher, principal, etc. (7-day refresh token)
 * platform_rt  — platform admin / Infovion internal (8-hour access token)
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/platform') && pathname !== '/platform/login') {
    if (!request.cookies.get('platform_rt')) {
      return NextResponse.redirect(new URL('/platform/login', request.url));
    }
  }

  if (pathname.startsWith('/dashboard')) {
    if (!request.cookies.get('auth_rt_op')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  if (pathname.startsWith('/portal') && !pathname.startsWith('/portal/select-role')) {
    if (!request.cookies.get('auth_rt')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/platform/((?!login).*)',
    '/dashboard/:path*',
    '/portal/((?!select-role).*)',
  ],
};
