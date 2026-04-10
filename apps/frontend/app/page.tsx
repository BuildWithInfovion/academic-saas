'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { getRoleRoute } from '@/lib/auth-utils';

// Portal roles where multiple assignments cause ambiguity
const PORTAL_ROLES = ['principal', 'teacher', 'student', 'parent', 'receptionist'];

export default function LoginPage() {
  const router  = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [logoError, setLogoError] = useState(false);

  const [institutionCode, setInstitutionCode] = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [loading,         setLoading]         = useState(false);
  const [loadStep,        setLoadStep]        = useState(0); // 0=idle 1=verifying 2=authenticating 3=redirecting
  const [error,           setError]           = useState<string | null>(null);
  const [showForgot,      setShowForgot]      = useState(false);
  const [fpCode,          setFpCode]          = useState('');
  const [fpIdentifier,    setFpIdentifier]    = useState('');
  const [fpLoading,       setFpLoading]       = useState(false);
  const [fpError,         setFpError]         = useState<string | null>(null);
  const [fpSuccess,       setFpSuccess]       = useState<string | null>(null);

  const handleLogin = async () => {
    if (!institutionCode.trim()) return setError('School code is required');
    if (!email.trim())           return setError('Email or phone is required');
    if (!password.trim())        return setError('Password is required');
    setLoading(true); setLoadStep(1); setError(null);
    try {
      // Step 1 — verify institution + credentials
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionCode: institutionCode.trim().toLowerCase(), email: email.trim(), password }),
      });
      setLoadStep(2); // authenticating
      if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(j?.message || 'Login failed'); }
      const data = await res.json();
      if (!data.accessToken) throw new Error('No token received from server');
      const roles: string[] = data.user.roles ?? [];
      setAuth({
        accessToken: data.accessToken, refreshToken: data.refreshToken,
        user: { email: data.user.email, phone: data.user.phone, institutionId: data.user.institutionId,
          institutionName: data.user.institutionName, roles },
      });
      setLoadStep(3); // redirecting
      // If user has multiple portal roles, show a role-selection screen
      const portalRoles = roles.filter((r) => PORTAL_ROLES.includes(r));
      if (portalRoles.length > 1) {
        router.push('/portal/select-role');
      } else {
        router.push(getRoleRoute(roles));
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Login failed'); setLoadStep(0); }
    finally { setLoading(false); }
  };

  const openForgot = () => {
    setFpCode(institutionCode); setFpIdentifier('');
    setFpError(null); setFpSuccess(null); setShowForgot(true);
  };

  const handleForgotSubmit = async () => {
    if (!fpCode.trim())       return setFpError('School code is required');
    if (!fpIdentifier.trim()) return setFpError('Phone number or email is required');
    setFpLoading(true); setFpError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionCode: fpCode.trim().toLowerCase(), identifier: fpIdentifier.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || 'Request failed');
      setFpSuccess(data.message);
    } catch (err) { setFpError(err instanceof Error ? err.message : 'Request failed'); }
    finally { setFpLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4 login-bg-animate"
      style={{ background: 'linear-gradient(160deg, #fdf4e9, #f7ecdb, #faecd4, #fdf0e0)' }}>

      {/* ── Warm background orbs ── */}
      <div className="orb-container">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
      <div className="bg-dots" />

      {/* ── Main card ── */}
      <div className="relative z-10 w-full max-w-4xl flex rounded-2xl overflow-hidden fade-up"
        style={{ boxShadow: '0 24px 80px rgba(107,67,47,0.25), 0 4px 16px rgba(107,67,47,0.12)', minHeight: 560 }}>

        {/* ══════════ LEFT — Dark Brand Panel ══════════ */}
        <div className="hidden lg:flex flex-col justify-between w-[44%] p-10 relative overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #1c0e06 0%, #2d1a0e 55%, #3d1f0a 100%)' }}>

          {/* Animated arc rings */}
          <div style={{ position:'absolute', top:-80, right:-80, width:300, height:300,
            borderRadius:'50%', border:'1px solid rgba(247,197,118,0.1)', pointerEvents:'none',
            animation:'arcSpin 40s linear infinite', transformOrigin:'center' }} />
          <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200,
            borderRadius:'50%', border:'1.5px solid rgba(220,146,75,0.18)', pointerEvents:'none',
            animation:'arcSpinRev 28s linear infinite', transformOrigin:'center' }} />
          <div style={{ position:'absolute', bottom:-70, left:-70, width:260, height:260,
            borderRadius:'50%', border:'1px solid rgba(174,85,37,0.12)', pointerEvents:'none',
            animation:'arcSpin 50s linear infinite', transformOrigin:'center' }} />
          <div style={{ position:'absolute', bottom:40, right:-110, width:340, height:340,
            borderRadius:'50%', border:'0.5px solid rgba(247,197,118,0.06)', pointerEvents:'none',
            animation:'arcSpinRev 60s linear infinite', transformOrigin:'center' }} />

          {/* Animated glow blob */}
          <div style={{ position:'absolute', top:'18%', left:'8%', width:220, height:220,
            background:'radial-gradient(circle, rgba(220,146,75,0.22) 0%, transparent 70%)',
            filter:'blur(45px)', pointerEvents:'none',
            animation:'glowBreathe 6s ease-in-out infinite' }} />
          {/* Second accent glow */}
          <div style={{ position:'absolute', bottom:'15%', right:'5%', width:160, height:160,
            background:'radial-gradient(circle, rgba(174,85,37,0.18) 0%, transparent 70%)',
            filter:'blur(35px)', pointerEvents:'none',
            animation:'glowBreathe 8s ease-in-out infinite', animationDelay:'3s' }} />

          {/* Top: Logo + headline */}
          <div className="fade-up-1 relative z-10">
            {/* Logo — file location: apps/frontend/public/logo.png */}
            <div className="mb-8" style={{ animation:'floatY 5s ease-in-out infinite' }}>
              {!logoError ? (
                <Image
                  src="/logo.png"
                  alt="Infovion"
                  width={160}
                  height={160}
                  style={{ objectFit:'contain', width:'auto', maxHeight:120 }}
                  onError={() => setLogoError(true)}
                />
              ) : (
                /* Fallback text-only when logo.png not yet placed */
                <div>
                  <p className="font-bold text-xl" style={{ color:'#f7c576', letterSpacing:'0.1em' }}>INFOVION</p>
                  <p className="text-xs mt-0.5" style={{ color:'rgba(174,112,64,0.6)', letterSpacing:'0.06em' }}>ACADEMIC SAAS</p>
                </div>
              )}
            </div>

            <h1 className="font-bold leading-tight"
              style={{ fontSize:'2rem', letterSpacing:'-0.025em', color:'#fcfbf7' }}>
              Manage your<br />
              <span className="shimmer-text">institution</span><br />
              with confidence
            </h1>
          </div>

          {/* Bottom: copyright */}
          <div className="fade-up-3 relative z-10">
            <div style={{ height:1, background:'linear-gradient(to right,transparent,rgba(247,197,118,0.15),transparent)', marginBottom:16 }} />
            <p className="text-xs" style={{ color:'rgba(174,112,64,0.35)' }}>
              © {new Date().getFullYear()} Infovion. All rights reserved.
            </p>
          </div>
        </div>

        {/* ══════════ RIGHT — Login Form ══════════ */}
        <div className="flex-1 flex flex-col justify-center p-8 lg:p-10 relative overflow-hidden"
          style={{ background:'#fcfbf7' }}>

          {/* ── Background animations (behind form) ── */}

          {/* Large warm orb — top right */}
          <div style={{
            position:'absolute', top:-60, right:-60, width:380, height:380,
            borderRadius:'50%', pointerEvents:'none', zIndex:0,
            background:'radial-gradient(circle, rgba(220,146,75,0.22) 0%, rgba(247,197,118,0.08) 50%, transparent 70%)',
            filter:'blur(48px)',
            animation:'glowBreathe 7s ease-in-out infinite',
          }} />

          {/* Medium rust orb — bottom left */}
          <div style={{
            position:'absolute', bottom:-50, left:-50, width:300, height:300,
            borderRadius:'50%', pointerEvents:'none', zIndex:0,
            background:'radial-gradient(circle, rgba(174,85,37,0.2) 0%, rgba(220,146,75,0.06) 55%, transparent 70%)',
            filter:'blur(40px)',
            animation:'glowBreathe 10s ease-in-out infinite', animationDelay:'3.5s',
          }} />

          {/* Small accent orb — centre left */}
          <div style={{
            position:'absolute', top:'40%', left:'-20px', width:160, height:160,
            borderRadius:'50%', pointerEvents:'none', zIndex:0,
            background:'radial-gradient(circle, rgba(247,197,118,0.18) 0%, transparent 70%)',
            filter:'blur(30px)',
            animation:'glowBreathe 9s ease-in-out infinite', animationDelay:'1.5s',
          }} />

          {/* Spinning rings — top-left corner (3 rings) */}
          <div style={{
            position:'absolute', top:-90, left:-90, width:280, height:280,
            borderRadius:'50%', border:'1.5px solid rgba(220,146,75,0.22)',
            pointerEvents:'none', zIndex:0,
            animation:'arcSpin 30s linear infinite',
          }} />
          <div style={{
            position:'absolute', top:-55, left:-55, width:210, height:210,
            borderRadius:'50%', border:'1px dashed rgba(174,85,37,0.18)',
            pointerEvents:'none', zIndex:0,
            animation:'arcSpinRev 20s linear infinite',
          }} />
          <div style={{
            position:'absolute', top:-25, left:-25, width:150, height:150,
            borderRadius:'50%', border:'1px solid rgba(247,197,118,0.14)',
            pointerEvents:'none', zIndex:0,
            animation:'arcSpin 14s linear infinite',
          }} />

          {/* Spinning rings — bottom-right corner (3 rings) */}
          <div style={{
            position:'absolute', bottom:-90, right:-90, width:290, height:290,
            borderRadius:'50%', border:'1.5px solid rgba(220,146,75,0.2)',
            pointerEvents:'none', zIndex:0,
            animation:'arcSpinRev 36s linear infinite',
          }} />
          <div style={{
            position:'absolute', bottom:-55, right:-55, width:210, height:210,
            borderRadius:'50%', border:'1px dashed rgba(174,85,37,0.16)',
            pointerEvents:'none', zIndex:0,
            animation:'arcSpin 24s linear infinite',
          }} />
          <div style={{
            position:'absolute', bottom:-28, right:-28, width:150, height:150,
            borderRadius:'50%', border:'1px solid rgba(247,197,118,0.12)',
            pointerEvents:'none', zIndex:0,
            animation:'arcSpinRev 16s linear infinite',
          }} />

          {/* Floating dots — scattered across panel */}
          {[
            { top:'8%',  left:'9%',   size:7,  delay:'0s',   dur:'6s'  },
            { top:'18%', right:'11%', size:5,  delay:'1.8s', dur:'8s'  },
            { top:'32%', left:'6%',   size:4,  delay:'0.8s', dur:'7s'  },
            { top:'55%', right:'8%',  size:8,  delay:'3s',   dur:'9s'  },
            { top:'68%', left:'12%',  size:5,  delay:'1.2s', dur:'6.5s'},
            { top:'80%', right:'14%', size:4,  delay:'2.5s', dur:'8s'  },
            { top:'44%', left:'4%',   size:3,  delay:'1.5s', dur:'5.5s'},
            { top:'72%', left:'7%',   size:6,  delay:'0.3s', dur:'7.5s'},
          ].map((d, i) => (
            <div key={i} style={{
              position:'absolute', ...d as object,
              width:d.size, height:d.size, borderRadius:'50%',
              background: i % 2 === 0 ? 'rgba(174,85,37,0.28)' : 'rgba(220,146,75,0.22)',
              boxShadow: `0 0 ${d.size * 2}px ${i % 2 === 0 ? 'rgba(174,85,37,0.3)' : 'rgba(220,146,75,0.25)'}`,
              pointerEvents:'none', zIndex:0,
              animation:`floatY ${d.dur} ease-in-out infinite`,
              animationDelay: d.delay,
            }} />
          ))}

          {/* Diagonal decorative lines */}
          <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:0, opacity:0.06 }}
            xmlns="http://www.w3.org/2000/svg">
            <line x1="0" y1="30%" x2="40%" y2="0" stroke="#ae5525" strokeWidth="0.8"/>
            <line x1="60%" y1="100%" x2="100%" y2="60%" stroke="#dc924b" strokeWidth="0.8"/>
            <line x1="0" y1="70%" x2="25%" y2="100%" stroke="#ae5525" strokeWidth="0.6"/>
            <line x1="75%" y1="0" x2="100%" y2="30%" stroke="#dc924b" strokeWidth="0.6"/>
          </svg>

          {/* Ensure form sits above decorations */}
          <div className="relative z-10 flex flex-col" style={{ flex:1, justifyContent:'center' }}>

          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            {!logoError ? (
              <Image src="/logo.png" alt="Infovion" width={120} height={80}
                style={{ objectFit:'contain', width:'auto', maxHeight:56 }}
                onError={() => setLogoError(true)} />
            ) : (
              <p className="font-bold text-base" style={{ color:'#ae5525', letterSpacing:'0.08em' }}>INFOVION</p>
            )}
          </div>

          {/* Heading */}
          <div className="mb-7 fade-up-1">
            <h2 className="text-2xl font-bold" style={{ color:'var(--text-1)', letterSpacing:'-0.025em' }}>
              Sign in to your account
            </h2>
            <p className="text-sm mt-1.5" style={{ color:'var(--text-3)' }}>
              Enter your school credentials to continue
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4 fade-up-2">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color:'var(--text-2)' }}>
                School Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none" style={{ color:'var(--text-3)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <input className="field" style={{ paddingLeft:34 }} type="text"
                  placeholder="e.g. stmary, infovion"
                  value={institutionCode} onChange={(e) => setInstitutionCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  disabled={loading} autoCapitalize="none" autoCorrect="off" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color:'var(--text-2)' }}>
                Email or Phone
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none" style={{ color:'var(--text-3)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <input className="field" style={{ paddingLeft:34 }} type="text"
                  placeholder="admin@school.com or 9876543210"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()} disabled={loading} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold" style={{ color:'var(--text-2)' }}>Password</label>
                <button type="button" onClick={openForgot}
                  className="text-xs font-medium transition-colors"
                  style={{ color:'var(--brand)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--brand-dark)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--brand)')}>
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none" style={{ color:'var(--text-3)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <input className="field" style={{ paddingLeft:34 }} type="password" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()} disabled={loading} />
              </div>
            </div>
          </div>

          {error && <div className="alert alert-error mt-4 text-sm fade-up">{error}</div>}

          <button onClick={handleLogin} disabled={loading} className="btn-primary w-full mt-5 fade-up-3"
            style={{ padding:'12px', fontSize:'14.5px', borderRadius:'10px' }}>
            {loading ? (
              <span className="flex flex-col items-center gap-1.5">
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30" strokeLinecap="round"/>
                  </svg>
                  {loadStep === 1 && 'Verifying credentials…'}
                  {loadStep === 2 && 'Authenticating…'}
                  {loadStep === 3 && 'Logging you in…'}
                </span>
                {/* Progress dots */}
                <span className="flex gap-1">
                  {[1,2,3].map((s) => (
                    <span key={s} className="inline-block rounded-full transition-all duration-300"
                      style={{ width: loadStep >= s ? 20 : 6, height: 4, background: loadStep >= s ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)' }} />
                  ))}
                </span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Sign In
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </span>
            )}
          </button>

        </div>
      </div>
      </div>

      {/* ── Forgot password modal ── */}
      {showForgot && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowForgot(false)}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden fade-up"
            style={{ background:'#fcfbf7', boxShadow:'var(--shadow-xl)', border:'1px solid var(--border)' }}>
            {/* Modal header strip */}
            <div className="px-7 py-5" style={{ background:'linear-gradient(135deg,#2d1a0e,#3d1f0a)', borderBottom:'1px solid rgba(247,197,118,0.1)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                  style={{ background:'rgba(220,146,75,0.2)', border:'1px solid rgba(220,146,75,0.3)' }}>
                  🔐
                </div>
                <div>
                  <h2 className="text-sm font-bold" style={{ color:'#fcfbf7' }}>Reset Password</h2>
                  <p className="text-xs" style={{ color:'rgba(174,112,64,0.7)' }}>School operator will set a new password</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {fpSuccess ? (
                <div className="space-y-4">
                  <div className="alert alert-success text-sm">{fpSuccess}</div>
                  <button onClick={() => setShowForgot(false)} className="btn-primary w-full">Back to Login</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color:'var(--text-2)' }}>School Code</label>
                    <input className="field" type="text" placeholder="e.g. stmary"
                      value={fpCode} onChange={(e) => setFpCode(e.target.value)} autoCapitalize="none" autoCorrect="off" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color:'var(--text-2)' }}>Phone or Email</label>
                    <input className="field" type="text" placeholder="Your registered phone or email"
                      value={fpIdentifier} onChange={(e) => setFpIdentifier(e.target.value)} />
                  </div>
                  {fpError && <div className="alert alert-error text-xs">{fpError}</div>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setShowForgot(false)} className="btn-secondary flex-1">Cancel</button>
                    <button onClick={handleForgotSubmit} disabled={fpLoading} className="btn-primary flex-1">
                      {fpLoading ? 'Submitting…' : 'Submit Request'}
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
