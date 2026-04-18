'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { usePlatformAuthStore } from '@/store/platform-auth.store';
import { silentPlatformRefresh } from '@/lib/platform-api';

const IconDash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IconClients = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconSupport = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconProfile = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const NAV = [
  { label: 'Dashboard', path: '/platform/dashboard', icon: <IconDash /> },
  { label: 'Clients',   path: '/platform/clients',   icon: <IconClients /> },
  { label: 'Support',   path: '/platform/support',   icon: <IconSupport /> },
  { label: 'Profile',   path: '/platform/profile',   icon: <IconProfile /> },
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { admin, logout } = usePlatformAuthStore();
  const [ready, setReady] = useState(false);
  const [clock, setClock] = useState('');

  const isLoginPage = pathname === '/platform/login';

  useEffect(() => {
    if (isLoginPage) { setReady(true); return; }
    if (admin) { setReady(true); return; }
    silentPlatformRefresh().then((ok) => {
      if (ok) setReady(true);
      else router.replace('/platform/login');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (isLoginPage) return <>{children}</>;
  if (!ready || !admin) return null;

  const handleLogout = async () => {
    logout();
    await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/platform/auth/logout`, {
      method: 'POST', credentials: 'include',
    }).catch(() => {});
    router.push('/platform/login');
  };

  return (
    <div style={{ display:'flex', height:'100vh', background:'#020408', color:'#c8e6ff', overflow:'hidden', position:'relative' }}>

      {/* ── Global styles + keyframes ── */}
      <style>{`
        @keyframes scfSpin     { to { transform: rotate(360deg);  } }
        @keyframes scfSpinRev  { to { transform: rotate(-360deg); } }
        @keyframes scfPulse    { 0%,100%{opacity:.45} 50%{opacity:1} }
        @keyframes scfGlowPulse{ 0%,100%{box-shadow:0 0 8px rgba(0,212,255,.18)} 50%{box-shadow:0 0 24px rgba(0,212,255,.55)} }
        @keyframes scfScanLine { 0%{top:-2px;opacity:0} 5%{opacity:.7} 95%{opacity:.3} 100%{top:100%;opacity:0} }
        @keyframes scfReveal   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scfCountIn  { from{opacity:0;transform:scale(.85) translateY(6px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes scfRadar    { to { transform: rotate(360deg); } }
        @keyframes scfBlink    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes scfFlicker  { 0%,18%,20%,22%,53%,55%,100%{opacity:1} 19%,21%,54%{opacity:.6} }
        @keyframes scfDataDot  { 0%{left:-8px;opacity:0} 10%{opacity:.8} 90%{opacity:.5} 100%{left:calc(100% + 8px);opacity:0} }
        @keyframes scfOrbit    { to { transform: rotate(360deg); } }
        @keyframes scfBarFill  { from{width:0} }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,180,255,.18); border-radius: 2px; }

        /* ── Shared card ── */
        .scf-card {
          background: rgba(2,12,28,.9);
          border: 1px solid rgba(0,160,220,.13);
          border-radius: 12px;
          position: relative;
          overflow: hidden;
          transition: border-color .3s, box-shadow .3s;
        }
        .scf-card:hover {
          border-color: rgba(0,212,255,.3);
          box-shadow: 0 0 28px rgba(0,180,255,.07);
        }
        .scf-card-scan::after {
          content:'';
          position:absolute;
          left:0; right:0; height:1px;
          background:linear-gradient(90deg,transparent,rgba(0,212,255,.25),transparent);
          animation: scfScanLine 5s ease-in-out infinite;
          pointer-events:none;
        }

        /* ── Nav ── */
        .scf-nav-link {
          display:flex; align-items:center; gap:10px;
          padding:9px 14px; border-radius:8px;
          font-size:13px; text-decoration:none;
          color:rgba(120,170,210,.65);
          transition:all .2s; margin-bottom:2px;
          border-left:2px solid transparent;
        }
        .scf-nav-link:hover {
          background:rgba(0,160,220,.06);
          color:rgba(160,210,240,.9);
        }
        .scf-nav-active {
          background:linear-gradient(90deg,rgba(0,180,255,.12),rgba(0,180,255,.03));
          border-left:2px solid #00d4ff !important;
          color:#00d4ff !important;
          border-radius:0 8px 8px 0 !important;
        }

        /* ── Buttons ── */
        .scf-btn-primary {
          background:linear-gradient(135deg,rgba(0,100,200,.85),rgba(0,55,140,.95));
          border:1px solid rgba(0,180,255,.3);
          color:#80d4ff; border-radius:8px;
          font-size:12.5px; font-weight:600;
          cursor:pointer; transition:all .2s;
          letter-spacing:.06em; text-transform:uppercase;
        }
        .scf-btn-primary:hover {
          background:linear-gradient(135deg,rgba(0,140,255,.9),rgba(0,75,200,1));
          border-color:rgba(0,220,255,.55);
          box-shadow:0 0 18px rgba(0,180,255,.3);
          color:#c8f0ff;
        }
        .scf-btn-primary:active { transform:scale(.98); }

        /* ── Inputs ── */
        .scf-input {
          background:rgba(2,12,30,.95);
          border:1px solid rgba(0,120,200,.22);
          color:#c8e6ff; border-radius:8px;
          font-size:13.5px; width:100%;
          padding:10px 12px; outline:none;
          transition:border-color .2s, box-shadow .2s;
        }
        .scf-input:focus {
          border-color:rgba(0,212,255,.5);
          box-shadow:0 0 0 3px rgba(0,180,255,.09);
        }
        .scf-input::placeholder { color:rgba(80,140,190,.3); }
        .scf-input:disabled { opacity:.35; cursor:not-allowed; }

        /* ── Badges ── */
        .scf-badge { font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; padding:2px 8px; border-radius:4px; display:inline-flex; align-items:center; }
        .scf-b-cyan   { background:rgba(0,180,255,.1);  border:1px solid rgba(0,180,255,.22); color:#00d4ff; }
        .scf-b-green  { background:rgba(0,255,136,.08); border:1px solid rgba(0,255,136,.18); color:#00e87a; }
        .scf-b-red    { background:rgba(255,40,70,.1);  border:1px solid rgba(255,40,70,.22); color:#ff4466; }
        .scf-b-yellow { background:rgba(255,170,0,.1);  border:1px solid rgba(255,170,0,.22); color:#ffbb00; }
        .scf-b-gray   { background:rgba(60,100,140,.1); border:1px solid rgba(60,100,140,.2); color:#6899bb; }

        /* ── Labels ── */
        .scf-label { font-size:10px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:rgba(0,160,220,.5); }

        /* ── Status dots ── */
        .scf-dot-green  { width:6px;height:6px;border-radius:50%;background:#00ff88;box-shadow:0 0 8px #00ff88;flex-shrink:0;animation:scfPulse 2s ease-in-out infinite; }
        .scf-dot-red    { width:6px;height:6px;border-radius:50%;background:#ff2244;box-shadow:0 0 8px #ff2244;flex-shrink:0;animation:scfPulse 1.5s ease-in-out infinite; }
        .scf-dot-yellow { width:6px;height:6px;border-radius:50%;background:#ffaa00;box-shadow:0 0 8px #ffaa00;flex-shrink:0;animation:scfPulse 2.5s ease-in-out infinite; }

        /* ── Table rows ── */
        .scf-tr { transition:background .2s; }
        .scf-tr:hover { background:rgba(0,120,200,.06) !important; }
      `}</style>

      {/* Grid background */}
      <div style={{
        position:'fixed', inset:0, pointerEvents:'none', zIndex:0,
        backgroundImage:'linear-gradient(rgba(0,180,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,180,255,.022) 1px,transparent 1px)',
        backgroundSize:'52px 52px',
      }} />
      {/* Ambient orbs */}
      <div style={{ position:'fixed', top:'-18%', left:'-8%', width:520, height:520, borderRadius:'50%', filter:'blur(160px)', background:'radial-gradient(circle,rgba(0,60,180,.07) 0%,transparent 70%)', pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', bottom:'-18%', right:'-8%', width:460, height:460, borderRadius:'50%', filter:'blur(140px)', background:'radial-gradient(circle,rgba(0,160,255,.05) 0%,transparent 70%)', pointerEvents:'none', zIndex:0 }} />

      {/* ════════════ SIDEBAR ════════════ */}
      <aside style={{
        width:218, flexShrink:0, position:'relative', zIndex:10,
        background:'linear-gradient(180deg,rgba(3,8,20,.99) 0%,rgba(4,11,26,.99) 100%)',
        borderRight:'1px solid rgba(0,160,220,.09)',
        display:'flex', flexDirection:'column',
      }}>
        {/* Sidebar top scan */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,rgba(0,212,255,.15),transparent)', pointerEvents:'none' }} />

        {/* Logo area */}
        <div style={{ padding:'18px 16px 16px', borderBottom:'1px solid rgba(0,160,220,.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {/* Orbital badge */}
            <div style={{ position:'relative', width:40, height:40, flexShrink:0 }}>
              <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'1px solid rgba(0,212,255,.18)', animation:'scfOrbit 14s linear infinite' }}>
                <div style={{ position:'absolute', top:-2.5, left:'50%', transform:'translateX(-50%)', width:5, height:5, borderRadius:'50%', background:'#00d4ff', boxShadow:'0 0 10px #00d4ff,0 0 20px rgba(0,212,255,.4)' }} />
              </div>
              <div style={{ position:'absolute', inset:6, borderRadius:'50%', border:'0.5px dashed rgba(0,180,255,.1)', animation:'scfSpinRev 9s linear infinite' }} />
              <div style={{ position:'absolute', inset:9, borderRadius:'50%', background:'linear-gradient(135deg,rgba(0,55,130,.95),rgba(0,25,70,1))', border:'1px solid rgba(0,180,255,.28)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 16px rgba(0,180,255,.22)' }}>
                <span style={{ fontSize:9, fontWeight:800, color:'#00d4ff', letterSpacing:'.03em' }}>IV</span>
              </div>
            </div>
            <div>
              <p style={{ margin:0, fontSize:13.5, fontWeight:700, color:'#c8e6ff', letterSpacing:'.01em' }}>Infovion</p>
              <p style={{ margin:0, fontSize:9, color:'rgba(0,180,255,.45)', letterSpacing:'.18em', textTransform:'uppercase' }}>Dev Console</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'10px 8px 6px' }}>
          <div style={{ padding:'7px 8px 5px' }}>
            <span className="scf-label">Navigation</span>
          </div>
          {NAV.map((item) => {
            const active = pathname.startsWith(item.path);
            return (
              <Link key={item.path} href={item.path}
                className={`scf-nav-link ${active ? 'scf-nav-active' : ''}`}
                style={{ marginLeft: active ? -8 : 0, marginRight: active ? -8 : 0, paddingLeft: active ? 22 : 14 }}
              >
                <span style={{ opacity: active ? 1 : 0.55, transition:'opacity .2s' }}>{item.icon}</span>
                <span style={{ fontWeight: active ? 600 : 400 }}>{item.label}</span>
                {active && (
                  <div style={{ marginLeft:'auto', width:5, height:5, borderRadius:'50%', background:'#00d4ff', boxShadow:'0 0 10px #00d4ff' }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding:'10px 14px 16px', borderTop:'1px solid rgba(0,160,220,.07)' }}>
          {/* Clock row */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span className="scf-label">System</span>
            <span style={{ fontSize:10, fontFamily:'monospace', color:'rgba(0,212,255,.45)', letterSpacing:'.08em' }}>{clock}</span>
          </div>
          {/* Status */}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
            <div className="scf-dot-green" />
            <span style={{ fontSize:9.5, color:'rgba(0,255,136,.6)', letterSpacing:'.12em', textTransform:'uppercase', fontWeight:700 }}>Operational</span>
          </div>
          {/* Admin info */}
          <p style={{ margin:'0 0 1px', fontSize:12.5, fontWeight:600, color:'#b0d0f0' }}>{admin?.name}</p>
          <p style={{ margin:'0 0 10px', fontSize:10.5, color:'rgba(70,130,180,.55)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{admin?.email}</p>
          <button onClick={() => void handleLogout()}
            style={{ width:'100%', padding:'6px', background:'none', border:'1px solid rgba(255,50,70,.2)', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700, color:'rgba(255,80,100,.55)', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .2s' }}
            onMouseEnter={e => { const t = e.currentTarget; t.style.borderColor='rgba(255,50,70,.5)'; t.style.color='#ff4466'; t.style.boxShadow='0 0 14px rgba(255,50,70,.15)'; }}
            onMouseLeave={e => { const t = e.currentTarget; t.style.borderColor='rgba(255,50,70,.2)'; t.style.color='rgba(255,80,100,.55)'; t.style.boxShadow='none'; }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* ════════════ MAIN ════════════ */}
      <main style={{ flex:1, overflowY:'auto', position:'relative', zIndex:1 }}>
        {children}
      </main>
    </div>
  );
}
