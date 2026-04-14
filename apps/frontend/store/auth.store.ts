import { create } from 'zustand';

type User = {
  email: string;
  phone?: string;
  institutionId: string;
  institutionName?: string;
  roles: string[];
};

type AuthState = {
  accessToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (data: { accessToken: string; user: User }) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  setAuth: ({ accessToken, user }) =>
    set({ accessToken, user, isAuthenticated: true }),
  logout: () =>
    set({ accessToken: null, user: null, isAuthenticated: false }),
}));
