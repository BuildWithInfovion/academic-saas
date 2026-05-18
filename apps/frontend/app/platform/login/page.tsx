'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { usePlatformAuthStore } from '@/store/platform-auth.store';
import { apiUrl } from '@/lib/api';

export default function PlatformLoginPage() {
  const router  = useRouter();
  const setAuth = usePlatformAuthStore((s) => s.setAuth);

  const [logoError,   setLogoError]   = useState(false);
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [loading,     setLoading]     = useState(false);
  const [loadStep,    setLoadStep]    = useState(0);
  const [error,       setError]       = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ name: string } | null>(null);

  type ResetStep = 'closed' | 'request' | 'reset';
  const [resetStep,      setResetStep]      = useState<ResetStep>('closed');
  const [resetEmail,     setResetEmail]     = useState('');
  const [resetToken,     setResetToken]     = useState('');
  const [resetNewPwd,    setResetNewPwd]    = useState('');
  const [resetLoading,   setResetLoading]   = useState(false);
  const [resetError,     setResetError]     = useState<string | null>(null);
  const [resetMsg,       setResetMsg]       = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const handleRequestReset = async () => {
    if (!resetEmail.trim()) return setResetError('Email is required');
    setResetLoading(true); setResetError(null);
    try {
      const res = await fetch(apiUrl('/platform/auth/request-reset'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || 'Request failed');
      if (data?.token) {
        setGeneratedToken(data.token);
        setResetMsg('Token generated — valid for 15 minutes. Copy it then proceed to reset.');
        setResetStep('reset');
      } else {
        setResetMsg(data?.message ?? 'If that email is registered, a token has been generated.');
      }
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetToken.trim())  return setResetError('Token is required');
    if (!resetNewPwd.trim()) return setResetError('New password is required');
    setResetLoading(true); setResetError(null);
    try {
      const res = await fetch(apiUrl('/platform/auth/reset-password'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken.trim(), newPassword: resetNewPwd }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || 'Reset failed');
      setResetMsg(data?.message ?? 'Password reset successfully.');
      setGeneratedToken(null);
      setTimeout(() => {
        setResetStep('closed');
        setResetEmail(''); setResetToken(''); setResetNewPwd(''); setResetMsg(null);
      }, 2600);
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogin = async () => {
    if (loading) return;
    if (!email.trim())    return setError('Email is required');
    if (!password.trim()) return setError('Password is required');
    setLoading(true); setLoadStep(1); setError(null);
    try {
      const res = await fetch(apiUrl('/platform/auth/login'), {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setLoadStep(2);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || 'Login failed');
      }
      const data = await res.json();
      setLoadStep(3);
      setAuth(data.accessToken, data.admin);
      const sec = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `platform_ready=1; path=/; max-age=86400; SameSite=Lax${sec}`;
      const name = email.split('@')[0] || 'Admin';
      setSuccessInfo({ name });
      await new Promise<void>((res) => setTimeout(res, 1200));
      router.push('/platform/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoadStep(0);
    } finally {
      setLoading(false);
    }
  };

  const loadingLabel =
    loadStep === 1 ? 'Verifying...' : loadStep === 2 ? 'Authenticating...' : 'Granting access...';

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#080c18', fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      padding: '32px 16px',
    }}>

      <style>{`
        .plf {
          width: 100%; padding: 10px 12px 10px 38px; font-size: 14px;
          border: 1px solid rgba(99,102,241,0.18); border-radius: 8px;
          color: #e2e8ff; background: rgba(255,255,255,0.04); outline: none;
          box-sizing: border-box; transition: border-color 0.15s, box-shadow 0.15s;
        }
        .plf::placeholder { color: rgba(139,116,246,0.35); }
        .plf:hover  { border-color: rgba(99,102,241,0.35); background: rgba(255,255,255,0.06); }
        .plf:focus  { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.14); background: rgba(255,255,255,0.07); }
        .plf:disabled { opacity: 0.45; cursor: not-allowed; }

        .plf-plain {
          width: 100%; padding: 10px 12px; font-size: 14px;
          border: 1px solid rgba(99,102,241,0.18); border-radius: 8px;
          color: #e2e8ff; background: rgba(255,255,255,0.04); outline: none;
          box-sizing: border-box; transition: border-color 0.15s, box-shadow 0.15s;
        }
        .plf-plain::placeholder { color: rgba(139,116,246,0.35); }
        .plf-plain:hover  { border-color: rgba(99,102,241,0.35); }
        .plf-plain:focus  { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.14); }
        .plf-plain:disabled { opacity: 0.45; cursor: not-allowed; }

        .pbtn {
          transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease;
        }
        .pbtn:not(:disabled):hover {
          background: linear-gradient(135deg, #6366f1, #4338ca) !important;
          box-shadow: 0 4px 20px rgba(99,102,241,0.5) !important;
          transform: translateY(-1px) !important;
        }
        .pbtn:not(:disabled):active { transform: translateY(0) !important; }
        .pbtn:disabled { opacity: 0.55; cursor: not-allowed; }

        @keyframes pspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pfade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .p-fade { animation: pfade 0.3s ease forwards; }
      `}</style>

      {/* Card */}
      <div className="p-fade" style={{
        width: '100%', maxWidth: 400,
        background: 'linear-gradient(160deg, #0d1020 0%, #080c18 100%)',
        border: '1px solid rgba(99,102,241,0.16)',
        borderRadius: 18,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>
        {/* Indigo top bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #3730a3, #6366f1, #a5b4fc, #6366f1, #3730a3)' }} />

        <div style={{ padding: '36px 36px 32px' }}>

          {/* Logo + title */}
          <div style={{ marginBottom: 32 }}>
            {!logoError ? (
              <Image src="/logo.png" alt="Infovion" width={100} height={50}
                style={{ objectFit: 'contain', width: 'auto', maxHeight: 42, display: 'block', marginBottom: 12 }}
                onError={() => setLogoError(true)} />
            ) : (
              <p style={{ color: '#a5b4fc', fontSize: 18, fontWeight: 700, margin: '0 0 12px 0' }}>Infovion</p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 999,
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#818cf8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Developer Console
                </span>
              </div>
            </div>

            <h2 style={{ color: '#f1f0ff', fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em', margin: '12px 0 4px 0' }}>
              Sign in to Platform
            </h2>
            <p style={{ color: 'rgba(139,116,246,0.55)', fontSize: 13.5, margin: 0 }}>
              Restricted to authorised administrators
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(99,102,241,0.1)', marginBottom: 26 }} />

          {/* Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(139,116,246,0.7)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 12, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: 'rgba(99,102,241,0.4)', pointerEvents: 'none' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <input className="plf" type="email" placeholder="admin@infovion.in"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  disabled={loading} autoCapitalize="none" autoCorrect="off" />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(139,116,246,0.7)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 12, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: 'rgba(99,102,241,0.4)', pointerEvents: 'none' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input className="plf" type="password" placeholder="••••••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  disabled={loading} />
              </div>
            </div>

          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 16, padding: '10px 13px', borderRadius: 8, fontSize: 13,
              background: 'rgba(127,29,29,0.2)', border: '1px solid rgba(239,68,68,0.22)', color: '#fca5a5',
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button onClick={handleLogin} disabled={loading} className="pbtn"
            style={{
              marginTop: 22, width: '100%', padding: '12px',
              fontSize: 15, fontWeight: 600, borderRadius: 9,
              cursor: loading ? 'default' : 'pointer',
              background: loading
                ? 'rgba(79,70,229,0.35)'
                : 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
              color: loading ? '#a5b4fc' : '#e0e7ff',
              border: '1px solid rgba(79,70,229,0.35)',
              boxShadow: loading ? 'none' : '0 2px 14px rgba(99,102,241,0.4)',
            }}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                <svg style={{ width: 16, height: 16, animation: 'pspin 0.8s linear infinite', flexShrink: 0 }}
                  viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                    strokeDasharray="30" strokeLinecap="round" />
                </svg>
                {loadingLabel}
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                Access Platform
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            )}
          </button>

          {/* Forgot */}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              onClick={() => { setResetStep('request'); setResetError(null); setResetMsg(null); setGeneratedToken(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(139,116,246,0.45)', fontSize: 13, transition: 'color 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#818cf8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(139,116,246,0.45)')}>
              Forgot password?
            </button>
          </div>

        </div>

        {/* Card footer */}
        <div style={{ borderTop: '1px solid rgba(99,102,241,0.08)', padding: '14px 36px', textAlign: 'center' }}>
          <p style={{ color: 'rgba(99,102,241,0.25)', fontSize: 11, margin: 0, letterSpacing: '0.04em' }}>
            © {new Date().getFullYear()} Infovion Technologies · Restricted Access
          </p>
        </div>
      </div>

      {/* ── Success overlay ── */}
      {successInfo && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 80,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(8,12,24,0.96)',
        }}>
          <svg style={{ width: 32, height: 32, animation: 'pspin 0.8s linear infinite', color: '#6366f1', marginBottom: 18 }}
            viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
              strokeDasharray="30" strokeLinecap="round" />
          </svg>
          <p style={{ color: '#e2e8ff', fontSize: 16, fontWeight: 700, margin: '0 0 4px 0' }}>
            Welcome, {successInfo.name}
          </p>
          <p style={{ color: 'rgba(139,116,246,0.55)', fontSize: 13.5, margin: 0 }}>
            Loading platform dashboard…
          </p>
        </div>
      )}

      {/* ── Forgot password modal ── */}
      {resetStep !== 'closed' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, background: 'rgba(4,6,12,0.8)', backdropFilter: 'blur(6px)',
        }} onClick={(e) => { if (e.target === e.currentTarget) setResetStep('closed'); }}>
          <div style={{
            width: '100%', maxWidth: 380,
            background: 'linear-gradient(160deg, #0d1020 0%, #080c18 100%)',
            border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16,
            boxShadow: '0 40px 90px rgba(0,0,0,0.7)', overflow: 'hidden',
          }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg, #3730a3, #6366f1, #a5b4fc, #6366f1, #3730a3)' }} />

            <div style={{ padding: '24px 26px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, color: '#f1f0ff', fontWeight: 700, fontSize: 16 }}>
                    {resetStep === 'request' ? 'Reset Password' : 'Set New Password'}
                  </h3>
                  <p style={{ margin: '4px 0 0', color: 'rgba(139,116,246,0.5)', fontSize: 12 }}>
                    {resetStep === 'request'
                      ? 'Enter your admin email to generate a reset token'
                      : 'Enter the token and your new password'}
                  </p>
                </div>
                <button onClick={() => setResetStep('closed')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(139,116,246,0.4)', fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
              </div>

              {resetMsg && (
                <div style={{
                  marginBottom: 16, padding: '10px 13px', borderRadius: 8, fontSize: 13,
                  background: 'rgba(16,36,99,0.4)', border: '1px solid rgba(99,102,241,0.25)',
                  color: 'rgba(165,180,252,0.9)',
                }}>
                  {resetMsg}
                </div>
              )}

              {resetStep === 'request' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'rgba(139,116,246,0.7)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                      Admin Email
                    </label>
                    <input className="plf-plain" type="email"
                      value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRequestReset()}
                      disabled={resetLoading} />
                  </div>
                  {resetError && (
                    <div style={{ padding: '10px 13px', borderRadius: 8, fontSize: 13, background: 'rgba(127,29,29,0.2)', border: '1px solid rgba(239,68,68,0.22)', color: '#fca5a5' }}>
                      {resetError}
                    </div>
                  )}
                  <button onClick={handleRequestReset} disabled={resetLoading} className="pbtn"
                    style={{
                      padding: '11px', fontSize: 14, fontWeight: 600, borderRadius: 9,
                      cursor: resetLoading ? 'default' : 'pointer', opacity: resetLoading ? 0.55 : 1,
                      background: 'linear-gradient(135deg, #4f46e5, #3730a3)', color: '#e0e7ff',
                      border: '1px solid rgba(79,70,229,0.35)',
                    }}>
                    {resetLoading ? 'Generating...' : 'Generate Reset Token'}
                  </button>
                  <button onClick={() => setResetStep('reset')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(139,116,246,0.5)', fontSize: 12.5, textAlign: 'center', marginTop: 2 }}>
                    Already have a token? Set new password →
                  </button>
                </div>
              )}

              {resetStep === 'reset' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {generatedToken && (
                    <div style={{
                      padding: '10px 13px', borderRadius: 8, fontSize: 12,
                      background: 'rgba(16,36,99,0.35)', border: '1px solid rgba(99,102,241,0.25)',
                      color: 'rgba(165,180,252,0.85)', wordBreak: 'break-all', fontFamily: 'monospace',
                    }}>
                      <span style={{ display: 'block', fontSize: 10, color: 'rgba(139,116,246,0.6)', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Your reset token
                      </span>
                      {generatedToken}
                    </div>
                  )}
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'rgba(139,116,246,0.7)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                      Reset Token
                    </label>
                    <input className="plf-plain" type="text"
                      value={resetToken} onChange={(e) => setResetToken(e.target.value)}
                      disabled={resetLoading}
                      style={{ fontFamily: 'monospace', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'rgba(139,116,246,0.7)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                      New Password
                    </label>
                    <input className="plf-plain" type="password"
                      value={resetNewPwd} onChange={(e) => setResetNewPwd(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                      disabled={resetLoading} />
                    <p style={{ margin: '5px 0 0', fontSize: 11, color: 'rgba(139,116,246,0.4)' }}>
                      Min 12 chars · 1 uppercase · 1 number · 1 special char
                    </p>
                  </div>
                  {resetError && (
                    <div style={{ padding: '10px 13px', borderRadius: 8, fontSize: 13, background: 'rgba(127,29,29,0.2)', border: '1px solid rgba(239,68,68,0.22)', color: '#fca5a5' }}>
                      {resetError}
                    </div>
                  )}
                  <button onClick={handleResetPassword} disabled={resetLoading} className="pbtn"
                    style={{
                      padding: '11px', fontSize: 14, fontWeight: 600, borderRadius: 9,
                      cursor: resetLoading ? 'default' : 'pointer', opacity: resetLoading ? 0.55 : 1,
                      background: 'linear-gradient(135deg, #4f46e5, #3730a3)', color: '#e0e7ff',
                      border: '1px solid rgba(79,70,229,0.35)',
                    }}>
                    {resetLoading ? 'Resetting...' : 'Reset Password'}
                  </button>
                  <button onClick={() => { setResetStep('request'); setResetError(null); setGeneratedToken(null); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(139,116,246,0.5)', fontSize: 12.5, textAlign: 'center' }}>
                    ← Back
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
