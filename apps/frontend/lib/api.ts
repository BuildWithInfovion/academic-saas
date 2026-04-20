import { useAuthStore } from '@/store/auth.store';
import { usePortalAuthStore } from '@/store/portal-auth.store';
import { DASHBOARD_ROLES } from '@/lib/auth-utils';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Returns the auth store that currently holds a valid session.
 * Portal store takes precedence when it has a token; otherwise falls back
 * to the dashboard store. This lets apiFetch work correctly on both
 * /dashboard and /portal routes without needing pathname context.
 */
function getActiveAuthState() {
  const portal = usePortalAuthStore.getState();
  if (portal.accessToken) return portal;
  return useAuthStore.getState();
}

type ApiOptions = RequestInit & {
  institutionId?: string;
};

type RefreshResult =
  | { status: 'success'; accessToken: string }
  | { status: 'expired' }
  | { status: 'unavailable' };

// Singleton guards to prevent concurrent refresh storms.
// Separate per portal type: operators use /auth/refresh-op (auth_rt_op cookie),
// portal users use /auth/refresh (auth_rt cookie).
let refreshingOpPromise: Promise<RefreshResult> | null = null;
let refreshingPortalPromise: Promise<RefreshResult> | null = null;

// Singleton guards for silentRefresh — same separation
let silentRefreshOpPromise: Promise<'ok' | 'expired' | 'error'> | null = null;
let silentRefreshPortalPromise: Promise<'ok' | 'expired' | 'error'> | null = null;

function buildRequestHeaders(
  headers: HeadersInit | undefined,
  tenantId: string,
  token: string | null,
  body: BodyInit | null | undefined,
): Headers {
  const merged = new Headers(headers);

  merged.set('X-Institution-ID', tenantId);

  if (token) merged.set('Authorization', `Bearer ${token}`);
  else merged.delete('Authorization');

  // Let the browser set the multipart boundary for FormData payloads.
  if (body instanceof FormData) {
    merged.delete('Content-Type');
    return merged;
  }

  if (body != null && !merged.has('Content-Type')) {
    merged.set('Content-Type', 'application/json');
  }

  return merged;
}

async function doRefresh(endpoint: string): Promise<RefreshResult> {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.status === 401) {
      getActiveAuthState().logout();
      if (typeof window !== 'undefined') window.location.href = '/';
      return { status: 'expired' };
    }
    if (!res.ok) return { status: 'unavailable' };
    const data = (await res.json()) as {
      accessToken: string;
      user?: { roles?: string[] } & Record<string, unknown>;
    };
    const roles: string[] = data.user?.roles ?? [];
    const isDashboard = roles.some((r) => DASHBOARD_ROLES.includes(r));
    const store = isDashboard ? useAuthStore.getState() : usePortalAuthStore.getState();
    store.setAuth({
      accessToken: data.accessToken,
      user: (data.user as Parameters<typeof store.setAuth>[0]['user']) ?? useAuthStore.getState().user!,
    });
    return { status: 'success', accessToken: data.accessToken };
  } catch {
    return { status: 'unavailable' };
  }
}

/**
 * Attempt one silent token refresh on 401, using the correct endpoint based on
 * which store holds the current user (operator → /auth/refresh-op, portal → /auth/refresh).
 */
async function tryRefreshToken(): Promise<RefreshResult> {
  const isOperator = !!useAuthStore.getState().user;
  const endpoint = isOperator ? '/auth/refresh-op' : '/auth/refresh';

  if (isOperator) {
    if (refreshingOpPromise) return refreshingOpPromise;
    refreshingOpPromise = doRefresh(endpoint).finally(() => { refreshingOpPromise = null; });
    return refreshingOpPromise;
  } else {
    if (refreshingPortalPromise) return refreshingPortalPromise;
    refreshingPortalPromise = doRefresh(endpoint).finally(() => { refreshingPortalPromise = null; });
    return refreshingPortalPromise;
  }
}

/**
 * Restore the operator (admin) session on page load via the httpOnly auth_rt_op cookie.
 * The /auth/refresh-op endpoint reads that cookie — no body token needed.
 */
