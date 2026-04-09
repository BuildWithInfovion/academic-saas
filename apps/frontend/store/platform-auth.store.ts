import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type PlatformAdmin = {
  id: string;
  email: string;
  name: string;
};

type PlatformAuthState = {
  platformToken: string | null;
  admin: PlatformAdmin | null;
  setAuth: (token: string, admin: PlatformAdmin) => void;
  logout: () => void;
};

export const usePlatformAuthStore = create<PlatformAuthState>()(
  persist(
    (set) => ({
      platformToken: null,
      admin: null,
      setAuth: (token, admin) => set({ platformToken: token, admin }),
      logout: () => set({ platformToken: null, admin: null }),
    }),
    {
      name: 'platform-auth',
      partialize: (state) => ({
        platformToken: state.platformToken,
        admin: state.admin,
      }),
    },
  ),
);
