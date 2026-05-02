'use client';

import { useEffect, useState, useCallback } from 'react';
import { platformFetch } from '@/lib/platform-api';
import Link from 'next/link';

interface Client {
  id: string; name: string; code: string; institutionType: string;
  planCode: string; status: string; createdAt: string;
  subscription?: { planName: string; maxStudents: number; pricePerUser: number; totalAmount: number; endDate: string; status: string; amountPaid?: number; };
  _count: { students: number; users: number };
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(n);
}
function daysLeft(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }

function Corners({ color = 'rgba(0,212,255,.3)' }: { color?: string }) {
  const b: React.CSSProperties = { position:'absolute', width:9, height:9, borderColor:color, borderStyle:'solid' };
  return (
    <>
      <div style={{ ...b, top:5, left:5,    borderWidth:'1.5px 0 0 1.5px' }} />
      <div style={{ ...b, top:5, right:5,   borderWidth:'1.5px 1.5px 0 0' }} />
      <div style={{ ...b, bottom:5, left:5,  borderWidth:'0 0 1.5px 1.5px' }} />
      <div style={{ ...b, bottom:5, right:5, borderWidth:'0 1.5px 1.5px 0' }} />
    </>
  );
}

function SubBadge({ sub }: { sub?: Client['subscription'] }) {
  if (!sub) return <span className="scf-badge scf-b-gray">No Sub</span>;
  const d = daysLeft(sub.endDate);
  if (d < 0)  return <span className="scf-badge scf-b-red">Expired</span>;
  if (d <= 30) return <span className="scf-badge scf-b-yellow">{d}d left</span>;
  return <span className="scf-badge scf-b-green">Active · {d}d</span>;
}

type Filter = 'all' | 'active' | 'expired' | 'no-sub' | 'over-limit';

