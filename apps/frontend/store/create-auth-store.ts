import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AuthUser = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  institutionId: string;
  institutionName?: string | null;
  roles: string[];
  permissions?: string[];
};

export type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuth: (data: { accessToken: string; user: AuthUser }) => void;
  logout: () => void;
};

export function createAuthStore(storageKey: string) {
  return create<AuthState>()(
    persist(
      (set) => ({
        accessToken: null,
        user: null,
        isAuthenticated: false,
        setAuth: ({ accessToken, user }) =>
          set({ accessToken, user, isAuthenticated: true }),
        logout: () =>
          set({ accessToken: null, user: null, isAuthenticated: false }),
      }),
      {
        name: storageKey,
        storage: createJSONStorage(() =>
          typeof window !== 'undefined' ? sessionStorage : localStorage,
        ),
        partialize: (state) => ({
          accessToken: state.accessToken,
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      },
    ),
  );
}
