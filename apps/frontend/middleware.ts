import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Platform: protect everything under /platform except the login page
  if (pathname.startsWith('/platform') && pathname !== '/platform/login') {
    const platformRt = request.cookies.get('platform_rt');
    if (!platformRt) {
      return NextResponse.redirect(new URL('/platform/login', request.url));
    }
  }

  // Dashboard: protect all /dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const authRt = request.cookies.get('auth_rt');
    if (!authRt) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Portal: protect /portal routes except /portal/select-role
  if (
    pathname.startsWith('/portal') &&
    !pathname.startsWith('/portal/select-role')
  ) {
    const authRt = request.cookies.get('auth_rt');
    if (!authRt) {
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
