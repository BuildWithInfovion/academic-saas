'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usePortalAuthStore } from '@/store/portal-auth.store';
import { getRoleRoute, PORTAL_ROLES, DASHBOARD_ROLES } from '@/lib/auth-utils';

type Phase = 'init' | 'zoom-in' | 'zoom-out' | 'greet' | 'reveal' | 'done';

const PARTICLES: { top?: string; bottom?: string; left?: string; right?: string; size: number; dur: string; delay: string }[] = [
  { top:'6%',  left:'8%',   size:3, dur:'9s',  delay:'0s'   },
  { top:'14%', right:'12%', size:2, dur:'13s', delay:'2.1s' },
  { top:'28%', left:'5%',   size:4, dur:'11s', delay:'0.8s' },
  { top:'42%', right:'7%',  size:2, dur:'8s',  delay:'3.4s' },
  { top:'57%', left:'11%',  size:3, dur:'12s', delay:'1.5s' },
  { top:'70%', right:'15%', size:2, dur:'7s',  delay:'4.2s' },
  { top:'83%', left:'7%',   size:4, dur:'14s', delay:'0.4s' },
  { top:'91%', right:'9%',  size:3, dur:'10s', delay:'2.8s' },
  { top:'22%', left:'47%',  size:2, dur:'16s', delay:'3.7s' },
  { top:'74%', left:'38%',  size:3, dur:'9s',  delay:'1.1s' },
  { top:'38%', left:'28%',  size:2, dur:'11s', delay:'5s'   },
  { top:'60%', right:'32%', size:2, dur:'8s',  delay:'0.6s' },
];

const getLogoTransition = (phase: Phase): string => {
  if (phase === 'init')     return 'none';
  if (phase === 'zoom-in')  return 'transform 0.72s cubic-bezier(0.34,1.56,0.64,1)';
  if (phase === 'zoom-out') return 'transform 1.6s cubic-bezier(0.25,0.46,0.45,0.94)';
  return 'transform 0.9s ease';
};

const getLogoTransform = (phase: Phase): string => {
  switch (phase) {
    case 'init':     return 'scale(0)';
    case 'zoom-in':  return 'scale(2.4)';
    case 'zoom-out': return 'scale(1)';
    case 'greet':    return 'translateY(-56px) scale(0.82)';
    case 'reveal':   return 'translateY(-64px) scale(0.78)';
    default:         return 'scale(1)';
  }
};

