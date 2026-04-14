'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlatformAuthStore } from '@/store/platform-auth.store';

export default function PlatformLoginPage() {
  const router = useRouter();
  const setAuth = usePlatformAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim()) return setError('Email is required');
    if (!password.trim()) return setError('Password is required');

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/platform/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || 'Login failed');
      }

      const data = await res.json();
      setAuth(data.accessToken, data.admin);
      router.push('/platform/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-[380px] p-8 bg-gray-900 rounded-xl shadow-2xl border border-gray-800 space-y-5">
        <div className="text-center">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-sm">IV</span>
          </div>
          <h1 className="text-xl font-bold text-white">Infovion Platform</h1>
          <p className="text-sm text-gray-400 mt-1">Developer console — restricted access</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">Email</label>
            <input
              type="email"
              placeholder="dev@infovion.in"
              className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              disabled={loading}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              disabled={loading}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Signing in...' : 'Sign In to Platform'}
        </button>
      </div>
    </div>
  );
}
