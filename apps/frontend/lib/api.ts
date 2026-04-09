import { useAuthStore } from '@/store/auth.store';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type ApiOptions = RequestInit & {
  institutionId?: string;
};

// Track in-flight refresh to avoid concurrent refresh storms
let refreshingPromise: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  const { refreshToken, user, setAuth } = useAuthStore.getState();
  if (!refreshToken || !user?.institutionId) return null;

  if (refreshingPromise) return refreshingPromise;

  refreshingPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Institution-ID': user.institutionId,
        },
        body: JSON.stringify({ refreshToken }),
      });
      // Only treat a definitive 401 from the refresh endpoint as expired session.
      // Any other failure (network error, 5xx, server restart) silently returns null
      // so the caller can throw a user-visible error without clearing the session.
      if (res.status === 401) {
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') window.location.href = '/';
        return null;
      }
      if (!res.ok) return null; // transient error — don't logout
      const data = await res.json();
      setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? refreshToken,
        user: data.user ?? user,
      });
      return data.accessToken as string;
    } catch {
      // Network error (server down/restarting) — don't logout
      return null;
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

  const buildHeaders = (token: string | null): HeadersInit => ({
    'Content-Type': 'application/json',
    'X-Institution-ID': tenantId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(rest.headers ?? {}),
  });

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...rest,
    headers: buildHeaders(accessToken),
  });

  // On 401: attempt one silent token refresh, then retry
  if (res.status === 401) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      const retryRes = await fetch(`${BASE_URL}${endpoint}`, {
        ...rest,
        headers: buildHeaders(newToken),
      });
      if (retryRes.ok) {
        return readResponse(retryRes);
      }
      if (retryRes.status !== 401) {
        const body = await readResponse(retryRes);
        throw new Error(extractErrorMessage(body, retryRes.status));
      }
    }
    // Refresh failed (transient) or retry still 401 — refresh fn already handled logout if needed
    throw new Error('Session expired. Please sign in again.');
  }

  if (!res.ok) {
    const body = await readResponse(res);
    throw new Error(extractErrorMessage(body, res.status));
  }

  return readResponse(res);
}
