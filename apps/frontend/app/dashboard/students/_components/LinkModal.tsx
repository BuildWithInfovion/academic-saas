'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import type { Student } from '@/lib/types';

export function LinkModal({ student, onClose, onSuccess }: {
  student: Student | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [linkType, setLinkType] = useState<'student' | 'parent'>('parent');
  const [linkSearch, setLinkSearch] = useState('');
  const [linkUserId, setLinkUserId] = useState('');
  const [foundUser, setFoundUser] = useState<{ id: string; email?: string; phone?: string } | null | 'not_found'>(null);
  const [searchingUser, setSearchingUser] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!student) return;
    setLinkType('parent');
    setLinkUserId('');
    setFoundUser(null);
    setError(null);
    const preSearch = student.parentPhone || '';
    setLinkSearch(preSearch);
    if (preSearch) void searchByIdentifier(preSearch);
  }, [student]);

  const searchByIdentifier = async (identifier: string) => {
    if (!identifier.trim()) return;
    setSearchingUser(true);
    setFoundUser(null);
    setLinkUserId('');
    try {
      const id = identifier.trim();
      const param = id.includes('@') ? `email=${encodeURIComponent(id)}` : `phone=${encodeURIComponent(id)}`;
      const users = await apiFetch(`/users?${param}`) as { id: string; email?: string; phone?: string }[];
      const match = Array.isArray(users) && users.length > 0 ? users[0] : null;
      if (match) { setFoundUser({ id: match.id, email: match.email, phone: match.phone }); setLinkUserId(match.id); }
      else setFoundUser('not_found');
    } catch { } finally { setSearchingUser(false); }
  };

  const handleLink = async () => {
    if (!student || !linkUserId) return;
    setLinking(true);
    try {
      await apiFetch(`/students/${student.id}/link-user`, {
        method: 'POST', body: JSON.stringify({ userId: linkUserId, role: linkType }),
      });
      onSuccess(`${linkType} account linked`);
    } catch (e: any) { setError(e.message || 'Failed to link'); } finally { setLinking(false); }
  };

  const handleAutoCreateAndLink = async () => {
    if (!student) return;
    const phone = linkSearch.trim() || student.parentPhone;
    if (!phone) { setError('No phone number available to create account'); return; }
    setLinking(true);
    setError(null);
    try {
      const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const randChar = (s: string) => { const arr = new Uint8Array(1); crypto.getRandomValues(arr); return s[arr[0] % s.length]; };
      const tempPwd = Array.from({ length: 10 }, () => randChar(CHARS)).join('');
      const newUser = await apiFetch('/users', {
        method: 'POST', body: JSON.stringify({ phone, password: tempPwd, role: 'parent' }),
      }) as { id: string };
      await apiFetch(`/students/${student.id}/link-user`, {
        method: 'POST', body: JSON.stringify({ userId: newUser.id, role: 'parent' }),
      });
      onSuccess(`Parent account created — Phone: ${phone} · Password: ${tempPwd}`);
    } catch (e: any) { setError(e.message || 'Failed to create account'); } finally { setLinking(false); }
  };

  if (!student) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-ds-surface rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold text-ds-text1 mb-0.5">Link Portal Account</h2>
        <p className="text-xs text-ds-text3 mb-4">Student: <span className="font-medium text-ds-text1">{student.firstName} {student.lastName}</span></p>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Account Type</label>
            <div className="flex gap-2">
              {(['parent', 'student'] as const).map((t) => (
                <button key={t} onClick={() => { setLinkType(t); setFoundUser(null); setLinkUserId(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${linkType === t ? 'bg-ds-brand text-white border-ds-brand-dark' : 'bg-ds-surface text-ds-text2 border-ds-border-strong hover:border-gray-400'}`}>
                  {t === 'student' ? 'Student Login' : 'Parent Login'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Search by Phone or Email</label>
            <div className="flex gap-2">
              <input type="text" className="flex-1 p-2.5 border border-ds-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand"
                placeholder="Phone or email" value={linkSearch}
                onChange={(e) => { setLinkSearch(e.target.value); setFoundUser(null); setLinkUserId(''); }} />
              <button onClick={() => void searchByIdentifier(linkSearch)} disabled={searchingUser || !linkSearch.trim()}
                className="px-4 py-2 btn-brand rounded-lg text-sm font-medium disabled:opacity-50">
                {searchingUser ? '...' : 'Search'}
              </button>
            </div>
            {linkType === 'parent' && student.parentPhone && (
              <p className="text-xs text-ds-text3 mt-1">Registered parent phone: <span className="font-medium">{student.parentPhone}</span></p>
            )}
          </div>
          {foundUser === 'not_found' && (
            <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-3 text-xs text-ds-warning-text space-y-2">
              <p>No account found. You can auto-create one using the phone number above.</p>
              {linkType === 'parent' && (
                <button onClick={() => void handleAutoCreateAndLink()} disabled={linking}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {linking ? 'Creating…' : 'Create Parent Account & Link'}
                </button>
              )}
            </div>
          )}
          {foundUser && foundUser !== 'not_found' && (
            <div className="bg-ds-success-bg border border-ds-success-border rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-ds-success-text">Account found</p>
                <p className="text-xs text-ds-success-text mt-0.5">{foundUser.email || foundUser.phone}</p>
              </div>
              <span className="text-xs bg-ds-success-bg text-ds-success-text px-2 py-0.5 rounded-full font-medium">Ready to link</span>
            </div>
          )}
        </div>
        {error && <p className="text-ds-error-text text-xs mt-3">{error}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={() => void handleLink()} disabled={linking || !linkUserId} className="flex-1 py-2.5 btn-brand rounded-lg disabled:opacity-50">
            {linking ? 'Linking...' : 'Link Account'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 border border-ds-border-strong rounded-lg text-sm text-ds-text2 hover:bg-ds-bg2">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
