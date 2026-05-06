import { usePlatformAuthStore } from '@/store/platform-auth.store';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function readResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function extractErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b['message'] === 'string' && b['message']) return b['message'];
  }
  if (typeof body === 'string' && body) return body;
  return `Request failed (${status})`;
}

async function fetchWithTimeout(input: RequestInfo, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Restore the platform admin session on page load.
 * Returns 'ok' | 'expired' | 'error' — callers must handle all three:
 *   'ok'      → session valid, proceed
 *   'expired' → cookie gone/invalid, redirect to login
 *   'error'   → network/server issue, show retry UI (do NOT redirect to login)
 */
export async function silentPlatformRefresh(): Promise<'ok' | 'expired' | 'error'> {
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/platform/auth/me`,
      { method: 'GET', credentials: 'include' },
      15_000,
    );
    if (res.status === 401 || res.status === 403) return 'expired';
    if (!res.ok) return 'error';
    const admin = await res.json() as { id: string; email: string; name: string };
    if (!admin?.id) return 'error';
    usePlatformAuthStore.getState().setAuth('', admin);
    return 'ok';
  } catch {
    return 'error';
  }
}

export async function platformFetch(
  endpoint: string,
  options: RequestInit & { silent?: boolean } = {},
): Promise<unknown> {
  const { platformToken, logout } = usePlatformAuthStore.getState();
  const { silent, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  // Send the in-memory token if available (just-logged-in case).
  // On page reload the token is gone but the httpOnly cookie is sent
  // automatically via credentials: 'include' — PlatformGuard reads it.
  if (platformToken) {
    headers['Authorization'] = `Bearer ${platformToken}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...fetchOptions,
    credentials: 'include',
    headers,
  });

  if (res.status === 401) {
    // Background/polling callers pass silent:true so a transient 401 (e.g. cold-start
    // timing, single-session invalidation from another device) doesn't kick the user
    // out mid-session. Only user-initiated calls should trigger the hard redirect.
    if (!silent) {
      logout();
      if (typeof window !== 'undefined') window.location.href = '/platform/login';
    }
    throw new Error('Session expired. Please sign in again.');
  }

  if (!res.ok) {
    const body = await readResponse(res);
    throw new Error(extractErrorMessage(body, res.status));
  }

  return readResponse(res);
}
