'use client';

import { useEffect, useState } from 'react';
import { platformFetch } from '@/lib/platform-api';

type Ticket = {
  id: string; institutionName: string; submittedBy: string;
  submitterRole: string; subject: string; message: string;
  status: 'open' | 'resolved'; createdAt: string;
};

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type Filter = 'all' | 'open' | 'resolved';

export default function PlatformSupportPage() {
  const [tickets,    setTickets]   = useState<Ticket[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [fetchErr,   setFetchErr]  = useState<string | null>(null);
  const [filter,     setFilter]    = useState<Filter>('open');
  const [expanded,   setExpanded]  = useState<string | null>(null);
  const [resolving,  setResolving] = useState<string | null>(null);
  const [resolveErr, setResolveErr]= useState<string | null>(null);

  useEffect(() => {
    platformFetch('/platform/support-tickets')
      .then((d) => setTickets(d as Ticket[]))
      .catch((e: unknown) => setFetchErr(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, []);

  const resolve = async (id: string) => {
    setResolving(id); setResolveErr(null);
    try {
      await platformFetch(`/platform/support-tickets/${id}/resolve`, { method:'PATCH' });
      setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status:'resolved' } : t));
      setExpanded(null);
    } catch (e: unknown) {
      setResolveErr(e instanceof Error ? e.message : 'Failed to resolve');
    } finally { setResolving(null); }
  };

  const shown = tickets.filter((t) => filter === 'all' || t.status === filter);
  const openCount = tickets.filter((t) => t.status === 'open').length;

  const FILTERS: { key: Filter; label: string }[] = [
    { key:'open',     label:'Open' },
    { key:'resolved', label:'Resolved' },
    { key:'all',      label:'All' },
  ];

  return (
    <div style={{ padding:'28px 32px 40px', animation:'scfReveal .4s ease both' }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ margin:'0 0 6px', fontSize:22, fontWeight:700, color:'#e8f4ff', letterSpacing:'-.02em' }}>
            Support Tickets
          </h1>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ height:1, width:28, background:`linear-gradient(90deg,${openCount > 0 ? '#ff4466' : '#00d4ff'},transparent)` }} />
            <p style={{ margin:0, fontSize:11.5, letterSpacing:'.06em', color: openCount > 0 ? 'rgba(255,80,100,.6)' : 'rgba(0,220,120,.5)' }}>
              {openCount > 0 ? `${openCount} open ticket${openCount !== 1 ? 's' : ''} need attention` : 'All tickets resolved'}
            </p>
            {openCount > 0 && <div className="scf-dot-red" />}
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display:'flex', gap:6 }}>
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            const accent = key === 'open' ? '255,50,80' : key === 'resolved' ? '0,220,120' : '0,180,255';
            return (
              <button key={key} onClick={() => setFilter(key)}
                style={{
                  padding:'6px 14px', borderRadius:7, fontSize:11, fontWeight:700,
                  cursor:'pointer', letterSpacing:'.1em', textTransform:'uppercase',
                  border:`1px solid ${active ? `rgba(${accent},.35)` : 'rgba(0,120,180,.15)'}`,
                  background: active ? `rgba(${accent},.1)` : 'rgba(0,15,35,.7)',
                  color: active ? `rgb(${accent})` : 'rgba(100,160,200,.45)',
                  transition:'all .2s',
                }}>
                {label}
                {key === 'open' && openCount > 0 && (
                  <span style={{ marginLeft:6, background:'rgba(255,50,80,.25)', borderRadius:10, padding:'1px 5px', fontSize:9 }}>{openCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {resolveErr && (
        <div style={{ background:'rgba(255,30,50,.07)', border:'1px solid rgba(255,30,50,.2)', borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <p style={{ margin:0, color:'#ff4466', fontSize:13 }}>{resolveErr}</p>
          <button onClick={() => setResolveErr(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,80,100,.6)', fontSize:16, lineHeight:1 }}>×</button>
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, paddingTop:80 }}>
          <div style={{ position:'relative', width:44, height:44 }}>
            <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid rgba(0,212,255,.1)' }} />
            <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid transparent', borderTopColor:'#00d4ff', animation:'scfSpin .8s linear infinite' }} />
          </div>
          <p style={{ margin:0, fontSize:11, letterSpacing:'.16em', color:'rgba(0,180,255,.35)', textTransform:'uppercase' }}>Loading tickets…</p>
        </div>
      ) : fetchErr ? (
        <div style={{ background:'rgba(255,30,50,.07)', border:'1px solid rgba(255,30,50,.18)', borderRadius:12, padding:32, textAlign:'center' }}>
          <p style={{ margin:'0 0 4px', color:'#ff4466', fontSize:14, fontWeight:600 }}>Failed to load tickets</p>
          <p style={{ margin:0, color:'rgba(255,80,100,.5)', fontSize:12 }}>{fetchErr}</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="scf-card" style={{ padding:56, textAlign:'center' }}>
          <p style={{ margin:0, color:'rgba(80,140,190,.35)', fontSize:13 }}>
            No {filter !== 'all' ? filter : ''} tickets found
          </p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {shown.map((t, idx) => {
            const isOpen = t.status === 'open';
            const isExp  = expanded === t.id;
            return (
              <div key={t.id} className="scf-card"
                style={{
                  borderColor: isOpen ? 'rgba(255,50,80,.16)' : 'rgba(0,160,220,.1)',
                  animation:`scfReveal .35s ${idx * .04}s ease both`,
                  boxShadow: isOpen && isExp ? '0 0 24px rgba(255,50,80,.06)' : undefined,
                }}>
                {/* Ticket header row */}
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'14px 18px', cursor:'pointer' }}
                  onClick={() => setExpanded(isExp ? null : t.id)}>

                  <div style={{ display:'flex', alignItems:'flex-start', gap:12, minWidth:0 }}>
                    {/* Status indicator */}
                    <div style={{ marginTop:5, flexShrink:0 }}>
                      {isOpen ? <div className="scf-dot-red" /> : <div className="scf-dot-green" />}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <p style={{ margin:'0 0 4px', fontSize:13.5, fontWeight:600, color:'#c8e6ff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {t.subject}
                      </p>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 10px', alignItems:'center' }}>
                        <span style={{ fontSize:11, color:'#00d4ff', fontWeight:600 }}>{t.institutionName}</span>
                        <span style={{ fontSize:10, color:'rgba(80,130,180,.5)' }}>·</span>
                        <span style={{ fontSize:11, color:'rgba(100,160,200,.55)' }}>{t.submittedBy}</span>
                        <span style={{ fontSize:10, color:'rgba(80,130,180,.5)' }}>·</span>
                        <span style={{ fontSize:11, color:'rgba(100,160,200,.45)', textTransform:'capitalize' }}>{t.submitterRole}</span>
                        <span style={{ fontSize:10, color:'rgba(80,130,180,.5)' }}>·</span>
                        <span style={{ fontSize:11, color:'rgba(80,130,180,.5)', fontFamily:'monospace' }}>{timeAgo(t.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display:'flex', alignItems:'center', gap:10, marginLeft:12, flexShrink:0 }}>
                    <span className={`scf-badge ${isOpen ? 'scf-b-red' : 'scf-b-green'}`}>
                      {t.status}
                    </span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(100,160,200,.4)" strokeWidth="2" strokeLinecap="round"
                      style={{ transition:'transform .25s', transform: isExp ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink:0 }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>

                {/* Expanded message */}
                {isExp && (
                  <div style={{ padding:'0 18px 18px', borderTop:'1px solid rgba(0,160,220,.07)', animation:'scfReveal .25s ease both' }}>
                    <p style={{ margin:'16px 0 0', fontSize:13.5, color:'rgba(160,200,230,.75)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
                      {t.message}
                    </p>
                    {isOpen && (
                      <button onClick={() => void resolve(t.id)} disabled={resolving === t.id}
                        style={{
                          marginTop:16, padding:'7px 18px', fontSize:11.5, fontWeight:700,
                          letterSpacing:'.1em', textTransform:'uppercase', borderRadius:8,
                          background: resolving === t.id ? 'rgba(0,180,100,.3)' : 'rgba(0,200,100,.12)',
                          border:'1px solid rgba(0,200,100,.3)', color:'#00e87a',
                          cursor: resolving === t.id ? 'default' : 'pointer',
                          transition:'all .2s', opacity: resolving === t.id ? .6 : 1,
                        }}
                        onMouseEnter={e => { if (resolving !== t.id) { const el = e.currentTarget; el.style.background='rgba(0,200,100,.22)'; el.style.boxShadow='0 0 16px rgba(0,200,100,.2)'; } }}
                        onMouseLeave={e => { const el = e.currentTarget; el.style.background='rgba(0,200,100,.12)'; el.style.boxShadow='none'; }}
                      >
                        {resolving === t.id ? 'Resolving…' : '✓ Mark Resolved'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
