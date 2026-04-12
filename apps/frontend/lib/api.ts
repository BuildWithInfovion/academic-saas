import { useAuthStore } from '@/store/auth.store';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

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

async function tryRefreshToken(institutionId: string): Promise<RefreshResult> {
  const { refreshToken, user, setAuth } = useAuthStore.getState();
  if (!refreshToken || !user?.institutionId) return { status: 'unavailable' };

  if (refreshingPromise) return refreshingPromise;

  refreshingPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Institution-ID': institutionId,
        },
        body: JSON.stringify({ refreshToken }),
      });
      // Only treat a definitive 401 from the refresh endpoint as expired session.
      // Any other failure (network error, 5xx, server restart) silently returns null
      // so the caller can throw a user-visible error without clearing the session.
      if (res.status === 401) {
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') window.location.href = '/';
        return { status: 'expired' };
      }
      if (!res.ok) return { status: 'unavailable' }; // transient error — don't logout
      const data = await res.json();
      setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? refreshToken,
        user: data.user ?? user,
      });
      return { status: 'success', accessToken: data.accessToken as string };
    } catch {
      // Network error (server down/restarting) — don't logout
      return { status: 'unavailable' };
    } finally {
      refreshingPromise = null;
    }
  })();

  return refreshingPromise;
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

export async function apiFetch(
  endpoint: string,
  options: ApiOptions = {},
): Promise<unknown> {
  const { institutionId, ...rest } = options;

  const { accessToken, user } = useAuthStore.getState();
  const tenantId = institutionId || user?.institutionId;

  if (!tenantId) {
    throw new Error('Not authenticated. Please log in again.');
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...rest,
    headers: buildRequestHeaders(rest.headers, tenantId, accessToken, rest.body),
  });

  // On 401: attempt one silent token refresh, then retry
  if (res.status === 401) {
    const refreshResult = await tryRefreshToken(tenantId);
    if (refreshResult.status === 'success') {
      const retryRes = await fetch(`${BASE_URL}${endpoint}`, {
        ...rest,
        headers: buildRequestHeaders(
          rest.headers,
          tenantId,
          refreshResult.accessToken,
          rest.body,
        ),
      });
      if (retryRes.ok) {
        return readResponse(retryRes);
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

  return readResponse(res);
}
