import { createAuthStore } from './create-auth-store';

export type { AuthUser, AuthState } from './create-auth-store';

// Operator dashboard store — persisted to sessionStorage (per-tab, cleared on close).
// Keeps the operator session isolated from portal users who share auth_rt cookies.
// Access token is short-lived; the httpOnly auth_rt_op cookie handles silent refresh.
export const useAuthStore = createAuthStore('auth-op');
