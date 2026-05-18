'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useAuthStore } from '@/store/auth.store';
import { usePortalAuthStore } from '@/store/portal-auth.store';
import { getRoleRoute, PORTAL_ROLES, DASHBOARD_ROLES } from '@/lib/auth-utils';
import { apiUrl } from '@/lib/api';

export default function LoginPage() {
  const setAuth = useAuthStore((s) => s.setAuth);

  const [logoError, setLogoError] = useState(false);

  const [activeTab, setActiveTab] = useState<'staff' | 'parent'>('staff');
  const [staffStep, setStaffStep] = useState<1 | 2>(1);

  const [institutionCode, setInstitutionCode] = useState('');
  const [staffEmail,      setStaffEmail]      = useState('');
  const [staffPassword,   setStaffPassword]   = useState('');

  const [totpToken,  setTotpToken]  = useState<string | null>(null);
  const [totpDigits, setTotpDigits] = useState(['', '', '', '', '', '']);
  const totpRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null, null]);

  const [parentPhone,    setParentPhone]    = useState('');
  const [parentPassword, setParentPassword] = useState('');

  const [loading,     setLoading]     = useState(false);
  const [loadStep,    setLoadStep]    = useState(0);
  const [error,       setError]       = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ institution: string } | null>(null);

  const [showParentForgot, setShowParentForgot] = useState(false);
  const [pfPhone,          setPfPhone]          = useState('');
  const [pfLoading,        setPfLoading]        = useState(false);
  const [pfError,          setPfError]          = useState<string | null>(null);
  const [pfSubmitted,      setPfSubmitted]      = useState(false);

  const [showForgot,    setShowForgot]    = useState(false);
  const [fpStep,        setFpStep]        = useState<'form' | 'otp'>('form');
  const [fpCode,        setFpCode]        = useState('');
  const [fpEmail,       setFpEmail]       = useState('');
  const [fpOtp,         setFpOtp]         = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpLoading,     setFpLoading]     = useState(false);
  const [fpError,       setFpError]       = useState<string | null>(null);
  const [fpSuccess,     setFpSuccess]     = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applySession = async (data: any, fallbackCode: string) => {
    const roles: string[] = data.user?.roles ?? [];
    const authPayload = {
      accessToken: data.accessToken as string,
      user: {
        name: (data.user.name ?? null) as string | null,
        email: (data.user.email ?? '') as string,
        phone: data.user.phone as string | undefined,
        institutionId: data.user.institutionId as string,
        institutionName: data.user.institutionName as string | undefined,
        roles,
      },
    };
    const isDashboard = (DASHBOARD_ROLES as string[]).some((r) => roles.includes(r));
    if (isDashboard) {
      usePortalAuthStore.getState().logout();
      setAuth(authPayload);
    } else {
      useAuthStore.getState().logout();
      usePortalAuthStore.getState().setAuth(authPayload);
    }
    setLoadStep(3);
    const portalRoles  = roles.filter((r) => (PORTAL_ROLES as readonly string[]).includes(r));
    const destination  = portalRoles.length > 1 ? '/portal/select-role' : getRoleRoute(roles);
    setSuccessInfo({ institution: data.user.institutionName || fallbackCode });
    await new Promise<void>((resolve) => setTimeout(resolve, 1200));
    const sec = window.location.protocol === 'https:' ? '; Secure' : '';
    if (isDashboard) {
      document.cookie = `dashboard_ready=1; path=/; max-age=604800; SameSite=Lax${sec}`;
      document.cookie = `portal_ready=; path=/; max-age=0; SameSite=Lax`;
    } else {
      document.cookie = `portal_ready=1; path=/; max-age=604800; SameSite=Lax${sec}`;
      document.cookie = `dashboard_ready=; path=/; max-age=0; SameSite=Lax`;
    }
    window.location.href = destination;
  };

  const handleStaffLogin = async () => {
    if (!institutionCode.trim()) return setError('School code is required');
    if (!staffEmail.trim())      return setError('Email is required');
    if (!staffPassword.trim())   return setError('Password is required');
    setLoading(true); setLoadStep(1); setError(null);
    try {
      const res = await fetch(apiUrl('/auth/login'), {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionCode: institutionCode.trim().toLowerCase(),
          email: staffEmail.trim(),
          password: staffPassword,
        }),
      });
      setLoadStep(2);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || 'Login failed');
      if (data.requiresTOTP) {
        setTotpToken(data.totpToken);
        setStaffStep(2);
        setLoading(false); setLoadStep(0);
        setTimeout(() => totpRefs.current[0]?.focus(), 120);
        return;
      }
      if (!data.accessToken) throw new Error('No token received');
      await applySession(data, institutionCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoadStep(0);
    } finally {
      setLoading(false);
    }
  };

  const handleTotpVerify = async () => {
    const code = totpDigits.join('');
    if (code.length < 6) return setError('Enter the complete 6-digit code');
    if (!totpToken)       return setError('Session expired — please sign in again');
    setLoading(true); setLoadStep(1); setError(null);
    try {
      const res = await fetch(apiUrl('/auth/totp/authenticate'), {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totpToken, code }),
      });
      setLoadStep(2);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || 'Invalid code');
      if (!data.accessToken) throw new Error('No token received');
      await applySession(data, institutionCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setLoadStep(0);
    } finally {
      setLoading(false);
    }
  };

  const handleTotpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next  = [...totpDigits];
    next[index] = digit;
    setTotpDigits(next);
    if (digit && index < 5) totpRefs.current[index + 1]?.focus();
  };

  const handleTotpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (totpDigits[index]) {
        const next = [...totpDigits]; next[index] = ''; setTotpDigits(next);
      } else if (index > 0) {
        totpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'Enter') {
      handleTotpVerify();
    }
  };

  const handleTotpPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length > 0) {
      const next = (text + '      ').slice(0, 6).split('').map((c) => (/\d/.test(c) ? c : ''));
      setTotpDigits(next);
      totpRefs.current[Math.min(text.length, 5)]?.focus();
    }
    e.preventDefault();
  };

  const handleParentLogin = async () => {
    if (!parentPhone.trim())    return setError('Phone number is required');
    if (!parentPassword.trim()) return setError('Password is required');
    setLoading(true); setLoadStep(1); setError(null);
    try {
      const res = await fetch(apiUrl('/auth/parent/login'), {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: parentPhone.trim(), password: parentPassword }),
      });
      setLoadStep(2);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || 'Login failed');
      if (!data.accessToken) throw new Error('No token received');
      useAuthStore.getState().logout();
      usePortalAuthStore.getState().setAuth({
        accessToken: data.accessToken,
        user: {
          name: (data.user.name ?? null) as string | null,
          email: (data.user.email ?? '') as string,
          phone: data.user.phone as string | undefined,
          institutionId: data.user.institutionId as string,
          institutionName: data.user.institutionName as string | undefined,
          roles: (data.user.roles as string[]) ?? [],
        },
      });
      setLoadStep(3);
      setSuccessInfo({ institution: data.user.institutionName || 'Welcome' });
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
      const sec = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `portal_ready=1; path=/; max-age=604800; SameSite=Lax${sec}`;
      document.cookie = `dashboard_ready=; path=/; max-age=0; SameSite=Lax`;
      window.location.href = '/portal/parent';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoadStep(0);
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab: 'staff' | 'parent') => {
    setActiveTab(tab); setStaffStep(1);
    setTotpToken(null); setTotpDigits(['', '', '', '', '', '']); setError(null);
  };

  const openForgot = () => {
    setFpCode(institutionCode); setFpEmail(''); setFpOtp(''); setFpNewPassword('');
    setFpStep('form'); setFpError(null); setFpSuccess(null); setShowForgot(true);
  };

  const openParentForgot = () => {
    setPfPhone(parentPhone); setPfError(null); setPfSubmitted(false); setShowParentForgot(true);
  };

  const handleParentForgotSubmit = async () => {
    if (!pfPhone.trim()) return setPfError('Phone number is required');
    if (!/^\d{10,15}$/.test(pfPhone.trim())) return setPfError('Enter a valid phone number (10–15 digits)');
    setPfLoading(true); setPfError(null);
    try {
      const res = await fetch(apiUrl('/auth/parent/request-password-reset'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: pfPhone.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { message?: string } | null;
        throw new Error(data?.message ?? 'Request failed. Please try again.');
      }
      setPfSubmitted(true);
    } catch (err) {
      setPfError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setPfLoading(false);
    }
  };

  const handleForgotSendOtp = async () => {
    if (!fpCode.trim())  return setFpError('School code is required');
    if (!fpEmail.trim()) return setFpError('Email is required');
    if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(fpEmail.trim())) return setFpError('Enter a valid email address');
    setFpLoading(true); setFpError(null);
    try {
      const res = await fetch(apiUrl('/auth/forgot-password'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionCode: fpCode.trim().toLowerCase(), email: fpEmail.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || 'Request failed');
      setFpStep('otp');
    } catch (err) {
      setFpError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setFpLoading(false);
    }
  };

  const handleForgotReset = async () => {
    if (!fpOtp.trim())         return setFpError('Verification code is required');
    if (!fpNewPassword.trim()) return setFpError('New password is required');
    if (fpNewPassword.length < 8) return setFpError('Password must be at least 8 characters');
    setFpLoading(true); setFpError(null);
    try {
      const res = await fetch(apiUrl('/auth/reset-password'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionCode: fpCode.trim().toLowerCase(),
          email: fpEmail.trim(), otp: fpOtp.trim(), newPassword: fpNewPassword,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || 'Reset failed');
      setFpSuccess('Password updated. You can now sign in with your new password.');
    } catch (err) {
      setFpError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setFpLoading(false);
    }
  };

  const submitLabel =
    loading
      ? loadStep === 1 ? 'Verifying...' : loadStep === 2 ? 'Authenticating...' : 'Signing you in...'
      : staffStep === 2 ? 'Verify & Sign In' : 'Sign In';

  const handleSubmit = activeTab === 'staff'
    ? (staffStep === 2 ? handleTotpVerify : handleStaffLogin)
    : handleParentLogin;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}>

      {/* ── Scoped styles ── */}
      <style>{`
        .lef {
          width: 100%; padding: 10px 12px 10px 38px;
          font-size: 14px; border: 1px solid #e2e8f0; border-radius: 8px;
          color: #0f172a; background: #fff; outline: none; box-sizing: border-box;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .lef::placeholder { color: #94a3b8; }
        .lef:hover  { border-color: #cbd5e1; }
        .lef:focus  { border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13,148,136,0.1); }
        .lef:disabled { background: #f8fafc; color: #94a3b8; cursor: not-allowed; }

        .lef-plain {
          width: 100%; padding: 10px 12px;
          font-size: 14px; border: 1px solid #e2e8f0; border-radius: 8px;
          color: #0f172a; background: #fff; outline: none; box-sizing: border-box;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .lef-plain::placeholder { color: #94a3b8; }
        .lef-plain:hover  { border-color: #cbd5e1; }
        .lef-plain:focus  { border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13,148,136,0.1); }
        .lef-plain:disabled { background: #f8fafc; color: #94a3b8; cursor: not-allowed; }

        .ltab {
          flex: 1; padding: 8px 0; font-size: 13px; font-weight: 600;
          border-radius: 7px; cursor: pointer; border: none; background: transparent;
          color: #64748b; transition: all 0.15s;
        }
        .ltab:hover:not(:disabled) { color: #0f172a; }
        .ltab.active {
          background: #ffffff; color: #0d9488;
          box-shadow: 0 1px 4px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04);
        }
        .ltab:disabled { cursor: not-allowed; opacity: 0.55; }

        .lotp {
          width: 44px; height: 52px; border-radius: 8px;
          border: 1.5px solid #e2e8f0; background: #fff;
          color: #0f172a; font-size: 22px; font-weight: 600;
          text-align: center; outline: none; caret-color: transparent;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .lotp:focus  { border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13,148,136,0.1); }
        .lotp.filled { border-color: #0d9488; background: #f0fdfa; }
        .lotp:disabled { opacity: 0.5; cursor: not-allowed; }

        .lbtn {
          transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease;
        }
        .lbtn:not(:disabled):hover {
          background: linear-gradient(135deg, #14b8a6, #0d9488) !important;
          box-shadow: 0 4px 20px rgba(13,148,136,0.35) !important;
          transform: translateY(-1px) !important;
        }
        .lbtn:not(:disabled):active { transform: translateY(0) !important; }
        .lbtn:disabled { opacity: 0.65; cursor: not-allowed; }

        .lfgt {
          font-size: 13px; color: #94a3b8; background: none; border: none;
          cursor: pointer; padding: 0; transition: color 0.15s;
        }
        .lfgt:hover { color: #0d9488; }

        .lmod-field {
          width: 100%; padding: 10px 12px; font-size: 14px;
          border: 1px solid #e2e8f0; border-radius: 8px;
          color: #0f172a; background: #fff; outline: none; box-sizing: border-box;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .lmod-field::placeholder { color: #94a3b8; }
        .lmod-field:focus { border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13,148,136,0.1); }
        .lmod-field:disabled { background: #f8fafc; cursor: not-allowed; }

        @keyframes lspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes lfadein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .l-fade { animation: lfadein 0.3s ease forwards; }

        /* Responsive — brand panel */
        .lbrand { display: none; }
        .lmobile-logo { display: block; }
        .lmobile-footer { display: block; }
        @media (min-width: 1024px) {
          .lbrand { display: flex !important; flex-direction: column; }
          .lmobile-logo { display: none !important; }
          .lmobile-footer { display: none !important; }
        }
      `}</style>

      {/* ════════════════════════════════════════
          LEFT BRAND PANEL  (desktop only)
      ════════════════════════════════════════ */}
      <div className="lbrand" style={{
        display: 'none', width: 420, minHeight: '100vh', flexDirection: 'column',
        background: '#0f172a', padding: '52px 48px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle dot grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle, rgba(45,212,191,0.055) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }} />
        {/* Soft ambient teal orb */}
        <div style={{
          position: 'absolute', bottom: '-10%', right: '-15%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(13,148,136,0.08) 0%, transparent 70%)',
          filter: 'blur(60px)', pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 48 }}>
          {!logoError ? (
            <Image src="/logo.png" alt="Infovion" width={220} height={110}
              style={{ objectFit: 'contain', width: 'auto', height: 90, display: 'block', filter: 'brightness(0) invert(1)' }}
              onError={() => setLogoError(true)} />
          ) : (
            <p style={{ color: '#2dd4bf', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
              Infovion
            </p>
          )}
          <p style={{
            color: '#2dd4bf', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 14, marginBottom: 0,
          }}>
            Academic Management Platform
          </p>
        </div>

        {/* Headline */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
          <h1 style={{
            color: '#f1f5f9', fontSize: 26, fontWeight: 700,
            lineHeight: 1.35, letterSpacing: '-0.025em', margin: '0 0 14px 0',
          }}>
            Everything your school needs, in one place.
          </h1>
          <p style={{
            color: '#cbd5e1', fontSize: 14.5, lineHeight: 1.7, margin: '0 0 40px 0',
          }}>
            Attendance, fees, exams, parent communication, and documents — purpose-built for Indian K-12 schools.
          </p>

          {/* Feature list */}
          {[
            'Student attendance & examination management',
            'Fee collection with Razorpay online payments',
            'Parent portal with real-time student updates',
            'Transfer certificates & school documents',
            'Staff salary, timetable & substitution covers',
          ].map((feature) => (
            <div key={feature} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(45,212,191,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <polyline points="2,6 5,9 10,3" stroke="#2dd4bf" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span style={{ color: '#e2e8f0', fontSize: 13.5, lineHeight: 1.5 }}>{feature}</span>
            </div>
          ))}
        </div>

        {/* Panel footer */}
        <div style={{
          position: 'relative', zIndex: 1,
          borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20, marginTop: 40,
        }}>
          <p style={{ color: '#94a3b8', fontSize: 11, margin: 0 }}>
            © {new Date().getFullYear()} Infovion Technologies · Pune, India
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════
          RIGHT FORM PANEL
      ════════════════════════════════════════ */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#ffffff', padding: '40px 24px', minHeight: '100vh',
      }}>
        <div className="l-fade" style={{ width: '100%', maxWidth: 380 }}>

          {/* Mobile logo (hidden on lg+) */}
          <div className="lmobile-logo" style={{ textAlign: 'center', marginBottom: 36 }}>
            {!logoError ? (
              <Image src="/logo.png" alt="Infovion" width={110} height={55}
                style={{ objectFit: 'contain', width: 'auto', maxHeight: 46, display: 'block', margin: '0 auto' }}
                onError={() => setLogoError(true)} />
            ) : (
              <p style={{ color: '#0d9488', fontSize: 20, fontWeight: 700, margin: 0 }}>Infovion</p>
            )}
            <p style={{
              color: '#94a3b8', fontSize: 10.5, fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 8, marginBottom: 0,
            }}>
              Academic Management Platform
            </p>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ color: '#0f172a', fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 5px 0' }}>
              {staffStep === 2 ? 'Two-Step Verification' : 'Sign in'}
            </h2>
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
              {activeTab === 'parent'
                ? 'Enter your phone number and password'
                : staffStep === 2
                  ? 'Enter the 6-digit code from your authenticator app'
                  : 'Enter your school code and credentials to continue'}
            </p>
          </div>

          {/* Tab switcher — only on step 1 */}
          {staffStep === 1 && (
            <div style={{
              display: 'flex', gap: 0, background: '#f1f5f9',
              borderRadius: 10, padding: 4, marginBottom: 26,
              border: '1px solid #e2e8f0',
            }}>
              <button className={`ltab ${activeTab === 'staff' ? 'active' : ''}`}
                onClick={() => switchTab('staff')} disabled={loading}>
                School Staff
              </button>
              <button className={`ltab ${activeTab === 'parent' ? 'active' : ''}`}
                onClick={() => switchTab('parent')} disabled={loading}>
                Parent
              </button>
            </div>
          )}

          {/* ── Staff step 1 ── */}
          {activeTab === 'staff' && staffStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  School Code
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 12, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: '#94a3b8', pointerEvents: 'none' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </div>
                  <input className="lef" type="text" placeholder="Your school code"
                    value={institutionCode} onChange={(e) => setInstitutionCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStaffLogin()}
                    disabled={loading} autoCapitalize="none" autoCorrect="off" />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 12, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: '#94a3b8', pointerEvents: 'none' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <input className="lef" type="email" placeholder="Your email address"
                    value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStaffLogin()}
                    disabled={loading} autoCapitalize="none" autoCorrect="off" />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 12, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: '#94a3b8', pointerEvents: 'none' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <input className="lef" type="password" placeholder="Your password"
                    value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStaffLogin()}
                    disabled={loading} />
                </div>
              </div>

            </div>
          )}

          {/* ── TOTP step 2 ── */}
          {activeTab === 'staff' && staffStep === 2 && (
            <div>
              <div style={{
                padding: '12px 14px', borderRadius: 8, marginBottom: 22,
                background: '#f0fdfa', border: '1px solid #99f6e4',
                display: 'flex', alignItems: 'center', gap: 10, color: '#0f766e', fontSize: 13,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
                Open your authenticator app and enter the current 6-digit code
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10 }}
                onPaste={handleTotpPaste}>
                {totpDigits.map((digit, i) => (
                  <input key={i}
                    ref={(el) => { totpRefs.current[i] = el; }}
                    className={`lotp${digit ? ' filled' : ''}`}
                    type="text" inputMode="numeric" pattern="[0-9]*"
                    maxLength={1} value={digit} placeholder="·"
                    onChange={(e) => handleTotpChange(i, e.target.value)}
                    onKeyDown={(e) => handleTotpKeyDown(i, e)}
                    disabled={loading}
                  />
                ))}
              </div>

              <button type="button"
                onClick={() => { setStaffStep(1); setTotpToken(null); setTotpDigits(['','','','','','']); setError(null); }}
                style={{ fontSize: 13, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 5, transition: 'color 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#0d9488')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back to login
              </button>
            </div>
          )}

          {/* ── Parent form ── */}
          {activeTab === 'parent' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Phone Number
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 12, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: '#94a3b8', pointerEvents: 'none' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.13 1 .38 1.97.74 2.91a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 5.16 5.16l.96-.96a2 2 0 0 1 2.11-.45c.94.36 1.92.61 2.91.74A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <input className="lef" type="tel" placeholder="Your registered phone number"
                    value={parentPhone} onChange={(e) => setParentPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleParentLogin()}
                    disabled={loading} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 12, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: '#94a3b8', pointerEvents: 'none' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <input className="lef" type="password" placeholder="••••••••"
                    value={parentPassword} onChange={(e) => setParentPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleParentLogin()}
                    disabled={loading} />
                </div>
              </div>

            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 16, padding: '10px 14px', borderRadius: 8,
              background: '#fff1f2', border: '1px solid #fda4af', color: '#9f1239', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button onClick={handleSubmit} disabled={loading} className="lbtn"
            style={{
              marginTop: 22, width: '100%', padding: '12px',
              fontSize: 15, fontWeight: 600, borderRadius: 9, cursor: loading ? 'default' : 'pointer',
              background: loading
                ? '#f0fdfa'
                : 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
              color: loading ? '#0d9488' : '#ffffff',
              border: '1px solid rgba(15,118,110,0.25)',
              boxShadow: loading ? 'none' : '0 1px 6px rgba(13,148,136,0.28)',
            }}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                <svg style={{ width: 16, height: 16, animation: 'lspin 0.8s linear infinite', flexShrink: 0 }}
                  viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                    strokeDasharray="30" strokeLinecap="round" />
                </svg>
                {submitLabel}
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {staffStep === 2 ? 'Verify & Sign In' : 'Sign In'}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            )}
          </button>

          {/* Forgot password */}
          {activeTab === 'staff' && staffStep === 1 && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button type="button" className="lfgt" onClick={openForgot}>Forgot password?</button>
            </div>
          )}
          {activeTab === 'parent' && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button type="button" className="lfgt" onClick={openParentForgot}>Forgot password?</button>
            </div>
          )}

          {/* Mobile footer */}
          <div className="lmobile-footer" style={{ textAlign: 'center', marginTop: 36, paddingTop: 24, borderTop: '1px solid #f1f5f9' }}>
            <p style={{ color: '#cbd5e1', fontSize: 11, margin: 0 }}>
              © {new Date().getFullYear()} Infovion Technologies · Pune, India
            </p>
          </div>

        </div>
      </div>

      {/* ════════════════════════════════════════
          SUCCESS OVERLAY  (minimal)
      ════════════════════════════════════════ */}
      {successInfo && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 80,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.96)',
        }}>
          <svg style={{ width: 34, height: 34, animation: 'lspin 0.8s linear infinite', color: '#0d9488', marginBottom: 18 }}
            viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
              strokeDasharray="30" strokeLinecap="round" />
          </svg>
          <p style={{ color: '#0f172a', fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', letterSpacing: '-0.01em' }}>
            {successInfo.institution}
          </p>
          <p style={{ color: '#64748b', fontSize: 13.5, margin: 0 }}>Signing you in…</p>
        </div>
      )}

      {/* ════════════════════════════════════════
          PARENT FORGOT PASSWORD MODAL
      ════════════════════════════════════════ */}
      {showParentForgot && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
        }} onClick={(e) => e.target === e.currentTarget && setShowParentForgot(false)}>
          <div style={{
            width: '100%', maxWidth: 380, borderRadius: 16, overflow: 'hidden',
            background: '#ffffff', boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          }}>
            {/* Teal accent bar */}
            <div style={{ height: 3, background: 'linear-gradient(90deg, #0d9488, #2dd4bf, #0d9488)' }} />

            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Forgot Password</p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>Parent account recovery</p>
                </div>
                <button onClick={() => setShowParentForgot(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '22px 24px 24px' }}>
              {pfSubmitted ? (
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: '50%', margin: '0 auto 16px',
                    background: '#f0fdfa', border: '1px solid #99f6e4',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0' }}>Request Submitted</p>
                  <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, margin: '0 0 22px 0' }}>
                    Your school operator will reset your password and share it with you directly.
                  </p>
                  <button onClick={() => setShowParentForgot(false)}
                    style={{
                      padding: '10px 28px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                      background: 'linear-gradient(135deg, #0d9488, #0f766e)', color: '#ffffff',
                      border: '1px solid rgba(15,118,110,0.3)',
                    }}>
                    Back to Login
                  </button>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: '#64748b', marginBottom: 18, lineHeight: 1.6 }}>
                    Enter your registered phone number. Your school operator will receive a request and reset your password.
                  </p>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Phone Number
                    </label>
                    <input className="lmod-field" type="tel" placeholder="10-digit phone number"
                      value={pfPhone} onChange={(e) => setPfPhone(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleParentForgotSubmit()}
                      disabled={pfLoading} />
                  </div>
                  {pfError && (
                    <div style={{ marginBottom: 14, padding: '9px 12px', borderRadius: 8, fontSize: 13, background: '#fff1f2', border: '1px solid #fda4af', color: '#9f1239' }}>
                      {pfError}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setShowParentForgot(false)} disabled={pfLoading}
                      style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>
                      Cancel
                    </button>
                    <button onClick={handleParentForgotSubmit} disabled={pfLoading}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                        cursor: pfLoading ? 'default' : 'pointer', opacity: pfLoading ? 0.6 : 1,
                        background: 'linear-gradient(135deg, #0d9488, #0f766e)', color: '#ffffff',
                        border: '1px solid rgba(15,118,110,0.3)',
                      }}>
                      {pfLoading ? 'Submitting…' : 'Submit Request'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          STAFF FORGOT PASSWORD MODAL
      ════════════════════════════════════════ */}
      {showForgot && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
        }} onClick={(e) => e.target === e.currentTarget && setShowForgot(false)}>
          <div style={{
            width: '100%', maxWidth: 380, borderRadius: 16, overflow: 'hidden',
            background: '#ffffff', boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          }}>
            {/* Accent bar */}
            <div style={{ height: 3, background: 'linear-gradient(90deg, #0d9488, #2dd4bf, #0d9488)' }} />

            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                    {fpSuccess ? 'Password Reset' : fpStep === 'otp' ? 'Enter Reset Code' : 'Reset Password'}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>
                    {fpSuccess
                      ? 'Your password has been updated'
                      : fpStep === 'otp'
                        ? `Code sent to ${fpEmail}`
                        : 'A reset code will be sent to your email'}
                  </p>
                </div>
                <button onClick={() => setShowForgot(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
              </div>
            </div>

            <div style={{ padding: '20px 24px 24px' }}>
              {fpSuccess ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ padding: '11px 13px', borderRadius: 8, fontSize: 13, background: '#f0fdfa', border: '1px solid #99f6e4', color: '#0f766e' }}>
                    {fpSuccess}
                  </div>
                  <button onClick={() => setShowForgot(false)}
                    style={{
                      width: '100%', padding: '11px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                      background: 'linear-gradient(135deg, #0d9488, #0f766e)', color: '#ffffff',
                      border: '1px solid rgba(15,118,110,0.3)',
                    }}>
                    Back to Login
                  </button>
                </div>
              ) : fpStep === 'form' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>School Code</label>
                    <input className="lmod-field" type="text" placeholder="Your school code"
                      value={fpCode} onChange={(e) => setFpCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleForgotSendOtp()}
                      autoCapitalize="none" autoCorrect="off" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email Address</label>
                    <input className="lmod-field" type="email" placeholder="Your registered email"
                      value={fpEmail} onChange={(e) => setFpEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleForgotSendOtp()}
                      autoCapitalize="none" autoCorrect="off" />
                  </div>
                  {fpError && (
                    <div style={{ padding: '9px 12px', borderRadius: 8, fontSize: 13, background: '#fff1f2', border: '1px solid #fda4af', color: '#9f1239' }}>
                      {fpError}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowForgot(false)}
                      style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>
                      Cancel
                    </button>
                    <button onClick={handleForgotSendOtp} disabled={fpLoading}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                        cursor: fpLoading ? 'default' : 'pointer', opacity: fpLoading ? 0.6 : 1,
                        background: 'linear-gradient(135deg, #0d9488, #0f766e)', color: '#ffffff',
                        border: '1px solid rgba(15,118,110,0.3)',
                      }}>
                      {fpLoading ? 'Sending…' : 'Send Code'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Verification Code</label>
                    <input className="lmod-field" type="text" placeholder="6-digit code from email"
                      value={fpOtp} onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      onKeyDown={(e) => e.key === 'Enter' && handleForgotReset()}
                      inputMode="numeric" autoComplete="one-time-code" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>New Password</label>
                    <input className="lmod-field" type="password" placeholder="At least 8 characters"
                      value={fpNewPassword} onChange={(e) => setFpNewPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleForgotReset()} />
                  </div>
                  {fpError && (
                    <div style={{ padding: '9px 12px', borderRadius: 8, fontSize: 13, background: '#fff1f2', border: '1px solid #fda4af', color: '#9f1239' }}>
                      {fpError}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setFpStep('form'); setFpError(null); }}
                      style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>
                      Back
                    </button>
                    <button onClick={handleForgotReset} disabled={fpLoading}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                        cursor: fpLoading ? 'default' : 'pointer', opacity: fpLoading ? 0.6 : 1,
                        background: 'linear-gradient(135deg, #0d9488, #0f766e)', color: '#ffffff',
                        border: '1px solid rgba(15,118,110,0.3)',
                      }}>
                      {fpLoading ? 'Resetting…' : 'Reset Password'}
                    </button>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <button type="button" className="lfgt" onClick={handleForgotSendOtp} disabled={fpLoading}>
                      Resend code
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
