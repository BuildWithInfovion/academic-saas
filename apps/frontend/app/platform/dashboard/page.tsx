'use client';

import { useEffect, useState } from 'react';
import { platformFetch } from '@/lib/platform-api';
import Link from 'next/link';

interface Stats {
  total: number; active: number; expiringSoon: number;
  expired: number; totalRevenue: number; pendingRevenue: number;
}
interface Client {
  id: string; name: string; code: string; institutionType: string;
  status: string; createdAt: string;
  subscription?: { endDate: string; status: string; maxStudents: number; totalAmount: number; };
  _count: { students: number; users: number };
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(n);
}
function daysLeft(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }

// Corner bracket decoration
function Corners({ color = 'rgba(0,212,255,.35)' }: { color?: string }) {
  const b: React.CSSProperties = { position:'absolute', width:10, height:10, borderColor:color, borderStyle:'solid' };
  return (
    <>
      <div style={{ ...b, top:6, left:6,   borderWidth:'1.5px 0 0 1.5px' }} />
      <div style={{ ...b, top:6, right:6,  borderWidth:'1.5px 1.5px 0 0' }} />
      <div style={{ ...b, bottom:6, left:6,  borderWidth:'0 0 1.5px 1.5px' }} />
      <div style={{ ...b, bottom:6, right:6, borderWidth:'0 1.5px 1.5px 0' }} />
    </>
  );
}

// Animated stat card
function StatCard({ label, value, sub, accent, icon, delay }: {
  label: string; value: string | number; sub?: string;
  accent: string; icon: React.ReactNode; delay: string;
}) {
  return (
    <div className="scf-card scf-card-scan" style={{
      padding:'20px 22px 18px',
      borderColor: `rgba(${accent},.14)`,
      animation:`scfReveal .5s ${delay} ease both`,
    }}>
      <Corners color={`rgba(${accent},.35)`} />
      {/* Top row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <span className="scf-label">{label}</span>
        <div style={{ color:`rgba(${accent},.7)`, opacity:.85 }}>{icon}</div>
      </div>
      {/* Value */}
      <p style={{
        margin:0, fontSize:28, fontWeight:800, letterSpacing:'-0.03em',
        color:`rgb(${accent})`,
        textShadow:`0 0 20px rgba(${accent},.5), 0 0 40px rgba(${accent},.2)`,
        animation:`scfCountIn .6s ${delay} ease both`,
        fontVariantNumeric:'tabular-nums',
      }}>
        {value}
      </p>
      {sub && <p style={{ margin:'4px 0 0', fontSize:10.5, color:'rgba(100,160,200,.45)', letterSpacing:'.06em' }}>{sub}</p>}
      {/* Bottom accent bar */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:1, background:`linear-gradient(90deg,transparent,rgba(${accent},.25),transparent)` }} />
    </div>
  );
}

