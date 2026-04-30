import { createAuthStore } from './create-auth-store';

export type { AuthUser, AuthState } from './create-auth-store';

// Portal auth store — persisted to sessionStorage (per-tab, cleared on close).
// Separate from the operator store so parent/teacher sessions never collide with
// the operator's auth_rt_op cookie. Each tab has independent sessionStorage.
export const usePortalAuthStore = createAuthStore('auth-portal');