export async function silentRefreshOp(): Promise<'ok' | 'expired' | 'error'> {
  if (silentRefreshOpPromise) return silentRefreshOpPromise;

  silentRefreshOpPromise = (async (): Promise<'ok' | 'expired' | 'error'> => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh-op`, {
        method: 'POST',
        credentials: 'include',
        body: '{}',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.status === 401) return 'expired';
      if (!res.ok) {
        console.warn('[silentRefreshOp] refresh failed with status', res.status);
        return 'error';
      }

      const data = (await res.json()) as {
        accessToken: string;
        user: { roles?: string[] } & Record<string, unknown>;
      };
      if (!data.user) return 'error';

      useAuthStore.getState().setAuth({
        accessToken: data.accessToken,
        user: data.user as Parameters<ReturnType<typeof useAuthStore.getState>['setAuth']>[0]['user'],
      });
      return 'ok';
    } catch (err) {
      console.warn('[silentRefreshOp] network/CORS error during refresh:', err);
      return 'error';
    } finally {
      silentRefreshOpPromise = null;
    }
  })();

  return silentRefreshOpPromise;
}

/**
 * Restore the portal user session on page load via the httpOnly auth_rt cookie.
 * Used by portal layouts (parent, teacher, principal, etc.).
 */
export async function silentRefresh(): Promise<'ok' | 'expired' | 'error'> {
  if (silentRefreshPortalPromise) return silentRefreshPortalPromise;

  silentRefreshPortalPromise = (async (): Promise<'ok' | 'expired' | 'error'> => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        body: '{}',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.status === 401) return 'expired';
      if (!res.ok) {
        console.warn('[silentRefresh] refresh failed with status', res.status);
        return 'error';
      }

      const data = (await res.json()) as {
        accessToken: string;
        user: { roles?: string[] } & Record<string, unknown>;
      };
      if (!data.user) return 'error';

      const roles: string[] = data.user.roles ?? [];
      const isDashboard = roles.some((r) => DASHBOARD_ROLES.includes(r));
      const user = data.user as Parameters<
        ReturnType<typeof useAuthStore.getState>['setAuth']
      >[0]['user'];

      if (isDashboard) {
        useAuthStore.getState().setAuth({ accessToken: data.accessToken, user });
      } else {
        usePortalAuthStore.getState().setAuth({ accessToken: data.accessToken, user });
      }
      return 'ok';
    } catch (err) {
      console.warn('[silentRefresh] network/CORS error during refresh:', err);
      return 'error';
    } finally {
      silentRefreshPortalPromise = null;
    }
  })();

  return silentRefreshPortalPromise;
}

/**
 * Safely read an HTTP response body exactly ONCE and return a parsed result.
 * Never throws "body stream already read".
 */
async function readResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Extract a human-readable error message from an API error response.
 */
function extractErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b['message'] === 'string' && b['message']) return b['message'];
    // NestJS ValidationPipe returns message as string[] — join for readable output
    if (Array.isArray(b['message']) && b['message'].length > 0) {
      return (b['message'] as string[]).join(', ');
    }
    if (typeof b['error'] === 'string' && b['error']) return b['error'];
  }
  if (typeof body === 'string' && body) return body;
  return `Request failed (${status})`;
}

export async function apiFetch<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T = any
>(
  endpoint: string,
  options: ApiOptions = {},
): Promise<T> {
  const { institutionId, ...rest } = options;

  const { accessToken, user } = getActiveAuthState();
  const tenantId = institutionId ?? user?.institutionId;

  if (!tenantId) {
    throw new Error('Not authenticated. Please log in again.');
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...rest,
    credentials: 'include',
    headers: buildRequestHeaders(rest.headers, tenantId, accessToken, rest.body),
  });

  // On 401: attempt one silent token refresh, then retry
  if (res.status === 401) {
    const refreshResult = await tryRefreshToken();
    if (refreshResult.status === 'success') {
      const retryRes = await fetch(`${BASE_URL}${endpoint}`, {
        ...rest,
        credentials: 'include',
        headers: buildRequestHeaders(
          rest.headers,
          tenantId,
          refreshResult.accessToken,
          rest.body,
        ),
      });
      if (retryRes.ok) {
        return readResponse(retryRes) as Promise<T>;
      }
      if (retryRes.status !== 401) {
        const body = await readResponse(retryRes);
        throw new Error(extractErrorMessage(body, retryRes.status));
      }
    }
    if (refreshResult.status === 'expired') {
      throw new Error('Session expired. Please sign in again.');
    }
    throw new Error('Unable to refresh session. Please try again.');
  }

  if (!res.ok) {
    const body = await readResponse(res);
    throw new Error(extractErrorMessage(body, res.status));
  }

  return readResponse(res) as Promise<T>;
}
