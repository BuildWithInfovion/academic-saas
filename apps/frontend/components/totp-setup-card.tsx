'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { apiFetch } from '@/lib/api';

type Status = { enabled: boolean; backupCodesRemaining: number };
type SetupData = { qrCode: string; secret: string };
type View = 'loading' | 'disabled' | 'setup' | 'backup-codes' | 'enabled' | 'disabling' | 'error';

const inp = 'w-full p-2.5 border border-ds-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand bg-ds-surface';

export function TotpSetupCard() {
  const [view,          setView]          = useState<View>('loading');
  const [status,        setStatus]        = useState<Status | null>(null);
  const [setup,         setSetup]         = useState<SetupData | null>(null);
  const [backupCodes,   setBackupCodes]   = useState<string[]>([]);
  const [confirmCode,   setConfirmCode]   = useState('');
  const [disableCode,   setDisableCode]   = useState('');
  const [showSecret,    setShowSecret]    = useState(false);
  const [busy,          setBusy]          = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [copied,        setCopied]        = useState(false);

  const loadStatus = useCallback(async () => {
    setView('loading'); setError(null);
    try {
      const s: Status = await apiFetch('/auth/totp/status');
      setStatus(s);
      setView(s.enabled ? 'enabled' : 'disabled');
    } catch (e: any) {
      setError(e.message || 'Failed to load 2FA status');
      setView('error');
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleStartSetup = async () => {
    setBusy(true); setError(null);
    try {
      const data: SetupData = await apiFetch('/auth/totp/setup', { method: 'POST' });
      setSetup(data);
      setConfirmCode('');
      setView('setup');
    } catch (e: any) {
      setError(e.message || 'Setup failed');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    const code = confirmCode.replace(/\s/g, '');
    if (code.length !== 6) return setError('Enter the 6-digit code from your app');
    setBusy(true); setError(null);
    try {
      const res: { backupCodes: string[] } = await apiFetch('/auth/totp/confirm', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      setBackupCodes(res.backupCodes);
      setView('backup-codes');
    } catch (e: any) {
      setError(e.message || 'Invalid code — try again');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    const code = disableCode.replace(/\s/g, '');
    if (code.length < 6) return setError('Enter the 6-digit code to confirm');
    setBusy(true); setError(null);
    try {
      await apiFetch('/auth/totp', { method: 'DELETE', body: JSON.stringify({ code }) });
      setDisableCode('');
      await loadStatus();
    } catch (e: any) {
      setError(e.message || 'Invalid code');
    } finally {
      setBusy(false);
    }
  };

  const copySecret = () => {
    if (setup?.secret) {
      navigator.clipboard.writeText(setup.secret).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (view === 'loading') {
    return (
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6">
        <p className="text-sm text-ds-text3">Loading security settings…</p>
      </div>
    );
  }

  if (view === 'error') {
    return (
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6">
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={loadStatus} className="mt-3 text-sm text-ds-brand hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-sm font-semibold text-ds-text1">Two-Factor Authentication (2FA)</h2>
          <p className="text-xs text-ds-text3 mt-0.5">
            Use Google Authenticator or any TOTP app for extra login security
          </p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          status?.enabled
            ? 'bg-ds-success-bg text-ds-success-text'
            : 'bg-ds-error-bg text-ds-error-text'
        }`}>
          {status?.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mt-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">
          {error}
        </div>
      )}

      {/* ── DISABLED view ── */}
      {view === 'disabled' && (
        <div className="mt-5">
          <div className="flex items-start gap-3 bg-ds-bg2 rounded-lg p-4 mb-5">
            <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-xs text-ds-text2 leading-relaxed">
              Your account is protected by password only. Enable 2FA to require a time-based code
              from your phone on every login — even if your password is compromised.
            </p>
          </div>
          <button
            onClick={handleStartSetup}
            disabled={busy}
            className="btn-brand px-5 py-2.5 rounded-lg text-sm disabled:opacity-50"
          >
            {busy ? 'Generating QR code…' : 'Enable Two-Factor Authentication'}
          </button>
        </div>
      )}

      {/* ── SETUP view ── */}
      {view === 'setup' && setup && (
        <div className="mt-5 space-y-5">
          <div className="text-xs text-ds-text2 space-y-1">
            <p className="font-semibold text-ds-text1">Step 1 — Scan the QR code</p>
            <p>Open Google Authenticator (or Authy, 1Password, etc.) and scan this code:</p>
          </div>

          <div className="flex justify-center">
            <div className="p-3 bg-white rounded-xl border border-ds-border shadow-sm inline-block">
              <Image src={setup.qrCode} alt="TOTP QR Code" width={180} height={180} unoptimized />
            </div>
          </div>

          {/* Manual entry */}
          <div>
            <p className="text-xs font-semibold text-ds-text1 mb-1.5">Can&apos;t scan? Enter manually:</p>
            <div className="flex items-center gap-2 bg-ds-bg2 rounded-lg px-3 py-2.5 border border-ds-border">
              <code className="text-xs font-mono text-ds-text1 flex-1 break-all select-all">
                {showSecret ? setup.secret : '•'.repeat(setup.secret.length)}
              </code>
              <button
                onClick={() => setShowSecret((v) => !v)}
                className="text-xs text-ds-text3 hover:text-ds-text2 shrink-0"
              >
                {showSecret ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={copySecret}
                className="text-xs text-ds-brand hover:underline shrink-0"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Confirm code */}
          <div>
            <p className="text-xs font-semibold text-ds-text1 mb-1.5">
              Step 2 — Enter the 6-digit code to confirm setup:
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9 ]*"
              maxLength={7}
              className={inp}
              placeholder="123 456"
              value={confirmCode}
              onChange={(e) => { setConfirmCode(e.target.value.replace(/[^\d\s]/g, '')); setError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setView('disabled'); setError(null); setSetup(null); }}
              className="flex-1 px-4 py-2.5 border border-ds-border-strong text-ds-text2 text-sm rounded-lg hover:bg-ds-bg2"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={busy}
              className="flex-1 btn-brand px-4 py-2.5 rounded-lg text-sm disabled:opacity-50"
            >
              {busy ? 'Verifying…' : 'Activate 2FA'}
            </button>
          </div>
        </div>
      )}

      {/* ── BACKUP CODES view ── */}
      {view === 'backup-codes' && (
        <div className="mt-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              Save these backup codes now — they are shown only once
            </p>
            <p className="text-xs text-amber-700">
              Each code can be used once if you lose access to your authenticator app.
              Store them in a safe place (password manager, printed copy, etc.).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code, i) => (
              <div key={i} className="bg-ds-bg2 rounded-lg px-3 py-2 text-center border border-ds-border">
                <code className="text-sm font-mono font-semibold text-ds-text1 tracking-widest">{code}</code>
              </div>
            ))}
          </div>

          <button
            onClick={loadStatus}
            className="w-full btn-brand px-4 py-2.5 rounded-lg text-sm"
          >
            I have saved my backup codes
          </button>
        </div>
      )}

      {/* ── ENABLED view ── */}
      {view === 'enabled' && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-3 bg-ds-success-bg border border-ds-success-border rounded-lg p-4">
            <svg className="w-5 h-5 text-ds-success-text shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-ds-success-text">Two-factor authentication is active</p>
              <p className="text-xs text-ds-success-text mt-0.5">
                {status?.backupCodesRemaining ?? 0} backup code{status?.backupCodesRemaining !== 1 ? 's' : ''} remaining
              </p>
            </div>
          </div>

          {(status?.backupCodesRemaining ?? 0) <= 2 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
              ⚠ You have few backup codes left. Disable and re-enable 2FA to generate a new set.
            </div>
          )}

          {view === 'enabled' && (
            <div>
              <p className="text-xs font-semibold text-ds-text1 mb-2">
                Disable 2FA — enter your current authenticator code:
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={7}
                className={inp}
                placeholder="6-digit code"
                value={disableCode}
                onChange={(e) => { setDisableCode(e.target.value.replace(/[^\d\s]/g, '')); setError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleDisable()}
              />
              <button
                onClick={handleDisable}
                disabled={busy}
                className="mt-3 px-5 py-2 text-sm border border-ds-error-border text-ds-error-text bg-ds-error-bg rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                {busy ? 'Disabling…' : 'Disable Two-Factor Authentication'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── DISABLING view ── */}
      {view === 'disabling' && (
        <div className="mt-5">
          <p className="text-sm text-ds-text3">Disabling…</p>
        </div>
      )}
    </div>
  );
}