export default function PlatformDashboardPage() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [scanRow, setScanRow] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([platformFetch('/platform/stats'), platformFetch('/platform/clients')])
      .then(([s, c]) => { setStats(s as Stats); setClients((c as Client[]).slice(0, 5)); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:16 }}>
      <div style={{ position:'relative', width:60, height:60 }}>
        <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid rgba(0,212,255,.15)' }} />
        <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid transparent', borderTopColor:'#00d4ff', animation:'scfSpin .8s linear infinite' }} />
        <div style={{ position:'absolute', inset:10, borderRadius:'50%', border:'1px solid transparent', borderTopColor:'rgba(0,212,255,.4)', animation:'scfSpinRev 1.2s linear infinite' }} />
      </div>
      <p style={{ fontSize:11, letterSpacing:'.18em', color:'rgba(0,180,255,.4)', textTransform:'uppercase', fontWeight:600 }}>Loading Systems…</p>
    </div>
  );

  if (error) return (
    <div style={{ padding:32 }}>
      <div style={{ background:'rgba(255,30,50,.07)', border:'1px solid rgba(255,30,50,.2)', borderRadius:12, padding:18 }}>
        <p style={{ margin:0, color:'#ff4466', fontSize:13 }}>{error}</p>
      </div>
    </div>
  );

  const CARDS = [
    { label:'Total Clients',  value: stats?.total ?? 0,         sub:'institutions',             accent:'160,200,255', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>, delay:'.0s' },
    { label:'Active',         value: stats?.active ?? 0,        sub:'running subscriptions',    accent:'0,230,120',   icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, delay:'.05s' },
    { label:'Expiring Soon',  value: stats?.expiringSoon ?? 0,  sub:'within 30 days',           accent:'255,180,0',   icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, delay:'.1s' },
    { label:'Expired',        value: stats?.expired ?? 0,       sub:'need renewal',             accent:'255,50,80',   icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>, delay:'.15s' },
    { label:'Total Revenue',  value: formatCurrency(stats?.totalRevenue ?? 0),   sub:'all time',    accent:'0,180,255',   icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, delay:'.2s' },
    { label:'Pending',        value: formatCurrency(stats?.pendingRevenue ?? 0), sub:'to collect',  accent:'255,140,0',   icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>, delay:'.25s' },
  ];

  return (
    <div style={{ padding:'28px 32px 40px', animation:'scfReveal .4s ease both' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom:28 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
          {/* HUD corner brackets around title */}
          <div style={{ position:'relative', display:'inline-block' }}>
            <div style={{ position:'absolute', top:-4, left:-8, width:8, height:8, borderTop:'1.5px solid rgba(0,212,255,.5)', borderLeft:'1.5px solid rgba(0,212,255,.5)' }} />
            <div style={{ position:'absolute', bottom:-4, right:-8, width:8, height:8, borderBottom:'1.5px solid rgba(0,212,255,.5)', borderRight:'1.5px solid rgba(0,212,255,.5)' }} />
            <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:'#e8f4ff', letterSpacing:'-.02em' }}>
              Platform Overview
            </h1>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ height:1, width:36, background:'linear-gradient(90deg,#00d4ff,transparent)' }} />
          <p style={{ margin:0, fontSize:11.5, color:'rgba(100,160,200,.55)', letterSpacing:'.06em' }}>All clients across the Infovion network</p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:32 }}>
        {CARDS.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      {/* ── Recent onboardings ── */}
      <div>
        {/* Section header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:3, height:16, background:'#00d4ff', borderRadius:2, boxShadow:'0 0 8px #00d4ff' }} />
            <span style={{ fontSize:13, fontWeight:600, color:'rgba(160,210,240,.85)', letterSpacing:'.04em' }}>Recent Onboardings</span>
          </div>
          <Link href="/platform/clients" style={{
            fontSize:11.5, color:'rgba(0,180,255,.6)', textDecoration:'none', letterSpacing:'.06em',
            padding:'4px 10px', border:'1px solid rgba(0,180,255,.15)', borderRadius:6,
            transition:'all .2s',
          }}
            onMouseEnter={e => { const t = e.currentTarget; t.style.color='#00d4ff'; t.style.borderColor='rgba(0,180,255,.35)'; }}
            onMouseLeave={e => { const t = e.currentTarget; t.style.color='rgba(0,180,255,.6)'; t.style.borderColor='rgba(0,180,255,.15)'; }}
          >
            View all →
          </Link>
        </div>

        <div className="scf-card" style={{ overflow:'hidden' }}>
          {clients.length === 0 ? (
            <div style={{ padding:48, textAlign:'center' }}>
              <p style={{ margin:0, color:'rgba(80,140,190,.4)', fontSize:13 }}>No clients onboarded yet</p>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(0,160,220,.1)' }}>
                  {['Institution','Code','Students','Subscription','Expires'].map((h) => (
                    <th key={h} style={{ padding:'11px 16px', textAlign:'left', fontSize:10, fontWeight:700, color:'rgba(0,180,255,.45)', letterSpacing:'.14em', textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((c, i) => {
                  const days = c.subscription ? daysLeft(c.subscription.endDate) : null;
                  const expStatus = days === null ? 'none' : days < 0 ? 'expired' : days <= 30 ? 'expiring' : 'ok';
                  return (
                    <tr key={c.id} className="scf-tr"
                      style={{ borderBottom: i < clients.length - 1 ? '1px solid rgba(0,160,220,.06)' : 'none', cursor:'default' }}
                      onMouseEnter={() => setScanRow(c.id)}
                      onMouseLeave={() => setScanRow(null)}
                    >
                      <td style={{ padding:'13px 16px' }}>
                        <Link href={`/platform/clients/${c.id}`} style={{ textDecoration:'none', color: scanRow === c.id ? '#00d4ff' : '#c8e6ff', fontWeight:600, fontSize:13.5, transition:'color .2s' }}>
                          {c.name}
                        </Link>
                        <p style={{ margin:'2px 0 0', fontSize:11, color:'rgba(80,140,190,.5)', textTransform:'capitalize' }}>{c.institutionType}</p>
                      </td>
                      <td style={{ padding:'13px 16px' }}>
                        <span style={{ fontFamily:'monospace', fontSize:11.5, color:'#00d4ff', background:'rgba(0,180,255,.08)', border:'1px solid rgba(0,180,255,.14)', padding:'2px 8px', borderRadius:4 }}>
                          {c.code}
                        </span>
                      </td>
                      <td style={{ padding:'13px 16px', fontSize:13, color:'rgba(140,190,220,.75)', fontVariantNumeric:'tabular-nums' }}>
                        {c._count.students.toLocaleString()}
                      </td>
                      <td style={{ padding:'13px 16px', fontSize:13, color:'rgba(140,190,220,.75)' }}>
                        {c.subscription ? `${c.subscription.maxStudents.toLocaleString()} seats` : <span style={{ color:'rgba(80,120,160,.4)' }}>—</span>}
                      </td>
                      <td style={{ padding:'13px 16px' }}>
                        {expStatus === 'none'     && <span style={{ color:'rgba(80,120,160,.4)', fontSize:13 }}>—</span>}
                        {expStatus === 'expired'  && <span className="scf-badge scf-b-red">Expired</span>}
                        {expStatus === 'expiring' && <span className="scf-badge scf-b-yellow">{days}d left</span>}
                        {expStatus === 'ok'       && <span style={{ fontSize:12, color:'rgba(100,160,200,.55)' }}>{days}d left</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
