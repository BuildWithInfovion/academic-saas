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

export const useAuthStore = create<AuthState>()(
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
      name: 'auth',
      // sessionStorage is tab-isolated — two different users in two tabs
      // no longer overwrite each other's token. Survives page refresh
      // but resets when the tab is closed (re-login required on new tab).
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