export default function PlatformClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<Filter>('all');
  const [hoverRow, setHoverRow] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true); setError(null);
    try { setClients(await platformFetch('/platform/clients') as Client[]); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const isOverLimit = (c: Client) =>
    !!c.subscription && c._count.students > c.subscription.maxStudents;

  const filtered = clients.filter((c) => {
    if (filter === 'no-sub')     return !c.subscription;
    if (filter === 'expired')    return c.subscription && daysLeft(c.subscription.endDate) < 0;
    if (filter === 'active')     return c.subscription && daysLeft(c.subscription.endDate) >= 0;
    if (filter === 'over-limit') return isOverLimit(c);
    return true;
  });

  const overLimitCount = clients.filter(isOverLimit).length;

  const FILTERS: { key: Filter; label: string; accent: string }[] = [
    { key:'all',        label:'All',            accent:'0,180,255' },
    { key:'active',     label:'Active',         accent:'0,220,120' },
    { key:'expired',    label:'Expired',        accent:'255,50,80' },
    { key:'no-sub',     label:'No Subscription',accent:'255,150,0' },
    { key:'over-limit', label:`Over Limit${overLimitCount > 0 ? ` (${overLimitCount})` : ''}`, accent:'255,80,80' },
  ];

  return (
    <div style={{ padding:'28px 32px 40px', animation:'scfReveal .4s ease both' }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ margin:'0 0 6px', fontSize:22, fontWeight:700, color:'#e8f4ff', letterSpacing:'-.02em' }}>
            Clients
          </h1>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ height:1, width:28, background:'linear-gradient(90deg,#00d4ff,transparent)' }} />
            <p style={{ margin:0, fontSize:11.5, color:'rgba(100,160,200,.5)', letterSpacing:'.06em' }}>
              {clients.length} institution{clients.length !== 1 ? 's' : ''} on the network
            </p>
          </div>
        </div>
        <Link href="/platform/clients/new" className="scf-btn-primary"
          style={{ padding:'9px 18px', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:7 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Onboard Client
        </Link>
      </div>

      {/* ── Filter tabs ── */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {FILTERS.map(({ key, label, accent }) => {
          const active = filter === key;
          return (
            <button key={key} onClick={() => setFilter(key)}
              style={{
                padding:'6px 14px', borderRadius:7, fontSize:11.5, fontWeight:600,
                cursor:'pointer', letterSpacing:'.06em', textTransform:'uppercase',
                border:`1px solid ${active ? `rgba(${accent},.35)` : 'rgba(0,120,180,.15)'}`,
                background: active ? `rgba(${accent},.1)` : 'rgba(0,15,35,.7)',
                color: active ? `rgb(${accent})` : 'rgba(100,160,200,.5)',
                transition:'all .2s',
                boxShadow: active ? `0 0 12px rgba(${accent},.15)` : 'none',
              }}>
              {label}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ background:'rgba(255,30,50,.07)', border:'1px solid rgba(255,30,50,.2)', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
          <p style={{ margin:0, color:'#ff4466', fontSize:13 }}>{error}</p>
        </div>
      )}

      {/* ── Table ── */}
      <div className="scf-card" style={{ overflow:'hidden' }}>
        <Corners />

        {loading ? (
          <div style={{ padding:56, display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
            <div style={{ position:'relative', width:44, height:44 }}>
              <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid rgba(0,212,255,.12)' }} />
              <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid transparent', borderTopColor:'#00d4ff', animation:'scfSpin .8s linear infinite' }} />
            </div>
            <p style={{ margin:0, fontSize:11, letterSpacing:'.16em', color:'rgba(0,180,255,.35)', textTransform:'uppercase' }}>Fetching clients…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:56, textAlign:'center' }}>
            <p style={{ margin:0, color:'rgba(80,140,190,.35)', fontSize:13 }}>No clients found</p>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid rgba(0,160,220,.09)' }}>
                {['Institution','Login Code','Students','Seats','Total Fee','Subscription','Status',''].map((h) => (
                  <th key={h} style={{ padding:'11px 16px', textAlign:'left', fontSize:10, fontWeight:700, color:'rgba(0,180,255,.4)', letterSpacing:'.14em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const isHov = hoverRow === c.id;
                return (
                  <tr key={c.id} className="scf-tr"
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,160,220,.055)' : 'none' }}
                    onMouseEnter={() => setHoverRow(c.id)}
                    onMouseLeave={() => setHoverRow(null)}
                  >
                    <td style={{ padding:'12px 16px' }}>
                      <Link href={`/platform/clients/${c.id}`}
                        style={{ textDecoration:'none', fontWeight:600, fontSize:13.5, color: isHov ? '#00d4ff' : '#c8e6ff', transition:'color .2s', display:'block' }}>
                        {c.name}
                      </Link>
                      <p style={{ margin:'2px 0 0', fontSize:11, color:'rgba(80,140,190,.5)', textTransform:'capitalize' }}>{c.institutionType}</p>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{ fontFamily:'monospace', fontSize:11.5, color:'#00d4ff', background:'rgba(0,180,255,.07)', border:'1px solid rgba(0,180,255,.14)', padding:'2px 8px', borderRadius:4 }}>
                        {c.code}
                      </span>
                    </td>
                    <td style={{ padding:'12px 16px', fontVariantNumeric:'tabular-nums' }}>
                      {c.subscription ? (
                        <span style={{ fontSize:13, fontWeight: isOverLimit(c) ? 700 : 400, color: isOverLimit(c) ? '#ff4466' : 'rgba(140,190,220,.7)' }}>
                          {c._count.students.toLocaleString()}
                          <span style={{ color:'rgba(100,150,190,.4)', fontWeight:400 }}> / {c.subscription.maxStudents.toLocaleString()}</span>
                          {isOverLimit(c) && (
                            <span style={{ marginLeft:6, fontSize:10, background:'rgba(255,50,80,.15)', border:'1px solid rgba(255,50,80,.35)', color:'#ff4466', padding:'1px 5px', borderRadius:3, fontWeight:700, letterSpacing:'.04em' }}>
                              OVER
                            </span>
                          )}
                        </span>
                      ) : (
                        <span style={{ fontSize:13, color:'rgba(140,190,220,.7)' }}>{c._count.students.toLocaleString()}</span>
                      )}
                    </td>
                    <td style={{ padding:'12px 16px', fontSize:13, color:'rgba(140,190,220,.7)', fontVariantNumeric:'tabular-nums' }}>
                      {c.subscription?.maxStudents.toLocaleString() ?? <span style={{ color:'rgba(80,120,160,.35)' }}>—</span>}
                    </td>
                    <td style={{ padding:'12px 16px', fontSize:13, color:'rgba(140,190,220,.7)', fontVariantNumeric:'tabular-nums' }}>
                      {c.subscription ? fmt(c.subscription.totalAmount) : <span style={{ color:'rgba(80,120,160,.35)' }}>—</span>}
                    </td>
                    <td style={{ padding:'12px 16px' }}><SubBadge sub={c.subscription} /></td>
                    <td style={{ padding:'12px 16px' }}>
                      <span className={`scf-badge ${c.status === 'active' ? 'scf-b-green' : 'scf-b-gray'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <Link href={`/platform/clients/${c.id}`}
                        style={{ fontSize:11.5, color: isHov ? '#00d4ff' : 'rgba(0,160,220,.45)', textDecoration:'none', letterSpacing:'.04em', fontWeight:600, transition:'color .2s' }}>
                        Manage →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Total row */}
      {!loading && filtered.length > 0 && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
          <p style={{ margin:0, fontSize:11, color:'rgba(80,130,180,.4)', letterSpacing:'.06em' }}>
            Showing {filtered.length} of {clients.length} institutions
          </p>
        </div>
      )}
    </div>
  );
}
