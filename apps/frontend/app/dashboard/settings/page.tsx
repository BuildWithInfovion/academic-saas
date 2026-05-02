'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { TotpSetupCard } from '@/components/totp-setup-card';
import { validatePassword, checkPasswordStrength } from '@/lib/password-utils';

interface Director {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface ResetRequest {
  id: string;
  createdAt: string;
  user: { id: string; email?: string; phone?: string };
}

interface ApproveResult {
  newPassword: string;
}

export default function OperatorSettingsPage() {
  const user    = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const token   = useAuthStore((s) => s.accessToken);

  // Profile
  const [profileName,  setProfileName]  = useState(user?.name  ?? '');
  const [profilePhone, setProfilePhone] = useState(user?.phone ?? '');
  const [profileSaving,  setProfileSaving]  = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const saveProfile = async () => {
    setProfileSaving(true); setProfileMsg(null);
    try {
      const updated = await apiFetch<{ id: string; name: string | null; phone: string | null }>(
        '/users/me/profile',
        { method: 'PATCH', body: JSON.stringify({ name: profileName.trim(), phone: profilePhone.trim() }) },
      );
      if (user && token) {
        setAuth({ accessToken: token, user: { ...user, name: updated.name ?? null, phone: updated.phone ?? undefined } });
      }
      setProfileMsg({ ok: true, text: 'Profile saved.' });
      setTimeout(() => setProfileMsg(null), 3000);
    } catch (e: unknown) {
      setProfileMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed to save.' });
    } finally {
      setProfileSaving(false);
    }
  };

  // Change password
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  // Director account
  const [directors,       setDirectors]       = useState<Director[]>([]);
  const [dirLoading,      setDirLoading]      = useState(true);
  const [showDirForm,     setShowDirForm]     = useState(false);
  const [dirName,         setDirName]         = useState('');
  const [dirEmail,        setDirEmail]        = useState('');
  const [dirPhone,        setDirPhone]        = useState('');
  const [dirPassword,     setDirPassword]     = useState('');
  const [dirSaving,       setDirSaving]       = useState(false);
  const [dirError,        setDirError]        = useState<string | null>(null);
  const [dirCreated,      setDirCreated]      = useState<{ name: string | null; email: string | null; phone: string | null; password: string } | null>(null);

  const fetchDirectors = useCallback(async () => {
    setDirLoading(true);
    try {
      const res = await apiFetch<Director[]>('/users/director');
      setDirectors(Array.isArray(res) ? res : []);
    } catch {
      setDirectors([]);
    } finally {
      setDirLoading(false);
    }
  }, []);

  useEffect(() => { fetchDirectors(); }, [fetchDirectors]);

  const handleCreateDirector = async () => {
    setDirError(null);
    if (!dirEmail.trim() && !dirPhone.trim()) return setDirError('Email or phone is required');
    if (!dirPassword.trim()) return setDirError('Password is required');
    const pwErr = validatePassword(dirPassword);
    if (pwErr) return setDirError(pwErr);
    setDirSaving(true);
    try {
      await apiFetch('/users/director', {
        method: 'POST',
        body: JSON.stringify({
          name: dirName.trim() || undefined,
          email: dirEmail.trim() || undefined,
          phone: dirPhone.trim() || undefined,
          password: dirPassword,
        }),
      });
      setDirCreated({ name: dirName.trim() || null, email: dirEmail.trim() || null, phone: dirPhone.trim() || null, password: dirPassword });
      setDirName(''); setDirEmail(''); setDirPhone(''); setDirPassword('');
      setShowDirForm(false);
      await fetchDirectors();
    } catch (e: unknown) {
      setDirError(e instanceof Error ? e.message : 'Failed to create director');
    } finally {
      setDirSaving(false);
    }
  };

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
    const pwErr = validatePassword(newPassword);
    if (pwErr) return setPwError(pwErr);
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

  const inp = 'w-full p-2.5 border border-ds-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand';

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ds-text1 mb-1">Settings</h1>
        <p className="text-sm text-ds-text3">Manage your account and pending requests</p>
      </div>

      {/* Profile */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6">
        <h2 className="text-sm font-semibold text-ds-text1 mb-4">Profile</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Full Name</label>
            <input
              id="settings-name"
              name="name"
              type="text"
              className={inp}
              placeholder="e.g. Vrushali Sharma"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Login Email (cannot change)</label>
            <input type="text" className={inp} value={user?.email ?? '—'} readOnly
              style={{ opacity: 0.6, cursor: 'not-allowed' }} />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Phone</label>
            <input
              id="settings-phone"
              name="phone"
              type="text"
              className={inp}
              placeholder="+91 98765 43210"
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
            />
          </div>
        </div>

        {profileMsg && (
          <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${profileMsg.ok
            ? 'bg-ds-success-bg text-ds-success-text border border-ds-success-border'
            : 'bg-ds-error-bg text-ds-error-text border border-ds-error-border'}`}>
            {profileMsg.text}
          </div>
        )}

        <button
          onClick={saveProfile}
          disabled={profileSaving}
          className="mt-5 px-5 py-2.5 btn-brand rounded-lg disabled:opacity-50 transition-colors"
        >
          {profileSaving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>

      {/* Account Info */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6">
        <h2 className="text-sm font-semibold text-ds-text1 mb-4">Account</h2>
        <div className="space-y-0 text-sm divide-y divide-ds-border">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-ds-text2">Email</span>
            <span className="text-ds-text1 font-medium">{user?.email ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-ds-text2">Role</span>
            <span className="bg-ds-info-bg text-ds-info-text px-2.5 py-0.5 rounded-full text-xs font-medium">Operator</span>
          </div>
        </div>
      </div>

      {/* Director Account */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-ds-text1">Director Account</h2>
            <p className="text-xs text-ds-text3 mt-0.5">Read-only oversight login for the school director</p>
          </div>
          {!showDirForm && (
            <button
              onClick={() => { setShowDirForm(true); setDirError(null); setDirCreated(null); }}
              className="btn-brand px-3 py-1.5 rounded-lg text-xs"
            >
              + Create Director
            </button>
          )}
        </div>

        {/* Success credentials banner */}
        {dirCreated && (
          <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-xl p-4">
            <p className="text-xs font-semibold text-ds-success-text mb-3 uppercase tracking-wider">
              Director Account Created — Share credentials securely
            </p>
            <div className="space-y-1.5 text-sm">
              {dirCreated.name  && <div className="flex justify-between"><span className="text-ds-text2">Name</span><span className="font-medium text-ds-text1">{dirCreated.name}</span></div>}
              {dirCreated.email && <div className="flex justify-between"><span className="text-ds-text2">Email</span><span className="font-medium text-ds-text1">{dirCreated.email}</span></div>}
              {dirCreated.phone && <div className="flex justify-between"><span className="text-ds-text2">Phone</span><span className="font-medium text-ds-text1">{dirCreated.phone}</span></div>}
              <div className="flex justify-between"><span className="text-ds-text2">Password</span><span className="font-mono font-bold text-ds-text1 tracking-widest">{dirCreated.password}</span></div>
            </div>
            <p className="text-xs text-ds-success-text mt-3">Credentials shown only once. Director should change password after first login.</p>
            <button onClick={() => setDirCreated(null)} className="mt-2 text-xs text-ds-text3 hover:text-ds-text2 underline">Dismiss</button>
          </div>
        )}

        {/* Existing directors list */}
        {dirLoading ? (
          <p className="text-sm text-ds-text3">Loading…</p>
        ) : directors.length === 0 && !showDirForm ? (
          <div className="text-center py-6 border border-dashed border-ds-border rounded-lg">
            <p className="text-sm text-ds-text3">No director account yet</p>
            <p className="text-xs text-ds-text3 mt-1">Create one to give the school director read-only access</p>
          </div>
        ) : directors.length > 0 ? (
          <div className="divide-y divide-ds-border mb-4">
            {directors.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-ds-text1">{d.name ?? '(No name)'}</p>
                  <p className="text-xs text-ds-text3">{d.email ?? d.phone ?? '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {d.lastLoginAt ? (
                    <span className="text-xs text-ds-text3">
                      Last login {new Date(d.lastLoginAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  ) : (
                    <span className="text-xs text-ds-text3">Never logged in</span>
                  )}
                  <span className="bg-ds-info-bg text-ds-info-text px-2 py-0.5 rounded-full text-xs font-medium">Director</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Create form */}
        {showDirForm && (
          <div className="border border-ds-border rounded-xl p-4 space-y-3 mt-2">
            <p className="text-xs font-semibold text-ds-text2 uppercase tracking-wider">New Director Account</p>

            {dirError && (
              <div className="bg-ds-error-bg border border-ds-error-border rounded-lg px-3 py-2 text-ds-error-text text-xs">{dirError}</div>
            )}

            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Full Name <span className="text-ds-text3">(optional)</span></label>
              <input className={inp} type="text" placeholder="e.g. Ramesh Sharma" value={dirName} onChange={(e) => setDirName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Email <span className="text-ds-text3">(required if no phone)</span></label>
              <input className={inp} type="email" placeholder="director@school.com" value={dirEmail} onChange={(e) => setDirEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Phone <span className="text-ds-text3">(required if no email)</span></label>
              <input className={inp} type="text" placeholder="10-digit mobile" value={dirPhone} onChange={(e) => setDirPhone(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Password</label>
              <input className={inp} type="password" placeholder="Min 8 chars, uppercase + number" value={dirPassword} onChange={(e) => setDirPassword(e.target.value)} />
              {dirPassword && (() => {
                const s = checkPasswordStrength(dirPassword);
                return (
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {([['minLength', '8+ characters'], ['hasUppercase', 'Uppercase'], ['hasLowercase', 'Lowercase'], ['hasNumber', 'Number']] as const).map(([k, label]) => (
                      <span key={k} className={`text-xs flex items-center gap-1 ${s[k] ? 'text-ds-success-text' : 'text-ds-text3'}`}>
                        {s[k] ? '✓' : '○'} {label}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCreateDirector}
                disabled={dirSaving}
                className="btn-brand px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {dirSaving ? 'Creating…' : 'Create Director'}
              </button>
              <button
                onClick={() => { setShowDirForm(false); setDirError(null); setDirName(''); setDirEmail(''); setDirPhone(''); setDirPassword(''); }}
                className="px-4 py-2 rounded-lg text-sm border border-ds-border text-ds-text2 hover:bg-ds-bg2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Password Reset Requests */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-ds-text1">Password Reset Requests</h2>
            <p className="text-xs text-ds-text3 mt-0.5">Parents/staff who cannot log in</p>
          </div>
          {requests.length > 0 && (
            <span className="bg-ds-error-bg text-ds-error-text text-xs font-semibold px-2.5 py-1 rounded-full">
              {requests.length} pending
            </span>
          )}
        </div>

        {/* Approved result banner */}
        {approvedResult && (
          <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-xl p-4">
            <p className="text-xs font-semibold text-ds-success-text mb-2 uppercase tracking-wider">
              New Password Set — Share with user
            </p>
            <div className="flex items-center justify-between">
              <span className="text-ds-text2 text-sm">Temporary Password</span>
              <span className="font-mono font-bold text-indigo-700 text-base tracking-widest">
                {approvedResult.newPassword}
              </span>
            </div>
            <p className="text-xs text-ds-success-text mt-2">
              Share this password with the user. They should change it after login.
            </p>
            <button
              onClick={() => setApprovedResult(null)}
              className="mt-3 text-xs text-ds-text3 hover:text-ds-text2 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {loadingRequests ? (
          <p className="text-sm text-ds-text3">Loading...</p>
        ) : requests.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-ds-text3">No pending requests</p>
            <p className="text-xs text-ds-text3 mt-1">Requests appear here when users click &quot;Forgot password?&quot;</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between bg-ds-bg2 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ds-text1">
                    {req.user.phone ?? req.user.email ?? req.user.id}
                  </p>
                  <p className="text-xs text-ds-text3 mt-0.5">
                    Requested {new Date(req.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={actioning === req.id}
                    className="px-3 py-1.5 text-xs border border-ds-border-strong text-ds-text2 rounded-lg hover:bg-ds-bg2 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={actioning === req.id}
                    className="btn-brand px-3 py-1.5 rounded-lg text-xs"
                  >
                    {actioning === req.id ? '...' : 'Set New Password'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Two-Factor Authentication */}
      <TotpSetupCard />

      {/* Change Password */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6">
        <h2 className="text-sm font-semibold text-ds-text1 mb-4">Change Your Password</h2>

        {pwError && (
          <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{pwError}</div>
        )}
        {pwSuccess && (
          <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{pwSuccess}</div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Current Password</label>
            <input type="password" className={inp} placeholder="Enter current password"
              value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">New Password</label>
            <input type="password" className={inp} placeholder="At least 8 characters"
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            {newPassword && (() => {
              const s = checkPasswordStrength(newPassword);
              return (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {([['minLength', '8+ characters'], ['hasUppercase', 'Uppercase letter'], ['hasLowercase', 'Lowercase letter'], ['hasNumber', 'Number']] as const).map(([k, label]) => (
                    <span key={k} className={`text-xs flex items-center gap-1 ${s[k] ? 'text-ds-success-text' : 'text-ds-text3'}`}>
                      {s[k] ? '✓' : '○'} {label}
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Confirm New Password</label>
            <input type="password" className={inp} placeholder="Repeat new password"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>

        <button
          onClick={handleChangePassword}
          disabled={saving}
          className="mt-5 px-5 py-2.5 btn-brand rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Update Password'}
        </button>
      </div>
    </div>
  );
}
