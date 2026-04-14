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

/**
 * Restore the platform admin session on page load by calling GET /platform/auth/me.
 * The httpOnly platform_rt cookie is sent automatically by the browser.
 * PlatformGuard reads the cookie — no Authorization header needed.
 * Returns true if the session was successfully restored.
 */
export async function silentPlatformRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/platform/auth/me`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const admin = await res.json() as { id: string; email: string; name: string };
    if (!admin?.id) return false;
    // Store admin info; subsequent API calls use the httpOnly cookie via credentials: 'include'
    usePlatformAuthStore.getState().setAuth('', admin);
    return true;
  } catch {
    return false;
  }
}

export async function platformFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<unknown> {
  const { platformToken, logout } = usePlatformAuthStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Send the in-memory token if available (just-logged-in case).
  // On page reload the token is gone but the httpOnly cookie is sent
  // automatically via credentials: 'include' — PlatformGuard reads it.
  if (platformToken) {
    headers['Authorization'] = `Bearer ${platformToken}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (res.status === 401) {
    logout();
    if (typeof window !== 'undefined') window.location.href = '/platform/login';
    throw new Error('Session expired. Please sign in again.');
  }

  if (!res.ok) {
    const body = await readResponse(res);
    throw new Error(extractErrorMessage(body, res.status));
  }

  return readResponse(res);
}
