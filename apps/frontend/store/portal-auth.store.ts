import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type User = {
  email: string;
  phone?: string;
  institutionId: string;
  institutionName?: string;
  roles: string[];
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;

  setAuth: (data: {
    accessToken: string;
    refreshToken: string;
    user: User;
  }) => void;

  loadAuth: () => void;
  logout: () => void;
};

/**
 * Portal auth store — used exclusively by portal users (parent, student, teacher, etc.).
 * Stored under a separate localStorage key ("auth-portal") so operator credentials
 * stored in "auth" are never overwritten by a portal login.
 */
export const usePortalAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setAuth: ({ accessToken, refreshToken, user }) => {
        set({ accessToken, refreshToken, user, isAuthenticated: true });
      },

      loadAuth: () => {
        const state = get();
        if (state.accessToken && state.user) {
          set({ isAuthenticated: true });
        }
      },

      logout: () => {
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-portal',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
