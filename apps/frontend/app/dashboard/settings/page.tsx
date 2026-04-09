'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface ResetRequest {
  id: string;
  createdAt: string;
  user: { id: string; email?: string; phone?: string };
}

interface ApproveResult {
  newPassword: string;
}

export default function OperatorSettingsPage() {
  const user = useAuthStore((s) => s.user);

  // Change password
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  // Reset requests
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [approvedResult, setApprovedResult] = useState<{ id: string; newPassword: string } | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const res = await apiFetch('/auth/password-resets');
      setRequests(Array.isArray(res) ? res : []);
    } catch {
      setRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleChangePassword = async () => {
    setPwError(null);
    if (!oldPassword.trim()) return setPwError('Current password is required');
    if (!newPassword.trim()) return setPwError('New password is required');
    if (newPassword.length < 6) return setPwError('New password must be at least 6 characters');
    if (newPassword !== confirmPassword) return setPwError('New passwords do not match');

    setSaving(true);
    try {
      await apiFetch('/users/me/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setPwSuccess('Password changed successfully');
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => setPwSuccess(null), 4000);
    } catch (e: any) {
      setPwError(e.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (reqId: string) => {
    setActioning(reqId);
    try {
      const res: ApproveResult = await apiFetch(`/auth/password-resets/${reqId}/approve`, {
        method: 'POST',
      });
      setApprovedResult({ id: reqId, newPassword: res.newPassword });
      await fetchRequests();
    } catch (e: any) {
      alert(e.message || 'Failed to approve request');
    } finally {
      setActioning(null);
    }
  };

  const handleReject = async (reqId: string) => {
    if (!confirm('Reject this password reset request?')) return;
    setActioning(reqId);
    try {
      await apiFetch(`/auth/password-resets/${reqId}/reject`, { method: 'POST' });
      await fetchRequests();
    } catch (e: any) {
      alert(e.message || 'Failed to reject request');
    } finally {
      setActioning(null);
    }
  };

  const inp = 'w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black';

  return (
    <div className="p-8 max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Settings</h1>
        <p className="text-sm text-gray-400">Manage your account and pending requests</p>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Account</h2>
        <div className="space-y-0 text-sm divide-y divide-gray-50">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-800 font-medium">{user?.email ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-gray-500">Role</span>
            <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-medium">Operator</span>
          </div>
        </div>
      </div>

      {/* Password Reset Requests */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Password Reset Requests</h2>
            <p className="text-xs text-gray-400 mt-0.5">Parents/staff who cannot log in</p>
          </div>
          {requests.length > 0 && (
            <span className="bg-red-100 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-full">
              {requests.length} pending
            </span>
          )}
        </div>

        {/* Approved result banner */}
        {approvedResult && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wider">
              New Password Set — Share with user
            </p>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">Temporary Password</span>
              <span className="font-mono font-bold text-indigo-700 text-base tracking-widest">
                {approvedResult.newPassword}
              </span>
            </div>
            <p className="text-xs text-green-600 mt-2">
              Share this password with the user. They should change it after login.
            </p>
            <button
              onClick={() => setApprovedResult(null)}
              className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {loadingRequests ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : requests.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400">No pending requests</p>
            <p className="text-xs text-gray-300 mt-1">Requests appear here when users click &quot;Forgot password?&quot;</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {req.user.phone ?? req.user.email ?? req.user.id}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Requested {new Date(req.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={actioning === req.id}
                    className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={actioning === req.id}
                    className="px-3 py-1.5 text-xs bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                  >
                    {actioning === req.id ? '...' : 'Set New Password'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Change Your Password</h2>

        {pwError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{pwError}</div>
        )}
        {pwSuccess && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">{pwSuccess}</div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Current Password</label>
            <input type="password" className={inp} placeholder="Enter current password"
              value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">New Password</label>
            <input type="password" className={inp} placeholder="At least 6 characters"
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Confirm New Password</label>
            <input type="password" className={inp} placeholder="Repeat new password"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>

        <button
          onClick={handleChangePassword}
          disabled={saving}
          className="mt-5 px-5 py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Update Password'}
        </button>
      </div>
    </div>
  );
}
