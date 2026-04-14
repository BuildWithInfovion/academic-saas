import { create } from 'zustand';

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

/**
 * Platform auth store — no localStorage persistence.
 * The httpOnly `platform_rt` cookie keeps sessions alive across page reloads.
 * The token lives in-memory only; Next.js middleware guards routes via the cookie.
 */
export const usePlatformAuthStore = create<PlatformAuthState>()((set) => ({
  platformToken: null,
  admin: null,
  setAuth: (token, admin) => set({ platformToken: token, admin }),
  logout: () => set({ platformToken: null, admin: null }),
}));
