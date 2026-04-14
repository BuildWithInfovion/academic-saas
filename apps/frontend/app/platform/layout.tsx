'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { usePlatformAuthStore } from '@/store/platform-auth.store';

const NAV = [
  { label: 'Dashboard', path: '/platform/dashboard', icon: '◈' },
  { label: 'Clients', path: '/platform/clients', icon: '◉' },
  { label: 'Profile', path: '/platform/profile', icon: '◎' },
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { admin, platformToken, logout, _hasHydrated } = usePlatformAuthStore();

  // Don't protect the login page
  const isLoginPage = pathname === '/platform/login';

  useEffect(() => {
    // Wait until Zustand has rehydrated from localStorage before deciding.
    // Without this guard, the layout redirects on every page load because
    // platformToken is null during the first render cycle (before hydration).
    if (!_hasHydrated) return;
    if (!isLoginPage && !platformToken) {
      router.replace('/platform/login');
    }
  }, [_hasHydrated, isLoginPage, platformToken, router]);

  if (isLoginPage) return <>{children}</>;
  // Still reading from localStorage — render nothing to avoid flash
  if (!_hasHydrated) return null;
  if (!platformToken) return null;

  const handleLogout = () => {
    logout();
    router.push('/platform/login');
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">IV</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Infovion</p>
              <p className="text-xs text-gray-400">Platform Console</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-indigo-600/20 text-indigo-300 font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-1">
          <p className="text-xs font-medium text-gray-300 truncate">{admin?.name}</p>
          <p className="text-xs text-gray-600 truncate">{admin?.email}</p>
          <button
            onClick={handleLogout}
            className="w-full text-xs text-gray-500 hover:text-red-400 transition-colors text-left pt-1"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-950">
        {children}
      </main>
    </div>
  );
}
