'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { usePlatformAuthStore } from '@/store/platform-auth.store';

type Phase = 'init' | 'zoom-in' | 'zoom-out' | 'greet' | 'reveal' | 'done';

const PARTICLES: { top?: string; bottom?: string; left?: string; right?: string; size: number; dur: string; delay: string }[] = [
  { top:'5%',  left:'9%',   size:3, dur:'10s', delay:'0s'   },
  { top:'13%', right:'11%', size:2, dur:'14s', delay:'2.3s' },
  { top:'27%', left:'6%',   size:4, dur:'12s', delay:'0.7s' },
  { top:'41%', right:'8%',  size:2, dur:'9s',  delay:'3.6s' },
  { top:'56%', left:'12%',  size:3, dur:'11s', delay:'1.4s' },
  { top:'69%', right:'14%', size:2, dur:'8s',  delay:'4.5s' },
  { top:'82%', left:'8%',   size:4, dur:'15s', delay:'0.3s' },
  { top:'90%', right:'10%', size:3, dur:'10s', delay:'2.9s' },
  { top:'21%', left:'48%',  size:2, dur:'17s', delay:'3.8s' },
  { top:'73%', left:'39%',  size:3, dur:'9s',  delay:'1.2s' },
  { top:'37%', left:'29%',  size:2, dur:'12s', delay:'5.2s' },
  { top:'61%', right:'33%', size:2, dur:'8s',  delay:'0.5s' },
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

export default function PlatformLoginPage() {
  const router  = useRouter();
  const setAuth = usePlatformAuthStore((s) => s.setAuth);

  const [logoError,   setLogoError]   = useState(false);
  const [phase,       setPhase]       = useState<Phase>('init');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [loading,     setLoading]     = useState(false);
  const [loadStep,    setLoadStep]    = useState(0);
  const [error,       setError]       = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ name: string } | null>(null);

  useEffect(() => {
    const r  = requestAnimationFrame(() => setPhase('zoom-in'));
    const t1 = setTimeout(() => setPhase('zoom-out'),  900);
    const t2 = setTimeout(() => setPhase('greet'),    2700);
    const t3 = setTimeout(() => setPhase('reveal'),   3900);
    const t4 = setTimeout(() => setPhase('done'),     4700);
    return () => { cancelAnimationFrame(r); [t1,t2,t3,t4].forEach(clearTimeout); };
  }, []);

  const handleLogin = async () => {
    if (loading) return;
    if (!email.trim())    return setError('Email is required');
    if (!password.trim()) return setError('Password is required');
    setLoading(true); setLoadStep(1); setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/platform/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setLoadStep(2);
      if (!res.ok) { const json = await res.json().catch(() => null); throw new Error(json?.message || 'Login failed'); }
      const data = await res.json();
      setLoadStep(3);
      setAuth(data.accessToken, data.admin);
      const name = email.split('@')[0] || 'Admin';
      setSuccessInfo({ name });
      await new Promise<void>((res) => setTimeout(res, 5500));
      router.push('/platform/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoadStep(0);
    } finally {
      setLoading(false);
    }
  };

  const welcomeVisible = phase === 'greet' || phase === 'reveal';
  const showOverlay    = phase !== 'done';
  const showCard       = phase === 'reveal' || phase === 'done';

  return (
    <div style={{ minHeight:'100vh', background:'#020308', position:'relative', overflow:'hidden',
      display:'flex', alignItems:'center', justifyContent:'center' }}>

      <style>{`
        @keyframes devParticleDrift {
          0%, 100% { transform: translateY(0px) scale(1);   opacity: 0; }
          10%, 90% { opacity: 1; }
          50%      { transform: translateY(-55px) scale(1.1); opacity: 0.5; }
        }
        @keyframes devCardReveal {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes devGlowBreathe {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%      { opacity: 0.7; transform: scale(1.13); }
        }
        @keyframes devArcSpin    { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
        @keyframes devArcSpinRev { from { transform: rotate(0deg);   } to { transform: rotate(-360deg); } }
        @keyframes devShimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes devBgIn { from { opacity:0; } to { opacity:1; } }
        @keyframes devCardBorderPulse {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }

        /* ── Success screen ── */
        @keyframes devSuccessCircleIn {
          0%   { transform: scale(0);    opacity: 0; }
          60%  { transform: scale(1.12); opacity: 1; }
          80%  { transform: scale(0.96); }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes devSuccessRingOut {
          0%   { transform: scale(1);   opacity: 0.5; }
          100% { transform: scale(2.8); opacity: 0; }
        }
        @keyframes devSuccessCheckDraw {
          from { stroke-dashoffset: 80; opacity: 0; }
          15%  { opacity: 1; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes devSuccessTextIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes devSuccessDot {
          0%, 70%, 100% { transform: translateY(0px);  opacity: 0.28; }
          35%            { transform: translateY(-7px); opacity: 1; }
        }
        @keyframes devSuccessBarFill {
          from { width: 0%; }
          to   { width: 100%; }
        }

        .dev-ldf {
          width: 100%; padding: 10px 12px 10px 36px;
          font-size: 14px; border: 1px solid rgba(99,102,241,0.2);
          border-radius: 9px; color: #e8e6ff;
          background: rgba(255,255,255,0.035);
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s; outline: none;
        }
        .dev-ldf::placeholder { color: rgba(139,116,246,0.32); }
        .dev-ldf:hover  { background: rgba(255,255,255,0.06); border-color: rgba(99,102,241,0.42); }
        .dev-ldf:focus  { background: rgba(255,255,255,0.065); border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.04); }
        .dev-ldf:disabled { opacity: 0.35; cursor: not-allowed; }

        .dev-welcome-shimmer {
          background: linear-gradient(90deg, #818cf8 0%, #e0e7ff 45%, #818cf8 80%);
          background-size: 220% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          animation: devShimmer 3.8s linear infinite;
        }

        .dev-btn {
          transition: background 0.22s ease, box-shadow 0.22s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        .dev-btn:not(:disabled):hover {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;
          box-shadow: 0 6px 28px rgba(99,102,241,0.55), 0 2px 8px rgba(0,0,0,0.3) !important;
          transform: translateY(-2px) scale(1.01) !important;
        }
        .dev-btn:not(:disabled):active {
          transform: translateY(0) scale(0.98) !important;
          box-shadow: 0 2px 10px rgba(99,102,241,0.3) !important;
        }
      `}</style>

      {/* ─── Ambient background glows ─── */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0 }}>
        <div style={{ position:'absolute', top:'-12%', left:'-8%', width:640, height:640,
          borderRadius:'50%', filter:'blur(130px)',
          background:'radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 70%)',
          animation:'devGlowBreathe 9s ease-in-out infinite' }} />
        <div style={{ position:'absolute', bottom:'-12%', right:'-8%', width:560, height:560,
          borderRadius:'50%', filter:'blur(110px)',
          background:'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
          animation:'devGlowBreathe 13s ease-in-out infinite', animationDelay:'5s' }} />
        <div style={{ position:'absolute', top:'38%', right:'18%', width:360, height:360,
          borderRadius:'50%', filter:'blur(90px)',
          background:'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)',
          animation:'devGlowBreathe 11s ease-in-out infinite', animationDelay:'2.5s' }} />
      </div>

      {/* ─── Arc rings ─── */}
      <div style={{ position:'fixed', top:-130, left:-130, width:440, height:440,
        borderRadius:'50%', border:'1px solid rgba(99,102,241,0.06)',
        pointerEvents:'none', zIndex:1, animation:'devArcSpin 70s linear infinite' }} />
      <div style={{ position:'fixed', top:-80, left:-80, width:280, height:280,
        borderRadius:'50%', border:'0.5px dashed rgba(99,102,241,0.04)',
        pointerEvents:'none', zIndex:1, animation:'devArcSpinRev 45s linear infinite' }} />
      <div style={{ position:'fixed', bottom:-110, right:-110, width:400, height:400,
        borderRadius:'50%', border:'1px solid rgba(139,92,246,0.05)',
        pointerEvents:'none', zIndex:1, animation:'devArcSpinRev 55s linear infinite' }} />
      <div style={{ position:'fixed', bottom:-60, right:-60, width:250, height:250,
        borderRadius:'50%', border:'0.5px dashed rgba(59,130,246,0.04)',
        pointerEvents:'none', zIndex:1, animation:'devArcSpin 38s linear infinite' }} />

      {/* ─── Floating particles ─── */}
      {PARTICLES.map((p, i) => {
        const pos: Record<string,string> = {};
        if (p.top)    pos.top    = p.top;
        if (p.bottom) pos.bottom = p.bottom;
        if (p.left)   pos.left   = p.left;
        if (p.right)  pos.right  = p.right;
        return (
          <div key={i} style={{
            position:'fixed', ...pos,
            width:p.size, height:p.size, borderRadius:'50%',
            background: i%3===0 ? 'rgba(165,180,252,0.55)' : i%3===1 ? 'rgba(99,102,241,0.45)' : 'rgba(139,92,246,0.38)',
            boxShadow:`0 0 ${p.size*3}px rgba(99,102,241,0.45)`,
            pointerEvents:'none', zIndex:2,
            animation:`devParticleDrift ${p.dur} ease-in-out infinite`,
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
          background:'#020308',
          opacity: phase === 'reveal' ? 0 : 1,
          transition: phase === 'reveal' ? 'opacity 0.72s ease' : 'none',
          pointerEvents: phase === 'reveal' ? 'none' : 'auto',
        }}>
          {/* Overlay glows */}
          <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
            <div style={{ position:'absolute', top:'-10%', left:'-5%', width:600, height:600,
              borderRadius:'50%', filter:'blur(120px)',
              background:'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)' }} />
            <div style={{ position:'absolute', bottom:'-10%', right:'-5%', width:520, height:520,
              borderRadius:'50%', filter:'blur(110px)',
              background:'radial-gradient(circle, rgba(139,92,246,0.11) 0%, transparent 70%)' }} />
          </div>

          {/* Logo mark */}
          <div style={{
            transform: getLogoTransform(phase),
            transition: getLogoTransition(phase),
            zIndex:1, marginBottom:36, textAlign:'center',
          }}>
            {!logoError ? (
              <Image src="/logo.png" alt="Infovion" width={160} height={160}
                style={{ objectFit:'contain', width:'auto', maxHeight:140, display:'block', margin:'0 auto',
                  filter:'drop-shadow(0 0 24px rgba(99,102,241,0.35))' }}
                onError={() => setLogoError(true)} />
            ) : (
              /* Tech fallback: </> code icon */
              <div style={{
                width:120, height:120, borderRadius:28,
                background:'linear-gradient(145deg, rgba(99,102,241,0.25), rgba(139,92,246,0.15))',
                border:'2px solid rgba(99,102,241,0.5)',
                boxShadow:'0 0 60px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                  <polyline points="19,14 7,26 19,38" stroke="#a5b4fc" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="33,14 45,26 33,38" stroke="#a5b4fc" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="30" y1="10" x2="22" y2="42" stroke="rgba(165,180,252,0.45)" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
            )}
          </div>

          {/* Welcome text */}
          <div style={{
            zIndex:1, textAlign:'center',
            opacity: welcomeVisible ? 1 : 0,
            transform: welcomeVisible ? 'translateY(0)' : 'translateY(18px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
          }}>
            <h1 style={{ margin:0, fontWeight:300, fontSize:'clamp(1.35rem,4vw,2.1rem)', letterSpacing:'0.22em', textTransform:'uppercase' }}>
              <span className="dev-welcome-shimmer">Infovion Developer Portal</span>
            </h1>
            <div style={{ height:1, background:'linear-gradient(to right,transparent,rgba(99,102,241,0.3),transparent)',
              margin:'18px auto 0', width:280, maxWidth:'80vw' }} />
            <p style={{ color:'rgba(139,116,246,0.45)', fontSize:12, letterSpacing:'0.12em',
              textTransform:'uppercase', marginTop:12 }}>
              Developer Console · Restricted Access
            </p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          LOGIN CARD
      ══════════════════════════════════════════════════ */}
      {showCard && (
        <div style={{
          position:'relative', zIndex:30, width:'100%', maxWidth:400,
          padding:'0 16px',
          animation:'devCardReveal 0.62s cubic-bezier(0.25,0.46,0.45,0.94) forwards',
        }}>
          <div style={{
            background:'linear-gradient(160deg, rgba(10,8,28,0.96) 0%, rgba(6,5,18,0.97) 100%)',
            border:'1px solid rgba(99,102,241,0.2)',
            borderRadius:22,
            padding:'0 0 32px',
            boxShadow:'0 48px 100px rgba(0,0,0,0.75), 0 0 0 0.5px rgba(99,102,241,0.08), 0 0 80px rgba(99,102,241,0.06)',
            backdropFilter:'blur(32px)',
            WebkitBackdropFilter:'blur(32px)',
            overflow:'hidden',
            position:'relative',
          }}>
            {/* Indigo top accent bar */}
            <div style={{ height:2, background:'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.5) 30%, rgba(165,180,252,0.9) 50%, rgba(99,102,241,0.5) 70%, transparent 100%)', animation:'devCardBorderPulse 4s ease-in-out infinite' }} />
            {/* Inner glow */}
            <div style={{ position:'absolute', top:2, left:0, right:0, height:60, background:'linear-gradient(180deg, rgba(99,102,241,0.04) 0%, transparent 100%)', pointerEvents:'none' }} />

            <div style={{ padding:'30px 30px 0' }}>

              {/* Logo */}
              <div style={{ textAlign:'center', marginBottom:24 }}>
                {!logoError ? (
                  <Image src="/logo.png" alt="Infovion" width={80} height={80}
                    style={{ objectFit:'contain', width:'auto', maxHeight:56, display:'block', margin:'0 auto',
                      filter:'drop-shadow(0 0 12px rgba(99,102,241,0.3))' }}
                    onError={() => setLogoError(true)} />
                ) : (
                  <div style={{
                    width:48, height:48, borderRadius:12,
                    background:'linear-gradient(145deg, rgba(99,102,241,0.2), rgba(139,92,246,0.12))',
                    border:'1.5px solid rgba(99,102,241,0.35)',
                    display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto',
                  }}>
                    <svg width="24" height="24" viewBox="0 0 52 52" fill="none">
                      <polyline points="19,14 7,26 19,38" stroke="#a5b4fc" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points="33,14 45,26 33,38" stroke="#a5b4fc" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
                <p style={{ color:'rgba(139,116,246,0.4)', fontSize:10.5, letterSpacing:'0.14em',
                  textTransform:'uppercase', margin:'8px 0 0' }}>Infovion Developer Portal</p>
              </div>

              {/* Divider */}
              <div style={{ height:'0.5px', background:'linear-gradient(to right,transparent,rgba(99,102,241,0.18),transparent)', marginBottom:22 }} />

              {/* Heading */}
              <div style={{ marginBottom:22 }}>
                <h2 style={{ margin:0, color:'#ebe9ff', fontWeight:600, fontSize:19, letterSpacing:'-0.025em' }}>
                  Sign in to Developer Portal
                </h2>
                <p style={{ margin:'5px 0 0', color:'rgba(139,116,246,0.5)', fontSize:13 }}>
                  Restricted to authorised developers
                </p>
              </div>

              {/* Fields */}
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:600, marginBottom:6,
                    color:'rgba(139,116,246,0.75)', letterSpacing:'0.05em', textTransform:'uppercase' }}>
                    Email
                  </label>
                  <div style={{ position:'relative' }}>
                    <div style={{ position:'absolute', top:0, bottom:0, left:11, display:'flex',
                      alignItems:'center', pointerEvents:'none', color:'rgba(99,102,241,0.4)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                    </div>
                    <input className="dev-ldf" type="email" placeholder=""
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      disabled={loading} autoCapitalize="none" autoCorrect="off" />
                  </div>
                </div>

                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:600, marginBottom:6,
                    color:'rgba(139,116,246,0.75)', letterSpacing:'0.05em', textTransform:'uppercase' }}>
                    Password
                  </label>
                  <div style={{ position:'relative' }}>
                    <div style={{ position:'absolute', top:0, bottom:0, left:11, display:'flex',
                      alignItems:'center', pointerEvents:'none', color:'rgba(99,102,241,0.4)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                    <input className="dev-ldf" type="password" placeholder=""
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      disabled={loading} />
                  </div>
                </div>
              </div>

              {error && (
                <div style={{
                  marginTop:14, padding:'10px 13px', borderRadius:8, fontSize:13,
                  background:'rgba(127,29,29,0.25)', border:'1px solid rgba(239,68,68,0.25)',
                  color:'#fca5a5',
                }}>
                  {error}
                </div>
              )}

              <button onClick={handleLogin} disabled={loading} className="dev-btn"
                style={{
                  marginTop:18, width:'100%', padding:'12px',
                  fontSize:14.5, fontWeight:600, borderRadius:10, cursor: loading ? 'default' : 'pointer',
                  background: loading ? 'rgba(79,70,229,0.5)' : 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                  color:'#e0e7ff', border:'1px solid rgba(79,70,229,0.4)',
                  boxShadow: loading ? 'none' : '0 2px 16px rgba(99,102,241,0.38)',
                }}>
                {loading ? (
                  <span style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                    <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <svg style={{ width:16, height:16, animation:'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30" strokeLinecap="round"/>
                      </svg>
                      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
                      {loadStep === 1 && 'Verifying credentials…'}
                      {loadStep === 2 && 'Authenticating…'}
                      {loadStep === 3 && 'Granting access…'}
                    </span>
                    <span style={{ display:'flex', gap:4 }}>
                      {[1,2,3].map((s) => (
                        <span key={s} style={{ display:'inline-block', borderRadius:999, transition:'all 0.3s',
                          width: loadStep >= s ? 20 : 6, height:4,
                          background: loadStep >= s ? 'rgba(165,180,252,0.9)' : 'rgba(165,180,252,0.25)' }} />
                      ))}
                    </span>
                  </span>
                ) : (
                  <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                    Access Platform
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </span>
                )}
              </button>
            </div>{/* /inner padding */}
          </div>{/* /card */}

          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.18)', fontSize:11,
            letterSpacing:'0.04em', marginTop:20 }}>
            © {new Date().getFullYear()} Infovion. All rights reserved.
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          SUCCESS / ACCESS GRANTED OVERLAY
      ══════════════════════════════════════════════════ */}
      {successInfo && (
        <div style={{
          position:'fixed', inset:0, zIndex:80,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          background:'#020308',
          animation:'devBgIn 0.4s ease forwards',
        }}>
          {/* Ambient glow */}
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            width:400, height:400, borderRadius:'50%', filter:'blur(100px)',
            background:'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 65%)',
            pointerEvents:'none' }} />

          {/* Ripple rings */}
          {[0, 0.6, 1.2].map((delay, i) => (
            <div key={i} style={{
              position:'absolute', top:'50%', left:'50%',
              width:110, height:110, marginTop:-55, marginLeft:-55,
              borderRadius:'50%',
              border:`1.5px solid rgba(99,102,241,${0.5 - i * 0.12})`,
              animation:`devSuccessRingOut 2.4s ${delay}s cubic-bezier(0.2,0.6,0.4,1) infinite`,
              pointerEvents:'none',
            }} />
          ))}

          {/* Circle + checkmark */}
          <div style={{
            width:100, height:100, borderRadius:'50%',
            background:'linear-gradient(145deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))',
            border:'2px solid rgba(99,102,241,0.55)',
            display:'flex', alignItems:'center', justifyContent:'center',
            animation:'devSuccessCircleIn 1.1s 0.15s cubic-bezier(0.34,1.56,0.64,1) both',
            boxShadow:'0 0 40px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
            position:'relative', zIndex:1,
          }}>
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <polyline points="8,22 18,32 36,14" stroke="#a5b4fc" strokeWidth="3.2"
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="80" strokeDashoffset="80"
                style={{ animation:'devSuccessCheckDraw 1.1s 1.0s cubic-bezier(0.25,0.46,0.45,0.94) forwards' }} />
            </svg>
          </div>

          {/* Dev badge tag */}
          <div style={{
            marginTop:28,
            padding:'5px 16px', borderRadius:999,
            background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.25)',
            animation:'devSuccessTextIn 0.7s 1.8s ease both',
          }}>
            <p style={{ margin:0, color:'rgba(165,180,252,0.8)', fontSize:11.5,
              letterSpacing:'0.14em', textTransform:'uppercase', fontWeight:600 }}>
              Developer Console
            </p>
          </div>

          {/* Heading */}
          <h1 style={{
            margin:'16px 0 0', color:'#ebe9ff', fontWeight:300,
            fontSize:'clamp(1.8rem,5vw,2.6rem)', letterSpacing:'-0.02em', textAlign:'center',
            animation:'devSuccessTextIn 0.75s 2.1s ease both',
          }}>
            Access Granted
          </h1>

          {/* Subtitle */}
          <p style={{
            margin:'10px 0 0', color:'rgba(139,116,246,0.5)', fontSize:14,
            letterSpacing:'0.01em', textAlign:'center',
            animation:'devSuccessTextIn 0.75s 2.45s ease both',
          }}>
            Initializing platform dashboard
          </p>

          {/* Bouncing dots */}
          <div style={{
            display:'flex', gap:7, marginTop:20,
            animation:'devSuccessTextIn 0.7s 2.75s ease both',
          }}>
            {[0, 0.22, 0.44].map((delay, i) => (
              <div key={i} style={{
                width:7, height:7, borderRadius:'50%',
                background:'rgba(99,102,241,0.65)',
                animation:`devSuccessDot 1.5s ${delay}s ease-in-out infinite`,
              }} />
            ))}
          </div>

          {/* Progress bar */}
          <div style={{
            marginTop:32, width:200, height:2, borderRadius:999,
            background:'rgba(99,102,241,0.1)', overflow:'hidden',
            animation:'devSuccessTextIn 0.7s 2.9s ease both',
          }}>
            <div style={{
              height:'100%',
              background:'linear-gradient(90deg, #3730a3, #a5b4fc, #6366f1)',
              animation:'devSuccessBarFill 3.8s 3.1s cubic-bezier(0.4,0,0.2,1) forwards',
              width:0,
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
