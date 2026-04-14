import { create } from 'zustand';

type User = {
  email: string;
  phone?: string;
  institutionId: string;
  institutionName?: string;
  roles: string[];
};

type PortalAuthState = {
  accessToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (data: { accessToken: string; user: User }) => void;
  logout: () => void;
};

/**
 * Portal auth store — used exclusively by portal users (parent, student, teacher, etc.).
 * Separate from the dashboard store so operator and portal credentials never clash.
 * No localStorage persistence — the httpOnly refresh-token cookie keeps sessions alive.
 */
export const usePortalAuthStore = create<PortalAuthState>()((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  setAuth: ({ accessToken, user }) =>
    set({ accessToken, user, isAuthenticated: true }),
  logout: () =>
    set({ accessToken: null, user: null, isAuthenticated: false }),
}));