export default function LoginPage() {
  const router  = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [logoError, setLogoError] = useState(false);
  const [phase,     setPhase]     = useState<Phase>('init');

  // Tab + step
  const [activeTab, setActiveTab] = useState<'staff' | 'parent'>('staff');
  const [staffStep, setStaffStep] = useState<1 | 2>(1);

  // Staff step-1 fields
  const [institutionCode, setInstitutionCode] = useState('');
  const [staffEmail,      setStaffEmail]      = useState('');
  const [staffPassword,   setStaffPassword]   = useState('');

  // Staff step-2 TOTP
  const [totpToken,  setTotpToken]  = useState<string | null>(null);
  const [totpDigits, setTotpDigits] = useState(['', '', '', '', '', '']);
  const totpRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null, null]);

  // Parent fields
  const [parentPhone,    setParentPhone]    = useState('');
  const [parentPassword, setParentPassword] = useState('');

  // Shared
  const [loading,     setLoading]     = useState(false);
  const [loadStep,    setLoadStep]    = useState(0);
  const [error,       setError]       = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ institution: string } | null>(null);

  // Forgot-password modal
  const [showForgot,     setShowForgot]     = useState(false);
  const [fpStep,         setFpStep]         = useState<'form' | 'otp'>('form');
  const [fpCode,         setFpCode]         = useState('');
  const [fpEmail,        setFpEmail]        = useState('');
  const [fpOtp,          setFpOtp]          = useState('');
  const [fpNewPassword,  setFpNewPassword]  = useState('');
  const [fpLoading,      setFpLoading]      = useState(false);
  const [fpError,        setFpError]        = useState<string | null>(null);
  const [fpSuccess,      setFpSuccess]      = useState<string | null>(null);

  // Intro animation
  useEffect(() => {
    const r  = requestAnimationFrame(() => setPhase('zoom-in'));
    const t1 = setTimeout(() => setPhase('zoom-out'), 900);
    const t2 = setTimeout(() => setPhase('greet'),    2700);
    const t3 = setTimeout(() => setPhase('reveal'),   3900);
    const t4 = setTimeout(() => setPhase('done'),     4700);
    return () => { cancelAnimationFrame(r); [t1, t2, t3, t4].forEach(clearTimeout); };
  }, []);

  const api = (path: string) =>
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}${path}`;

  // ── Shared session handler ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applySession = async (data: any, fallbackCode: string) => {
    const roles: string[] = data.user?.roles ?? [];
    const authPayload = {
      accessToken: data.accessToken as string,
      user: {
        email: (data.user.email ?? '') as string,
        phone: data.user.phone as string | undefined,
        institutionId: data.user.institutionId as string,
        institutionName: data.user.institutionName as string | undefined,
        roles,
      },
    };
    const isDashboard = (DASHBOARD_ROLES as string[]).some((r) => roles.includes(r));
    if (isDashboard) { setAuth(authPayload); } else { usePortalAuthStore.getState().setAuth(authPayload); }
    setLoadStep(3);
    const portalRoles = roles.filter((r) => (PORTAL_ROLES as readonly string[]).includes(r));
    const destination  = portalRoles.length > 1 ? '/portal/select-role' : getRoleRoute(roles);
    setSuccessInfo({ institution: data.user.institutionName || fallbackCode });
    await new Promise<void>((resolve) => setTimeout(resolve, 5500));
    router.push(destination);
  };

  // ── Staff login (step 1: email + password) ────────────────────────────────
  const handleStaffLogin = async () => {
    if (!institutionCode.trim()) return setError('School code is required');
    if (!staffEmail.trim())      return setError('Email is required');
    if (!staffPassword.trim())   return setError('Password is required');
    setLoading(true); setLoadStep(1); setError(null);
    try {
      const res = await fetch(api('/auth/login'), {
        method: 'POST',
        credentials: 'include',
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

      // TOTP required — move to step 2
      if (data.requiresTOTP) {
        setTotpToken(data.totpToken);
        setStaffStep(2);
        setLoading(false);
        setLoadStep(0);
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

  // ── TOTP verification (step 2) ────────────────────────────────────────────
  const handleTotpVerify = async () => {
    const code = totpDigits.join('');
    if (code.length < 6)  return setError('Enter the complete 6-digit code');
    if (!totpToken)        return setError('Session expired — please sign in again');
    setLoading(true); setLoadStep(1); setError(null);
    try {
      const res = await fetch(api('/auth/totp/authenticate'), {
        method: 'POST',
        credentials: 'include',
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

  // ── TOTP input helpers ────────────────────────────────────────────────────
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
      const focus = Math.min(text.length, 5);
      totpRefs.current[focus]?.focus();
    }
    e.preventDefault();
  };

  // ── Parent login ──────────────────────────────────────────────────────────
  const handleParentLogin = async () => {
    if (!parentPhone.trim())    return setError('Phone number is required');
    if (!parentPassword.trim()) return setError('Password is required');
    setLoading(true); setLoadStep(1); setError(null);
    try {
      const res = await fetch(api('/auth/parent/login'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: parentPhone.trim(), password: parentPassword }),
      });
      setLoadStep(2);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || 'Login failed');
      if (!data.accessToken) throw new Error('No token received');
      usePortalAuthStore.getState().setAuth({
        accessToken: data.accessToken,
        user: {
          email: data.user.email,
          phone: data.user.phone,
          institutionId: data.user.institutionId,
          institutionName: data.user.institutionName,
          roles: data.user.roles ?? [],
        },
      });
      setLoadStep(3);
      setSuccessInfo({ institution: data.user.institutionName || 'Welcome' });
      await new Promise<void>((resolve) => setTimeout(resolve, 5500));
      router.push('/portal/parent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoadStep(0);
    } finally {
      setLoading(false);
    }
  };

  // ── Misc ──────────────────────────────────────────────────────────────────
  const switchTab = (tab: 'staff' | 'parent') => {
    setActiveTab(tab);
    setStaffStep(1);
    setTotpToken(null);
    setTotpDigits(['', '', '', '', '', '']);
    setError(null);
  };

  const openForgot = () => {
    setFpCode(institutionCode);
    setFpEmail('');
    setFpOtp('');
    setFpNewPassword('');
    setFpStep('form');
    setFpError(null);
    setFpSuccess(null);
    setShowForgot(true);
  };

  // ── Forgot password: send OTP ─────────────────────────────────────────────
  const handleForgotSendOtp = async () => {
    if (!fpCode.trim())  return setFpError('School code is required');
    if (!fpEmail.trim()) return setFpError('Email is required');
    setFpLoading(true); setFpError(null);
    try {
      const res = await fetch(api('/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionCode: fpCode.trim().toLowerCase(),
          email: fpEmail.trim(),
        }),
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

  // ── Forgot password: verify OTP + set new password ────────────────────────
  const handleForgotReset = async () => {
    if (!fpOtp.trim())         return setFpError('Verification code is required');
    if (!fpNewPassword.trim()) return setFpError('New password is required');
    if (fpNewPassword.length < 8) return setFpError('Password must be at least 8 characters');
    setFpLoading(true); setFpError(null);
    try {
      const res = await fetch(api('/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionCode: fpCode.trim().toLowerCase(),
          email: fpEmail.trim(),
          otp: fpOtp.trim(),
          newPassword: fpNewPassword,
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

  const welcomeVisible = phase === 'greet' || phase === 'reveal';
  const showOverlay    = phase !== 'done';
  const showCard       = phase === 'reveal' || phase === 'done';

  // ── Card heading / subtext ────────────────────────────────────────────────
  const cardHeading = activeTab === 'parent'
    ? 'Parent Login'
    : staffStep === 2 ? 'Two-Factor Auth' : 'Staff Login';

  const cardSub = activeTab === 'parent'
    ? 'Enter your phone number and password'
    : staffStep === 2
      ? 'Enter the 6-digit code from your authenticator app'
      : 'Enter your school code and credentials';

  return (
    <div style={{ minHeight:'100vh', background:'#060402', position:'relative', overflow:'hidden',
      display:'flex', alignItems:'center', justifyContent:'center' }}>

      {/* ─── Component-scoped styles ─── */}
      <style>{`
        @keyframes loginParticleDrift {
          0%, 100% { transform: translateY(0px) scale(1);   opacity: 0; }
          10%, 90% { opacity: 1; }
          50%      { transform: translateY(-55px) scale(1.1); opacity: 0.55; }
        }
        @keyframes loginCardReveal {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes loginGlowBreathe {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50%      { opacity: 0.75; transform: scale(1.14); }
        }
        @keyframes loginArcSpin    { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
        @keyframes loginArcSpinRev { from { transform: rotate(0deg);   } to { transform: rotate(-360deg); } }
        @keyframes loginWelcomeIn  {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes loginShimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes cardBorderPulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
        @keyframes successBgIn     { from { opacity: 0; } to { opacity: 1; } }
        @keyframes successCircleIn {
          0%   { transform: scale(0);    opacity: 0; }
          60%  { transform: scale(1.12); opacity: 1; }
          80%  { transform: scale(0.96); }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes successRingOut  { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2.8); opacity: 0; } }
        @keyframes successCheckDraw {
          from { stroke-dashoffset: 80; opacity: 0; }
          15%  { opacity: 1; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes successTextIn   { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes successDot {
          0%, 70%, 100% { transform: translateY(0px);  opacity: 0.28; }
          35%            { transform: translateY(-7px); opacity: 1; }
        }
        @keyframes successBarFill  { from { width: 0%; } to { width: 100%; } }
        @keyframes totpReveal      { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .login-btn {
          transition: background 0.22s ease, box-shadow 0.22s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        .login-btn:not(:disabled):hover {
          background: linear-gradient(135deg, #c5692e 0%, #ae5525 100%) !important;
          box-shadow: 0 6px 28px rgba(174,85,37,0.52), 0 2px 8px rgba(0,0,0,0.25) !important;
          transform: translateY(-2px) scale(1.01) !important;
        }
        .login-btn:not(:disabled):active {
          transform: translateY(0) scale(0.98) !important;
          box-shadow: 0 2px 10px rgba(174,85,37,0.3) !important;
        }

        .ldf {
          width: 100%; padding: 10px 12px 10px 36px;
          font-size: 14px; border: 1px solid rgba(220,146,75,0.18);
          border-radius: 9px; color: #f0e6d3;
          background: rgba(255,255,255,0.04);
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s; outline: none;
          box-sizing: border-box;
        }
        .ldf::placeholder { color: rgba(174,112,64,0.32); }
        .ldf:hover  { background: rgba(255,255,255,0.065); border-color: rgba(220,146,75,0.38); }
        .ldf:focus  { background: rgba(255,255,255,0.07); border-color: #dc924b; box-shadow: 0 0 0 3px rgba(220,146,75,0.14), inset 0 1px 0 rgba(255,255,255,0.04); }
        .ldf:disabled { opacity: 0.35; cursor: not-allowed; }

        .ldf-plain {
          width: 100%; padding: 10px 12px;
          font-size: 14px; border: 1px solid rgba(220,146,75,0.18);
          border-radius: 9px; color: #f0e6d3;
          background: rgba(255,255,255,0.04);
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s; outline: none;
          box-sizing: border-box;
        }
        .ldf-plain::placeholder { color: rgba(174,112,64,0.32); }
        .ldf-plain:hover  { background: rgba(255,255,255,0.065); border-color: rgba(220,146,75,0.38); }
        .ldf-plain:focus  { background: rgba(255,255,255,0.07); border-color: #dc924b; box-shadow: 0 0 0 3px rgba(220,146,75,0.14); }

        .otp-cell {
          width: 44px; height: 52px; border-radius: 10px;
          border: 1.5px solid rgba(220,146,75,0.22);
          background: rgba(255,255,255,0.04);
          color: #f7c576; font-size: 22px; font-weight: 600;
          text-align: center; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          caret-color: transparent;
        }
        .otp-cell::placeholder { color: rgba(174,112,64,0.18); font-size: 16px; }
        .otp-cell:hover  { background: rgba(255,255,255,0.065); border-color: rgba(220,146,75,0.42); }
        .otp-cell:focus  { background: rgba(255,255,255,0.07); border-color: #dc924b; box-shadow: 0 0 0 3px rgba(220,146,75,0.15); }
        .otp-cell.filled { border-color: rgba(220,146,75,0.55); background: rgba(220,146,75,0.06); }
        .otp-cell:disabled { opacity: 0.35; cursor: not-allowed; }

        .welcome-shimmer {
          background: linear-gradient(90deg, #f7c576 0%, #fffbe8 45%, #f7c576 80%);
          background-size: 220% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          animation: loginShimmer 3.8s linear infinite;
        }

        .tab-btn {
          flex: 1; padding: 8px 0; font-size: 13px; font-weight: 600;
          border-radius: 8px; cursor: pointer; border: none;
          transition: all 0.2s ease; letter-spacing: 0.02em;
        }
        .tab-btn.active {
          background: linear-gradient(135deg, rgba(174,85,37,0.7), rgba(140,57,25,0.7));
          color: #f7c576;
          box-shadow: 0 2px 10px rgba(174,85,37,0.28);
        }
        .tab-btn.inactive {
          background: transparent; color: rgba(174,112,64,0.5);
        }
        .tab-btn.inactive:hover { color: rgba(220,146,75,0.8); background: rgba(255,255,255,0.04); }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* ─── Ambient background glows ─── */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0 }}>
        <div style={{ position:'absolute', top:'-12%', left:'-8%', width:640, height:640,
          borderRadius:'50%', filter:'blur(130px)',
          background:'radial-gradient(circle, rgba(220,146,75,0.11) 0%, transparent 70%)',
          animation:'loginGlowBreathe 9s ease-in-out infinite' }} />
        <div style={{ position:'absolute', bottom:'-12%', right:'-8%', width:560, height:560,
          borderRadius:'50%', filter:'blur(110px)',
          background:'radial-gradient(circle, rgba(174,85,37,0.09) 0%, transparent 70%)',
          animation:'loginGlowBreathe 13s ease-in-out infinite', animationDelay:'5s' }} />
        <div style={{ position:'absolute', top:'38%', right:'18%', width:360, height:360,
          borderRadius:'50%', filter:'blur(90px)',
          background:'radial-gradient(circle, rgba(247,197,118,0.06) 0%, transparent 70%)',
          animation:'loginGlowBreathe 11s ease-in-out infinite', animationDelay:'2.5s' }} />
      </div>

      {/* ─── Arc rings ─── */}
      <div style={{ position:'fixed', top:-130, left:-130, width:440, height:440,
        borderRadius:'50%', border:'1px solid rgba(220,146,75,0.055)',
        pointerEvents:'none', zIndex:1, animation:'loginArcSpin 70s linear infinite' }} />
      <div style={{ position:'fixed', top:-80,  left:-80,  width:280, height:280,
        borderRadius:'50%', border:'0.5px dashed rgba(220,146,75,0.04)',
        pointerEvents:'none', zIndex:1, animation:'loginArcSpinRev 45s linear infinite' }} />
      <div style={{ position:'fixed', bottom:-110, right:-110, width:400, height:400,
        borderRadius:'50%', border:'1px solid rgba(220,146,75,0.05)',
        pointerEvents:'none', zIndex:1, animation:'loginArcSpinRev 55s linear infinite' }} />
      <div style={{ position:'fixed', bottom:-60,  right:-60,  width:250, height:250,
        borderRadius:'50%', border:'0.5px dashed rgba(174,85,37,0.04)',
        pointerEvents:'none', zIndex:1, animation:'loginArcSpin 38s linear infinite' }} />

      {/* ─── Floating particles ─── */}
      {PARTICLES.map((p, i) => {
        const pos: Record<string, string> = {};
        if (p.top)    pos.top    = p.top;
        if (p.bottom) pos.bottom = p.bottom;
        if (p.left)   pos.left   = p.left;
        if (p.right)  pos.right  = p.right;
        return (
          <div key={i} style={{
            position:'fixed', ...pos,
            width:p.size, height:p.size, borderRadius:'50%',
            background: i%3===0 ? 'rgba(247,197,118,0.55)' : i%3===1 ? 'rgba(220,146,75,0.45)' : 'rgba(174,85,37,0.38)',
            boxShadow: `0 0 ${p.size*3}px rgba(220,146,75,0.4)`,
            pointerEvents:'none', zIndex:2,
            animation:`loginParticleDrift ${p.dur} ease-in-out infinite`,
            animationDelay: p.delay,
          }} />
        );
      })}

      {/* ══════════════════════════════════════════════════
          INTRO OVERLAY
      ══════════════════════════════════════════════════ */}
      {showOverlay && (
        <div style={{
          position:'fixed', inset:0, zIndex:50,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          background:'#060402',
          opacity: phase === 'reveal' ? 0 : 1,
          transition: phase === 'reveal' ? 'opacity 0.72s ease' : 'none',
          pointerEvents: phase === 'reveal' ? 'none' : 'auto',
        }}>
          <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
            <div style={{ position:'absolute', top:'-10%', left:'-5%', width:600, height:600,
              borderRadius:'50%', filter:'blur(120px)',
              background:'radial-gradient(circle, rgba(220,146,75,0.14) 0%, transparent 70%)' }} />
            <div style={{ position:'absolute', bottom:'-10%', right:'-5%', width:520, height:520,
              borderRadius:'50%', filter:'blur(110px)',
              background:'radial-gradient(circle, rgba(174,85,37,0.10) 0%, transparent 70%)' }} />
          </div>
          <div style={{
            position:'relative', zIndex:1, marginBottom:36,
            transform: getLogoTransform(phase),
            transition: getLogoTransition(phase),
          }}>
            {!logoError ? (
              <Image src="/logo.png" alt="Infovion" width={200} height={200}
                style={{ objectFit:'contain', width:'auto', maxHeight:180, display:'block' }}
                onError={() => setLogoError(true)} />
            ) : (
              <div style={{ textAlign:'center' }}>
                <p style={{ color:'#f7c576', fontWeight:700, fontSize:'2.8rem', letterSpacing:'0.14em' }}>INFOVION</p>
                <p style={{ color:'rgba(174,112,64,0.45)', fontSize:'0.8rem', letterSpacing:'0.1em', marginTop:5 }}>ACADEMIC SAAS</p>
              </div>
            )}
          </div>
          <div style={{
            position:'relative', zIndex:1, textAlign:'center',
            opacity: welcomeVisible ? 1 : 0,
            transform: welcomeVisible ? 'translateY(0)' : 'translateY(18px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
          }}>
            <h1 style={{ margin:0, fontWeight:300, fontSize:'clamp(1.35rem,4vw,2.1rem)', letterSpacing:'0.22em', textTransform:'uppercase' }}>
              <span className="welcome-shimmer">Welcome to Infovion</span>
            </h1>
            <div style={{ height:1, background:'linear-gradient(to right,transparent,rgba(247,197,118,0.28),transparent)',
              margin:'18px auto 0', width:280, maxWidth:'80vw' }} />
            <p style={{ color:'rgba(174,112,64,0.45)', fontSize:12, letterSpacing:'0.12em',
              textTransform:'uppercase', marginTop:12 }}>
              Intelligent School Management
            </p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          LOGIN CARD
      ══════════════════════════════════════════════════ */}
      {showCard && (
        <div style={{
          position:'relative', zIndex:30, width:'100%', maxWidth:430,
          padding:'0 16px',
          animation:'loginCardReveal 0.62s cubic-bezier(0.25,0.46,0.45,0.94) forwards',
        }}>
          <div style={{
            background:'linear-gradient(160deg, rgba(28,14,6,0.96) 0%, rgba(18,9,3,0.97) 100%)',
            border:'1px solid rgba(220,146,75,0.2)',
            borderRadius:22,
            padding:'0 0 32px',
            boxShadow:'0 48px 100px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(220,146,75,0.08), 0 0 80px rgba(220,146,75,0.06)',
            backdropFilter:'blur(32px)',
            WebkitBackdropFilter:'blur(32px)',
            overflow:'hidden',
            position:'relative',
          }}>
            {/* Gold top accent bar */}
            <div style={{ height:2, background:'linear-gradient(90deg, transparent 0%, rgba(220,146,75,0.5) 30%, rgba(247,197,118,0.9) 50%, rgba(220,146,75,0.5) 70%, transparent 100%)', animation:'cardBorderPulse 4s ease-in-out infinite' }} />
            {/* Inner top highlight */}
            <div style={{ position:'absolute', top:2, left:0, right:0, height:60, background:'linear-gradient(180deg, rgba(220,146,75,0.04) 0%, transparent 100%)', pointerEvents:'none' }} />

            <div style={{ padding:'28px 32px 0' }}>

              {/* Card logo */}
              <div style={{ textAlign:'center', marginBottom:22 }}>
                {!logoError ? (
                  <Image src="/logo.png" alt="Infovion" width={90} height={90}
                    style={{ objectFit:'contain', width:'auto', maxHeight:56, margin:'0 auto', display:'block' }}
                    onError={() => setLogoError(true)} />
                ) : (
                  <p style={{ color:'#f7c576', fontWeight:700, fontSize:'1.25rem', letterSpacing:'0.1em', margin:0 }}>INFOVION</p>
                )}
                <p style={{ color:'rgba(174,112,64,0.4)', fontSize:10.5, letterSpacing:'0.14em',
                  textTransform:'uppercase', margin:'6px 0 0' }}>Academic Management</p>
              </div>

              {/* Thin divider */}
              <div style={{ height:'0.5px', background:'linear-gradient(to right, transparent, rgba(220,146,75,0.18), transparent)', marginBottom:20 }} />

              {/* ── Tab switcher ── */}
              <div style={{
                display:'flex', gap:4, padding:'4px',
                background:'rgba(255,255,255,0.03)',
                border:'1px solid rgba(220,146,75,0.12)',
                borderRadius:11, marginBottom:24,
              }}>
                <button className={`tab-btn ${activeTab === 'staff' ? 'active' : 'inactive'}`}
                  onClick={() => switchTab('staff')} disabled={loading}>
                  School Staff
                </button>
                <button className={`tab-btn ${activeTab === 'parent' ? 'active' : 'inactive'}`}
                  onClick={() => switchTab('parent')} disabled={loading}>
                  Parent
                </button>
              </div>

              {/* ── Heading ── */}
              <div style={{ marginBottom:20 }}>
                <h2 style={{ margin:0, color:'#f5ede0', fontWeight:600, fontSize:19.5, letterSpacing:'-0.025em' }}>
                  {cardHeading}
                </h2>
                <p style={{ margin:'5px 0 0', color:'rgba(174,112,64,0.5)', fontSize:13 }}>
                  {cardSub}
                </p>
              </div>

              {/* ════════════════════════════════════════
                  SCHOOL STAFF TAB
              ════════════════════════════════════════ */}
              {activeTab === 'staff' && (
                <>
                  {/* Step 1: school code + email + password */}
                  {staffStep === 1 && (
                    <div style={{ display:'flex', flexDirection:'column', gap:15 }}>
                      <div>
                        <label style={{ display:'block', fontSize:11.5, fontWeight:600, marginBottom:6,
                          color:'rgba(220,146,75,0.75)', letterSpacing:'0.05em', textTransform:'uppercase' }}>
                          School Code
                        </label>
                        <div style={{ position:'relative' }}>
                          <div style={{ position:'absolute', top:0, bottom:0, left:11, display:'flex',
                            alignItems:'center', pointerEvents:'none', color:'rgba(107,67,47,0.4)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                            </svg>
                          </div>
                          <input className="ldf" type="text" placeholder="Your school code"
                            value={institutionCode} onChange={(e) => setInstitutionCode(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleStaffLogin()}
                            disabled={loading} autoCapitalize="none" autoCorrect="off" />
                        </div>
                      </div>

                      <div>
                        <label style={{ display:'block', fontSize:11.5, fontWeight:600, marginBottom:6,
                          color:'rgba(220,146,75,0.75)', letterSpacing:'0.05em', textTransform:'uppercase' }}>
                          Email Address
                        </label>
                        <div style={{ position:'relative' }}>
                          <div style={{ position:'absolute', top:0, bottom:0, left:11, display:'flex',
                            alignItems:'center', pointerEvents:'none', color:'rgba(107,67,47,0.4)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                            </svg>
                          </div>
                          <input className="ldf" type="email" placeholder="Your email address"
                            value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleStaffLogin()}
                            disabled={loading} autoCapitalize="none" autoCorrect="off" />
                        </div>
                      </div>

                      <div>
                        <label style={{ display:'block', fontSize:11.5, fontWeight:600, marginBottom:6,
                          color:'rgba(220,146,75,0.75)', letterSpacing:'0.05em', textTransform:'uppercase' }}>
                          Password
                        </label>
                        <div style={{ position:'relative' }}>
                          <div style={{ position:'absolute', top:0, bottom:0, left:11, display:'flex',
                            alignItems:'center', pointerEvents:'none', color:'rgba(107,67,47,0.4)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                          </div>
                          <input className="ldf" type="password" placeholder="Your password"
                            value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleStaffLogin()}
                            disabled={loading} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: TOTP code */}
                  {staffStep === 2 && (
                    <div style={{ animation:'totpReveal 0.35s ease forwards' }}>
                      {/* Authenticator hint */}
                      <div style={{
                        marginBottom:16, padding:'10px 14px', borderRadius:9, fontSize:12.5,
                        background:'rgba(220,146,75,0.07)', border:'1px solid rgba(220,146,75,0.18)',
                        color:'rgba(220,146,75,0.7)', display:'flex', alignItems:'center', gap:8,
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                        </svg>
                        Open your authenticator app and enter the current code
                      </div>

                      {/* TOTP 6-cell input */}
                      <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:6 }}
                        onPaste={handleTotpPaste}>
                        {totpDigits.map((digit, i) => (
                          <input
                            key={i}
                            ref={(el) => { totpRefs.current[i] = el; }}
                            className={`otp-cell${digit ? ' filled' : ''}`}
                            type="text" inputMode="numeric" pattern="[0-9]*"
                            maxLength={1} value={digit} placeholder="·"
                            onChange={(e) => handleTotpChange(i, e.target.value)}
                            onKeyDown={(e) => handleTotpKeyDown(i, e)}
                            disabled={loading}
                          />
                        ))}
                      </div>

                      {/* Back link */}
                      <div style={{ marginTop:14 }}>
                        <button type="button"
                          onClick={() => {
                            setStaffStep(1);
                            setTotpToken(null);
                            setTotpDigits(['','','','','','']);
                            setError(null);
                          }}
                          style={{ fontSize:12, color:'rgba(174,112,64,0.5)', background:'none', border:'none',
                            cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:4 }}
                          onMouseEnter={(e) => (e.currentTarget.style.color='rgba(220,146,75,0.8)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color='rgba(174,112,64,0.5)')}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6"/>
                          </svg>
                          Back to login
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div style={{ marginTop:14, padding:'10px 13px', borderRadius:8, fontSize:13,
                      background:'rgba(155,34,38,0.18)', border:'1px solid rgba(155,34,38,0.32)', color:'#ff9090' }}>
                      {error}
                    </div>
                  )}

                  {/* Action button */}
                  {staffStep === 1 ? (
                    <button onClick={handleStaffLogin} disabled={loading} className="login-btn"
                      style={{
                        marginTop:18, width:'100%', padding:'12px',
                        fontSize:14.5, fontWeight:600, borderRadius:10, cursor: loading ? 'default' : 'pointer',
                        background: loading ? 'rgba(174,85,37,0.55)' : 'linear-gradient(135deg, #ae5525 0%, #8c3919 100%)',
                        color:'#fcfbf7', border:'1px solid rgba(140,57,25,0.35)',
                        boxShadow: loading ? 'none' : '0 2px 16px rgba(174,85,37,0.38)',
                      }}>
                      {loading ? (
                        <span style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                          <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <svg style={{ width:16, height:16, animation:'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30" strokeLinecap="round"/>
                            </svg>
                            {loadStep === 1 && 'Verifying credentials…'}
                            {loadStep === 2 && 'Authenticating…'}
                            {loadStep === 3 && 'Logging you in…'}
                          </span>
                          <span style={{ display:'flex', gap:4 }}>
                            {[1,2,3].map((s) => (
                              <span key={s} style={{ display:'inline-block', borderRadius:999, transition:'all 0.3s',
                                width: loadStep >= s ? 20 : 6, height:4,
                                background: loadStep >= s ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.28)' }} />
                            ))}
                          </span>
                        </span>
                      ) : (
                        <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                          Sign In
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                          </svg>
                        </span>
                      )}
                    </button>
                  ) : (
                    <button onClick={handleTotpVerify} disabled={loading} className="login-btn"
                      style={{
                        marginTop:18, width:'100%', padding:'12px',
                        fontSize:14.5, fontWeight:600, borderRadius:10, cursor: loading ? 'default' : 'pointer',
                        background: loading ? 'rgba(174,85,37,0.55)' : 'linear-gradient(135deg, #ae5525 0%, #8c3919 100%)',
                        color:'#fcfbf7', border:'1px solid rgba(140,57,25,0.35)',
                        boxShadow: loading ? 'none' : '0 2px 16px rgba(174,85,37,0.38)',
                      }}>
                      {loading ? (
                        <span style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                          <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <svg style={{ width:16, height:16, animation:'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30" strokeLinecap="round"/>
                            </svg>
                            {loadStep === 1 && 'Verifying code…'}
                            {loadStep === 2 && 'Authenticating…'}
                            {loadStep === 3 && 'Logging you in…'}
                          </span>
                          <span style={{ display:'flex', gap:4 }}>
                            {[1,2,3].map((s) => (
                              <span key={s} style={{ display:'inline-block', borderRadius:999, transition:'all 0.3s',
                                width: loadStep >= s ? 20 : 6, height:4,
                                background: loadStep >= s ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.28)' }} />
                            ))}
                          </span>
                        </span>
                      ) : (
                        <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                          Verify &amp; Sign In
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                          </svg>
                        </span>
                      )}
                    </button>
                  )}

                  {/* Forgot password link — only on step 1 */}
                  {staffStep === 1 && (
                    <div style={{ textAlign:'center', marginTop:14 }}>
                      <button type="button" onClick={openForgot}
                        style={{ fontSize:12, fontWeight:500, color:'rgba(220,146,75,0.5)',
                          background:'none', border:'none', cursor:'pointer', padding:0 }}
                        onMouseEnter={(e) => (e.currentTarget.style.color='#f7c576')}
                        onMouseLeave={(e) => (e.currentTarget.style.color='rgba(220,146,75,0.5)')}>
                        Forgot password?
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ════════════════════════════════════════
                  PARENT TAB
              ════════════════════════════════════════ */}
              {activeTab === 'parent' && (
                <>
                  <div style={{ display:'flex', flexDirection:'column', gap:15 }}>
                    <div>
                      <label style={{ display:'block', fontSize:11.5, fontWeight:600, marginBottom:6,
                        color:'rgba(220,146,75,0.75)', letterSpacing:'0.05em', textTransform:'uppercase' }}>
                        Phone Number
                      </label>
                      <div style={{ position:'relative' }}>
                        <div style={{ position:'absolute', top:0, bottom:0, left:11, display:'flex',
                          alignItems:'center', pointerEvents:'none', color:'rgba(107,67,47,0.4)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.13 1 .38 1.97.74 2.91a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 5.16 5.16l.96-.96a2 2 0 0 1 2.11-.45c.94.36 1.92.61 2.91.74A2 2 0 0 1 22 16.92z"/>
                          </svg>
                        </div>
                        <input className="ldf" type="tel" placeholder="Your registered phone number"
                          value={parentPhone} onChange={(e) => setParentPhone(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleParentLogin()}
                          disabled={loading} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display:'block', fontSize:11.5, fontWeight:600, marginBottom:6,
                        color:'rgba(220,146,75,0.75)', letterSpacing:'0.05em', textTransform:'uppercase' }}>
                        Password
                      </label>
                      <div style={{ position:'relative' }}>
                        <div style={{ position:'absolute', top:0, bottom:0, left:11, display:'flex',
                          alignItems:'center', pointerEvents:'none', color:'rgba(107,67,47,0.4)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                        </div>
                        <input className="ldf" type="password" placeholder="••••••••"
                          value={parentPassword} onChange={(e) => setParentPassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleParentLogin()}
                          disabled={loading} />
                      </div>
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div style={{ marginTop:14, padding:'10px 13px', borderRadius:8, fontSize:13,
                      background:'rgba(155,34,38,0.18)', border:'1px solid rgba(155,34,38,0.32)', color:'#ff9090' }}>
                      {error}
                    </div>
                  )}

                  <button onClick={handleParentLogin} disabled={loading} className="login-btn"
                    style={{
                      marginTop:18, width:'100%', padding:'12px',
                      fontSize:14.5, fontWeight:600, borderRadius:10, cursor: loading ? 'default' : 'pointer',
                      background: loading ? 'rgba(174,85,37,0.55)' : 'linear-gradient(135deg, #ae5525 0%, #8c3919 100%)',
                      color:'#fcfbf7', border:'1px solid rgba(140,57,25,0.35)',
                      boxShadow: loading ? 'none' : '0 2px 16px rgba(174,85,37,0.38)',
                    }}>
                    {loading ? (
                      <span style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                        <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <svg style={{ width:16, height:16, animation:'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30" strokeLinecap="round"/>
                          </svg>
                          {loadStep === 1 && 'Verifying credentials…'}
                          {loadStep === 2 && 'Authenticating…'}
                          {loadStep === 3 && 'Logging you in…'}
                        </span>
                        <span style={{ display:'flex', gap:4 }}>
                          {[1,2,3].map((s) => (
                            <span key={s} style={{ display:'inline-block', borderRadius:999, transition:'all 0.3s',
                              width: loadStep >= s ? 20 : 6, height:4,
                              background: loadStep >= s ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.28)' }} />
                          ))}
                        </span>
                      </span>
                    ) : (
                      <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                        Sign In
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                        </svg>
                      </span>
                    )}
                  </button>
                </>
              )}

            </div>{/* /inner padding */}
          </div>{/* /card */}

          {/* Footer */}
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.22)', fontSize:11,
            letterSpacing:'0.04em', marginTop:20 }}>
            © {new Date().getFullYear()} Infovion. All rights reserved.
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          FORGOT PASSWORD MODAL
      ══════════════════════════════════════════════════ */}
      {showForgot && (
        <div style={{
          position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'center', justifyContent:'center',
          padding:16, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)',
          WebkitBackdropFilter:'blur(8px)',
        }}
          onClick={(e) => e.target === e.currentTarget && setShowForgot(false)}>
          <div style={{
            width:'100%', maxWidth:380, borderRadius:18, overflow:'hidden',
            background:'linear-gradient(160deg, rgba(28,14,6,0.98) 0%, rgba(18,9,3,0.99) 100%)',
            border:'1px solid rgba(220,146,75,0.18)',
            boxShadow:'0 32px 80px rgba(0,0,0,0.75)',
            animation:'loginCardReveal 0.4s ease forwards',
          }}>
            <div style={{ padding:'20px 24px 18px',
              background:'linear-gradient(135deg, rgba(29,16,6,0.95), rgba(40,22,8,0.95))',
              borderBottom:'1px solid rgba(220,146,75,0.1)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
                  background:'rgba(220,146,75,0.15)', border:'1px solid rgba(220,146,75,0.25)', fontSize:16 }}>🔑</div>
                <div>
                  <h2 style={{ margin:0, color:'#f5ede0', fontSize:14, fontWeight:600 }}>
                    {fpSuccess ? 'Password Reset' : fpStep === 'otp' ? 'Enter Reset Code' : 'Reset Password'}
                  </h2>
                  <p style={{ margin:'3px 0 0', color:'rgba(174,112,64,0.5)', fontSize:12 }}>
                    {fpSuccess
                      ? 'Your password has been updated'
                      : fpStep === 'otp'
                        ? `Code sent to ${fpEmail}`
                        : 'A reset code will be sent to your email'}
                  </p>
                </div>
              </div>
            </div>
            <div style={{ padding:'20px 24px 24px' }}>
              {fpSuccess ? (
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div style={{ padding:'11px 13px', borderRadius:8, fontSize:13,
                    background:'rgba(26,95,60,0.2)', border:'1px solid rgba(26,95,60,0.35)', color:'#6ee7b7' }}>
                    {fpSuccess}
                  </div>
                  <button onClick={() => setShowForgot(false)} style={{
                    width:'100%', padding:'11px', borderRadius:8, fontWeight:600, fontSize:14, cursor:'pointer',
                    background:'linear-gradient(135deg,#ae5525,#8c3919)', color:'#fcfbf7',
                    border:'1px solid rgba(140,57,25,0.35)', boxShadow:'0 2px 8px rgba(174,85,37,0.3)',
                  }}>Back to Login</button>
                </div>
              ) : fpStep === 'form' ? (
                /* ── Step 1: enter school code + email ── */
                <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
                  <div>
                    <label style={{ display:'block', fontSize:11.5, fontWeight:600, marginBottom:6,
                      color:'rgba(220,146,75,0.75)', letterSpacing:'0.05em', textTransform:'uppercase' }}>
                      School Code
                    </label>
                    <input className="ldf-plain" type="text" placeholder="Your school code"
                      value={fpCode} onChange={(e) => setFpCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleForgotSendOtp()}
                      autoCapitalize="none" autoCorrect="off" />
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11.5, fontWeight:600, marginBottom:6,
                      color:'rgba(220,146,75,0.75)', letterSpacing:'0.05em', textTransform:'uppercase' }}>
                      Email Address
                    </label>
                    <input className="ldf-plain" type="email" placeholder="Your registered email"
                      value={fpEmail} onChange={(e) => setFpEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleForgotSendOtp()}
                      autoCapitalize="none" autoCorrect="off" />
                  </div>
                  {fpError && (
                    <div style={{ padding:'9px 12px', borderRadius:8, fontSize:12.5,
                      background:'rgba(155,34,38,0.18)', border:'1px solid rgba(155,34,38,0.32)', color:'#ff9090' }}>
                      {fpError}
                    </div>
                  )}
                  <div style={{ display:'flex', gap:8, paddingTop:4 }}>
                    <button onClick={() => setShowForgot(false)} style={{
                      flex:1, padding:'10px', borderRadius:8, fontSize:13.5, fontWeight:500, cursor:'pointer',
                      background:'rgba(255,255,255,0.05)', color:'rgba(240,230,211,0.7)',
                      border:'1px solid rgba(220,146,75,0.18)', transition:'all 0.18s',
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.background='rgba(255,255,255,0.09)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background='rgba(255,255,255,0.05)')}>
                      Cancel
                    </button>
                    <button onClick={handleForgotSendOtp} disabled={fpLoading} style={{
                      flex:1, padding:'10px', borderRadius:8, fontSize:13.5, fontWeight:600, cursor:'pointer',
                      background:'linear-gradient(135deg,#ae5525,#8c3919)', color:'#fcfbf7',
                      border:'1px solid rgba(140,57,25,0.35)', boxShadow:'0 2px 8px rgba(174,85,37,0.25)',
                      opacity: fpLoading ? 0.55 : 1,
                    }}>
                      {fpLoading ? 'Sending…' : 'Send Code'}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Step 2: enter OTP + new password ── */
                <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
                  <div>
                    <label style={{ display:'block', fontSize:11.5, fontWeight:600, marginBottom:6,
                      color:'rgba(220,146,75,0.75)', letterSpacing:'0.05em', textTransform:'uppercase' }}>
                      Verification Code
                    </label>
                    <input className="ldf-plain" type="text" placeholder="6-digit code from email"
                      value={fpOtp} onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      onKeyDown={(e) => e.key === 'Enter' && handleForgotReset()}
                      inputMode="numeric" autoComplete="one-time-code" />
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11.5, fontWeight:600, marginBottom:6,
                      color:'rgba(220,146,75,0.75)', letterSpacing:'0.05em', textTransform:'uppercase' }}>
                      New Password
                    </label>
                    <input className="ldf-plain" type="password" placeholder="At least 8 characters"
                      value={fpNewPassword} onChange={(e) => setFpNewPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleForgotReset()} />
                  </div>
                  {fpError && (
                    <div style={{ padding:'9px 12px', borderRadius:8, fontSize:12.5,
                      background:'rgba(155,34,38,0.18)', border:'1px solid rgba(155,34,38,0.32)', color:'#ff9090' }}>
                      {fpError}
                    </div>
                  )}
                  <div style={{ display:'flex', gap:8, paddingTop:4 }}>
                    <button onClick={() => { setFpStep('form'); setFpError(null); }} style={{
                      flex:1, padding:'10px', borderRadius:8, fontSize:13.5, fontWeight:500, cursor:'pointer',
                      background:'rgba(255,255,255,0.05)', color:'rgba(240,230,211,0.7)',
                      border:'1px solid rgba(220,146,75,0.18)', transition:'all 0.18s',
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.background='rgba(255,255,255,0.09)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background='rgba(255,255,255,0.05)')}>
                      Back
                    </button>
                    <button onClick={handleForgotReset} disabled={fpLoading} style={{
                      flex:1, padding:'10px', borderRadius:8, fontSize:13.5, fontWeight:600, cursor:'pointer',
                      background:'linear-gradient(135deg,#ae5525,#8c3919)', color:'#fcfbf7',
                      border:'1px solid rgba(140,57,25,0.35)', boxShadow:'0 2px 8px rgba(174,85,37,0.25)',
                      opacity: fpLoading ? 0.55 : 1,
                    }}>
                      {fpLoading ? 'Resetting…' : 'Reset Password'}
                    </button>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <button type="button" onClick={handleForgotSendOtp} disabled={fpLoading}
                      style={{ fontSize:12, color:'rgba(220,146,75,0.45)', background:'none', border:'none',
                        cursor:'pointer', padding:0 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color='rgba(220,146,75,0.8)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color='rgba(220,146,75,0.45)')}>
                      Resend code
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          SUCCESS OVERLAY
      ══════════════════════════════════════════════════ */}
      {successInfo && (
        <div style={{
          position:'fixed', inset:0, zIndex:80,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          background:'#060402',
          animation:'successBgIn 0.4s ease forwards',
        }}>
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            width:400, height:400, borderRadius:'50%', filter:'blur(100px)',
            background:'radial-gradient(circle, rgba(220,146,75,0.18) 0%, transparent 65%)',
            pointerEvents:'none' }} />
          {[0, 0.6, 1.2].map((delay, i) => (
            <div key={i} style={{
              position:'absolute', top:'50%', left:'50%',
              width:110, height:110, marginTop:-55, marginLeft:-55,
              borderRadius:'50%',
              border:`1.5px solid rgba(220,146,75,${0.5 - i * 0.12})`,
              animation:`successRingOut 2.4s ${delay}s cubic-bezier(0.2,0.6,0.4,1) infinite`,
              pointerEvents:'none',
            }} />
          ))}
          <div style={{
            width:100, height:100, borderRadius:'50%',
            background:'linear-gradient(145deg, rgba(220,146,75,0.18), rgba(174,85,37,0.1))',
            border:'2px solid rgba(220,146,75,0.55)',
            display:'flex', alignItems:'center', justifyContent:'center',
            animation:'successCircleIn 1.1s 0.15s cubic-bezier(0.34,1.56,0.64,1) both',
            boxShadow:'0 0 40px rgba(220,146,75,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
            position:'relative', zIndex:1,
          }}>
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <polyline points="8,22 18,32 36,14" stroke="#f7c576" strokeWidth="3.2"
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="80" strokeDashoffset="80"
                style={{ animation:'successCheckDraw 1.1s 1.0s cubic-bezier(0.25,0.46,0.45,0.94) forwards' }} />
            </svg>
          </div>
          <div style={{
            marginTop:28, padding:'5px 16px', borderRadius:999,
            background:'rgba(220,146,75,0.1)', border:'1px solid rgba(220,146,75,0.22)',
            animation:'successTextIn 0.7s 1.8s ease both',
          }}>
            <p style={{ margin:0, color:'rgba(220,146,75,0.8)', fontSize:11.5,
              letterSpacing:'0.14em', textTransform:'uppercase', fontWeight:600 }}>
              {successInfo.institution}
            </p>
          </div>
          <h1 style={{
            margin:'16px 0 0', color:'#f5ede0', fontWeight:300,
            fontSize:'clamp(1.8rem,5vw,2.6rem)', letterSpacing:'-0.02em',
            textAlign:'center',
            animation:'successTextIn 0.75s 2.1s ease both',
          }}>
            Welcome back!
          </h1>
          <p style={{
            margin:'10px 0 0', color:'rgba(174,112,64,0.55)', fontSize:14,
            letterSpacing:'0.01em', textAlign:'center',
            animation:'successTextIn 0.75s 2.45s ease both',
          }}>
            Setting up your workspace
          </p>
          <div style={{ display:'flex', gap:7, marginTop:20, animation:'successTextIn 0.7s 2.75s ease both' }}>
            {[0, 0.22, 0.44].map((delay, i) => (
              <div key={i} style={{
                width:7, height:7, borderRadius:'50%', background:'rgba(220,146,75,0.6)',
                animation:`successDot 1.5s ${delay}s ease-in-out infinite`,
              }} />
            ))}
          </div>
          <div style={{
            marginTop:32, width:200, height:2, borderRadius:999,
            background:'rgba(220,146,75,0.1)', overflow:'hidden',
            animation:'successTextIn 0.7s 2.9s ease both',
          }}>
            <div style={{
              height:'100%',
              background:'linear-gradient(90deg, #ae5525, #f7c576, #dc924b)',
              animation:'successBarFill 3.8s 3.1s cubic-bezier(0.4,0,0.2,1) forwards',
              width:0,
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
