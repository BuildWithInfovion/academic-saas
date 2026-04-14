import { NextResponse } from 'next/server';

/**
 * Temporary pass-through while api.buildwithinfovion.com SSL is being provisioned.
 *
 * Once SSL is ready and NEXT_PUBLIC_API_URL is switched to api.buildwithinfovion.com,
 * restore cookie-based route protection here:
 *   - sameSite: 'lax', domain: '.buildwithinfovion.com' in backend cookie options
 *   - cookie checks for auth_rt / platform_rt in this middleware
 *
 * Route protection is currently handled client-side by silentRefresh() /
 * silentPlatformRefresh() in each layout.
 */
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ['/platform/((?!login).*)', '/dashboard/:path*', '/portal/((?!select-role).*)'],
};
