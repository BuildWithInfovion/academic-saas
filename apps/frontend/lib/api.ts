import { useAuthStore } from '@/store/auth.store';
import { usePortalAuthStore } from '@/store/portal-auth.store';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// Only 'admin' (Operator) uses the dashboard store.
// 'super_admin' (Director) is a portal user and goes to usePortalAuthStore.
const DASHBOARD_ROLES = ['admin'];

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

// Track in-flight refresh to avoid concurrent refresh storms
let refreshingPromise: Promise<RefreshResult> | null = null;

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

/**
 * Silently refresh the access token using the httpOnly auth_rt cookie.
 * No body token needed — the browser sends the cookie automatically.
 * Used inside apiFetch on 401, and exported for layout-level session restore.
 */
async function tryRefreshToken(): Promise<RefreshResult> {
  const { user, setAuth } = getActiveAuthState();

  if (refreshingPromise) return refreshingPromise;

  refreshingPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      // A definitive 401 from the refresh endpoint means the cookie is invalid/expired.
      // Any other failure (network, 5xx) is transient — don't clear the session.
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
      setAuth({
        accessToken: data.accessToken,
        user: (data.user as Parameters<typeof setAuth>[0]['user']) ?? user!,
      });
      return { status: 'success', accessToken: data.accessToken };
    } catch {
      return { status: 'unavailable' };
    } finally {
      refreshingPromise = null;
    }
  })();

  return refreshingPromise;
}

/**
 * Restore the in-memory session on page load by calling the refresh endpoint.
 * The httpOnly auth_rt cookie is sent automatically — no institutionId needed.
 * Returns true if the session was successfully restored.
 */
export async function silentRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      accessToken: string;
      user: { roles?: string[] } & Record<string, unknown>;
    };
    if (!data.user) return false;

    const roles: string[] = data.user.roles ?? [];
    const isDashboard = roles.some((r) => DASHBOARD_ROLES.includes(r));
    const user = data.user as Parameters<
      ReturnType<typeof useAuthStore.getState>['setAuth']
    >[0]['user'];

    if (isDashboard) {
      useAuthStore.getState().setAuth({ accessToken: data.accessToken, user });
    } else {
      usePortalAuthStore
        .getState()
        .setAuth({ accessToken: data.accessToken, user });
    }
    return true;
  } catch {
    return false;
  }
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
