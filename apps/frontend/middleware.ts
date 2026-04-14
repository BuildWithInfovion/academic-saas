import { NextResponse } from 'next/server';

/**
 * The auth_rt / platform_rt cookies are set by the Railway backend
 * (academic-saas-production.up.railway.app) and are therefore stored under
 * that domain in the browser. The Next.js Edge middleware runs on the Vercel
 * domain (app.buildwithinfovion.com) and cannot read cookies that belong to a
 * different domain — so cookie-based route guards here would redirect every
 * logged-in user back to the login page.
 *
 * Route protection is handled entirely client-side: each layout calls
 * silentRefresh() / silentPlatformRefresh() on mount, which hits the backend
 * with credentials:include (the browser sends the backend-domain cookie
 * automatically), and redirects to the login page if the session is invalid.
 *
 * This middleware is kept as a pass-through so it can be extended later
 * (e.g. i18n, A/B headers) without touching the auth layouts.
 */
export function middleware() {
  return NextResponse.next();
}

export const config = {
  // Only run on routes that need eventual protection — currently a no-op
  matcher: ['/platform/((?!login).*)', '/dashboard/:path*', '/portal/((?!select-role).*)'],
};
