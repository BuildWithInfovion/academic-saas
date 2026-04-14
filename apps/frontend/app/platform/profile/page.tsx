'use client';

import { useEffect, useState } from 'react';
import { platformFetch } from '@/lib/platform-api';

interface AdminProfile {
  id: string;
  email: string;
  name: string;
  lastLoginAt: string | null;
  createdAt: string;
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '10+ characters', ok: password.length >= 10 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', ok: /[a-z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
    { label: 'Special character', ok: /[@$!%*?&#^()\-_+=]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const bar = score <= 2 ? 'bg-red-500' : score <= 3 ? 'bg-yellow-500' : score === 4 ? 'bg-blue-500' : 'bg-green-500';
  const label = score <= 2 ? 'Weak' : score <= 3 ? 'Fair' : score === 4 ? 'Good' : 'Strong';

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${(score / 5) * 100}%` }} />
        </div>
        <span className={`text-xs font-medium ${bar.replace('bg-', 'text-')}`}>{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {checks.map((c) => (
          <p key={c.label} className={`text-xs ${c.ok ? 'text-green-400' : 'text-gray-600'}`}>
            {c.ok ? '✓' : '○'} {c.label}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function PlatformProfilePage() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    platformFetch('/platform/auth/me')
      .then((d) => setProfile(d as AdminProfile))
      .catch((e: any) => setLoadError(e.message ?? 'Failed to load profile'));
  }, []);

  const handleChangePassword = async () => {
    setPwError(null);
    setPwSuccess(false);

    if (!currentPassword) return setPwError('Current password is required');
    if (!newPassword) return setPwError('New password is required');
    if (newPassword !== confirmPassword) return setPwError('New passwords do not match');

    setSaving(true);
    try {
      await platformFetch('/platform/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setPwError(e.message ?? 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500';

  if (loadError) return (
    <div className="p-8">
      <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-400 text-sm">{loadError}</div>
    </div>
  );

  if (!profile) return <div className="p-8 text-gray-500 text-sm">Loading profile...</div>;

  return (
    <div className="p-8 max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Profile</h1>
        <p className="text-sm text-gray-400 mt-1">Manage your account and credentials</p>
      </div>

      {/* Account info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Account Details</h2>
        {[
          { label: 'Name', value: profile.name },
          { label: 'Email', value: profile.email },
          {
            label: 'Last Login',
            value: profile.lastLoginAt
              ? new Date(profile.lastLoginAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
              : 'First session',
          },
          {
            label: 'Account Created',
            value: new Date(profile.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }),
          },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-gray-400">{label}</span>
            <span className="text-white">{value}</span>
          </div>
        ))}
      </div>

      {/* Change password */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Change Password</h2>

        {pwSuccess && (
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-green-400 text-sm">
            Password updated successfully.
          </div>
        )}
        {pwError && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm">{pwError}</div>
        )}

        <div>
          <label className="text-xs font-medium text-gray-400 block mb-1">Current Password</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              className={inp}
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={saving}
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
            >
              {showCurrent ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-400 block mb-1">New Password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              className={inp}
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={saving}
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
            >
              {showNew ? 'Hide' : 'Show'}
            </button>
          </div>
          <PasswordStrength password={newPassword} />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-400 block mb-1">Confirm New Password</label>
          <input
            type="password"
            className={`${inp} ${confirmPassword && confirmPassword !== newPassword ? 'border-red-600 focus:ring-red-500' : ''}`}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
            disabled={saving}
          />
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
          )}
        </div>

        <button
          onClick={handleChangePassword}
          disabled={saving || !currentPassword || !newPassword || newPassword !== confirmPassword}
          className="w-full p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Updating...' : 'Update Password'}
        </button>

        <p className="text-xs text-gray-600 text-center">
          New password must be 10+ characters with uppercase, lowercase, number, and special character.
        </p>
      </div>
    </div>
  );
}
