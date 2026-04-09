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

export async function platformFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<unknown> {
  const { platformToken, logout } = usePlatformAuthStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (platformToken) {
    headers['Authorization'] = `Bearer ${platformToken}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });

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
