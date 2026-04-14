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
  _hasHydrated: boolean;
  setAuth: (token: string, admin: PlatformAdmin) => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
};

export const usePlatformAuthStore = create<PlatformAuthState>()(
  persist(
    (set) => ({
      platformToken: null,
      admin: null,
      _hasHydrated: false,
      setAuth: (token, admin) => set({ platformToken: token, admin }),
      logout: () => set({ platformToken: null, admin: null }),
      setHasHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: 'platform-auth',
      partialize: (state) => ({
        platformToken: state.platformToken,
        admin: state.admin,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
