import { useAuthStore } from '@/store/auth.store';
import { usePortalAuthStore } from '@/store/portal-auth.store';
import { DASHBOARD_ROLES } from '@/lib/auth-utils';

export class ApiError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export const BASE_URL = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_API_URL is not set in production build');
    }
    return 'http://localhost:3000';
  }
  return url;
})();

/** Build a full API URL for pre-auth fetch calls (login, password reset, etc.) */
export const apiUrl = (path: string) => `${BASE_URL}${path}`;

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

// --- Response cache for GET requests ---
interface CacheEntry { data: unknown; expiresAt: number; }
const responseCache = new Map<string, CacheEntry>();
// Deduplicates concurrent identical GET requests — only one network call fires
// even if three components mount simultaneously and request the same endpoint.
const inFlightGets = new Map<string, Promise<unknown>>();

// These paths are stable within a session (academic calendar, class list,
// institution profile, subject master). Cache them for 5 minutes so navigating
// between pages doesn't re-hit the DB for data that hasn't changed.
const STATIC_PREFIXES = ['/academic/years', '/academic/units', '/institution/me', '/subjects'];
const STATIC_TTL = 5 * 60_000;

function makeCacheKey(tenantId: string, endpoint: string) { return `${tenantId}\0${endpoint}`; }
function isStaticEndpoint(endpoint: string) {
  return STATIC_PREFIXES.some((p) => endpoint.startsWith(p));
}

/** Bust cached entries whose endpoint starts with pathPrefix. Call after a mutation. */
export function clearApiCache(pathPrefix?: string): void {
  if (!pathPrefix) { responseCache.clear(); return; }
  for (const k of responseCache.keys()) {
    if ((k.split('\0')[1] ?? '').startsWith(pathPrefix)) responseCache.delete(k);
  }
}

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

// Wraps fetch with an AbortController timeout so cold-starting backends
// (e.g. Render free tier, ~60-90 s spin-up) don't hang the browser indefinitely.
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

async function doRefresh(endpoint: string): Promise<RefreshResult> {
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}${endpoint}`,
      {
        method: 'POST',
        credentials: 'include',
        body: '{}',
        headers: { 'Content-Type': 'application/json' },
      },
      15_000,
    );
    if (res.status === 401) {
      getActiveAuthState().logout();
      if (typeof window !== 'undefined') window.location.href = '/';
      return { status: 'expired' };
    }
    if (!res.ok) return { status: 'unavailable' };
    const data = (await res.json()) as {
      accessToken: string;
      user?: { roles?: string[]; email?: string } & Record<string, unknown>;
    };
    const roles: string[] = data.user?.roles ?? [];
    const isDashboard = roles.some((r) => DASHBOARD_ROLES.includes(r));
    const store = isDashboard ? useAuthStore.getState() : usePortalAuthStore.getState();

    // Tab-collision guard: if this tab already has a different user's session
    // (caused by a shared auth_rt cookie being overwritten by another tab's login),
    // reject the refresh rather than silently replacing this tab's identity.
    const thisTabUser = store.user;
    if (thisTabUser && data.user?.email && data.user.email !== thisTabUser.email) {
      store.logout();
      if (typeof window !== 'undefined') window.location.href = '/';
      return { status: 'expired' };
    }

    // Guard: if backend returned a non-null user, use it. If the field is absent
    // (undefined), fall back to the cached user. Never fall back to stale data
    // when the server explicitly returned null — that indicates a server-side error.
    const freshUser = data.user as Parameters<typeof store.setAuth>[0]['user'] | null | undefined;
    if (freshUser === null) return { status: 'unavailable' };
    store.setAuth({
      accessToken: data.accessToken,
      user: freshUser ?? store.user!,
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
  // Use the portal store if it has an active session (portal users: teacher,
  // parent, principal, etc.). Only fall back to the operator endpoint when
  // the portal store is empty, meaning this is an operator/dashboard session.
  const isPortal = !!usePortalAuthStore.getState().user;
  const isOperator = !isPortal;
  const endpoint = isPortal ? '/auth/refresh' : '/auth/refresh-op';

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
      const res = await fetchWithTimeout(
        `${BASE_URL}/auth/refresh-op`,
        {
          method: 'POST',
          credentials: 'include',
          body: '{}',
          headers: { 'Content-Type': 'application/json' },
        },
        15_000,
      );

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
      const res = await fetchWithTimeout(
        `${BASE_URL}/auth/refresh`,
        {
          method: 'POST',
          credentials: 'include',
          body: '{}',
          headers: { 'Content-Type': 'application/json' },
        },
        15_000,
      );

      if (res.status === 401) return 'expired';
      if (!res.ok) {
        console.warn('[silentRefresh] refresh failed with status', res.status);
        return 'error';
      }

      const data = (await res.json()) as {
        accessToken: string;
        user: { roles?: string[]; email?: string } & Record<string, unknown>;
      };
      if (!data.user) return 'error';

      const roles: string[] = data.user.roles ?? [];
      const isDashboard = roles.some((r) => DASHBOARD_ROLES.includes(r));
      const user = data.user as Parameters<
        ReturnType<typeof useAuthStore.getState>['setAuth']
      >[0]['user'];

      // Tab-collision guard: the auth_rt cookie is shared across all browser tabs.
      // If another tab logged in as a different user, the cookie now belongs to
      // them. Detect this by comparing email — if the returned user doesn't match
      // who this tab thinks it is, treat it as session-expired and force re-login
      // rather than silently hijacking this tab's identity.
      const thisTabUser = usePortalAuthStore.getState().user;
      if (thisTabUser && data.user.email && data.user.email !== thisTabUser.email) {
        usePortalAuthStore.getState().logout();
        return 'expired';
      }

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

  const isGet = !rest.method || rest.method.toUpperCase() === 'GET';
  const key = makeCacheKey(tenantId, endpoint);

  // Return from TTL cache for known-static paths (academic years, units, institution, subjects).
  if (isGet && isStaticEndpoint(endpoint)) {
    const hit = responseCache.get(key);
    if (hit && Date.now() < hit.expiresAt) return hit.data as T;
  }

  // Deduplicate concurrent identical GET requests: if 3 components mount and all
  // call apiFetch('/academic/years') at once, only 1 network request fires.
  if (isGet) {
    const existing = inFlightGets.get(key);
    if (existing) return existing as Promise<T>;
  }

  const execute = async (): Promise<T> => {
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
          const data = (await readResponse(retryRes)) as T;
          if (isGet && isStaticEndpoint(endpoint)) {
            responseCache.set(key, { data, expiresAt: Date.now() + STATIC_TTL });
          }
          return data;
        }
        if (retryRes.status !== 401) {
          const body = await readResponse(retryRes);
          throw new ApiError(extractErrorMessage(body, retryRes.status), retryRes.status);
        }
      }
      if (refreshResult.status === 'expired') {
        throw new ApiError('Session expired. Please sign in again.', 401);
      }
      throw new ApiError('Unable to refresh session. Please try again.', 503);
    }

    if (!res.ok) {
      const body = await readResponse(res);
      throw new ApiError(extractErrorMessage(body, res.status), res.status);
    }

    const data = (await readResponse(res)) as T;
    if (isGet && isStaticEndpoint(endpoint)) {
      responseCache.set(key, { data, expiresAt: Date.now() + STATIC_TTL });
    }
    return data;
  };

  if (!isGet) return execute();

  const promise = execute().finally(() => inFlightGets.delete(key));
  inFlightGets.set(key, promise);
  return promise;
}
