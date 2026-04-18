'use client';

import { useEffect, useState } from 'react';
import { platformFetch } from '@/lib/platform-api';

interface AdminProfile {
  id: string; email: string; name: string;
  lastLoginAt: string | null; createdAt: string;
  loginLogs?: { id: string; ipAddress?: string; userAgent?: string; success: boolean; failReason?: string; createdAt: string }[];
}

function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { label:'12+ chars',        ok: password.length >= 12 },
    { label:'Uppercase',        ok: /[A-Z]/.test(password) },
    { label:'Lowercase',        ok: /[a-z]/.test(password) },
    { label:'Number',           ok: /\d/.test(password) },
    { label:'Special char',     ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const pct   = (score / checks.length) * 100;
  const color = score <= 2 ? '#ff4466' : score === 3 ? '#ffbb00' : score === 4 ? '#00aaff' : '#00e87a';
  const label = score <= 2 ? 'Weak' : score === 3 ? 'Fair' : score === 4 ? 'Good' : 'Strong';

  return (
    <div style={{ marginTop:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
        <div style={{ flex:1, height:3, background:'rgba(0,60,100,.5)', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:2, background:color, width:`${pct}%`, transition:'width .4s, background .4s', boxShadow:`0 0 8px ${color}` }} />
        </div>
        <span style={{ fontSize:10.5, fontWeight:700, color, letterSpacing:'.06em', textTransform:'uppercase', minWidth:42 }}>{label}</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 16px' }}>
        {checks.map((c) => (
          <p key={c.label} style={{ margin:0, fontSize:11, color: c.ok ? '#00e87a' : 'rgba(80,130,180,.4)', display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ fontSize:9 }}>{c.ok ? '▶' : '○'}</span>{c.label}
          </p>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid rgba(0,160,220,.06)' }}>
      <span style={{ fontSize:11.5, color:'rgba(80,140,190,.55)', letterSpacing:'.04em' }}>{label}</span>
      <span style={{ fontSize:13, color:'#c8e6ff', fontWeight:500 }}>{value}</span>
    </div>
  );
}

export default function PlatformProfilePage() {
  const [profile,    setProfile]   = useState<AdminProfile | null>(null);
  const [loadErr,    setLoadErr]   = useState<string | null>(null);
  const [curPwd,     setCurPwd]    = useState('');
  const [newPwd,     setNewPwd]    = useState('');
  const [confPwd,    setConfPwd]   = useState('');
  const [showCur,    setShowCur]   = useState(false);
  const [showNew,    setShowNew]   = useState(false);
  const [saving,     setSaving]    = useState(false);
  const [pwErr,      setPwErr]     = useState<string | null>(null);
  const [pwOk,       setPwOk]      = useState(false);
  const [showLogs,   setShowLogs]  = useState(false);

  useEffect(() => {
    platformFetch('/platform/auth/me')
      .then((d) => setProfile(d as AdminProfile))
      .catch((e: unknown) => setLoadErr(e instanceof Error ? e.message : 'Failed to load profile'));
  }, []);

  const handleChangePwd = async () => {
    setPwErr(null); setPwOk(false);
    if (!curPwd)  return setPwErr('Current password is required');
    if (!newPwd)  return setPwErr('New password is required');
    if (newPwd !== confPwd) return setPwErr('Passwords do not match');
    setSaving(true);
    try {
      await platformFetch('/platform/auth/change-password', {
        method:'POST', body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }),
      });
      setPwOk(true);
      setCurPwd(''); setNewPwd(''); setConfPwd('');
    } catch (e: unknown) {
      setPwErr(e instanceof Error ? e.message : 'Failed to change password');
    } finally { setSaving(false); }
  };

  if (loadErr) return (
    <div style={{ padding:32 }}>
      <div style={{ background:'rgba(255,30,50,.07)', border:'1px solid rgba(255,30,50,.2)', borderRadius:12, padding:18 }}>
        <p style={{ margin:0, color:'#ff4466', fontSize:13 }}>{loadErr}</p>
      </div>
    </div>
  );

  if (!profile) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:14 }}>
      <div style={{ position:'relative', width:44, height:44 }}>
        <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid rgba(0,212,255,.1)' }} />
        <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid transparent', borderTopColor:'#00d4ff', animation:'scfSpin .8s linear infinite' }} />
      </div>
      <p style={{ margin:0, fontSize:11, letterSpacing:'.16em', color:'rgba(0,180,255,.35)', textTransform:'uppercase' }}>Loading profile…</p>
    </div>
  );

  const mismatch = confPwd.length > 0 && confPwd !== newPwd;
  const canSave  = !saving && curPwd && newPwd && newPwd === confPwd;

  return (
    <div style={{ padding:'28px 32px 48px', maxWidth:560, animation:'scfReveal .4s ease both' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ margin:'0 0 6px', fontSize:22, fontWeight:700, color:'#e8f4ff', letterSpacing:'-.02em' }}>My Profile</h1>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ height:1, width:28, background:'linear-gradient(90deg,#00d4ff,transparent)' }} />
          <p style={{ margin:0, fontSize:11.5, color:'rgba(100,160,200,.5)', letterSpacing:'.06em' }}>Manage your account and credentials</p>
        </div>
      </div>

      {/* ── Account card ── */}
      <div className="scf-card" style={{ padding:'20px 22px', marginBottom:18, position:'relative' }}>
        {/* Corner brackets */}
        {(() => { const b: React.CSSProperties = { position:'absolute', width:9, height:9, borderColor:'rgba(0,212,255,.3)', borderStyle:'solid' }; return (<>
          <div style={{ ...b, top:5, left:5,    borderWidth:'1.5px 0 0 1.5px' }} />
          <div style={{ ...b, top:5, right:5,   borderWidth:'1.5px 1.5px 0 0' }} />
          <div style={{ ...b, bottom:5, left:5,  borderWidth:'0 0 1.5px 1.5px' }} />
          <div style={{ ...b, bottom:5, right:5, borderWidth:'0 1.5px 1.5px 0' }} />
        </>); })()}

        {/* Avatar row */}
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18, paddingBottom:16, borderBottom:'1px solid rgba(0,160,220,.07)' }}>
          <div style={{ position:'relative', width:48, height:48, flexShrink:0 }}>
            <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'1px solid rgba(0,212,255,.2)', animation:'scfSpin 18s linear infinite' }} />
            <div style={{ position:'absolute', inset:4, borderRadius:'50%', background:'linear-gradient(135deg,rgba(0,55,130,.9),rgba(0,25,70,1))', border:'1px solid rgba(0,180,255,.25)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 14px rgba(0,180,255,.18)' }}>
              <span style={{ fontSize:15, fontWeight:800, color:'#00d4ff' }}>
                {profile.name.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div>
            <p style={{ margin:'0 0 3px', fontSize:15, fontWeight:700, color:'#c8e6ff' }}>{profile.name}</p>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div className="scf-dot-green" style={{ width:5, height:5 }} />
              <span className="scf-badge scf-b-cyan" style={{ fontSize:9 }}>Platform Admin</span>
            </div>
          </div>
        </div>

        {/* Info rows */}
        <InfoRow label="Email" value={profile.email} />
        <InfoRow label="Last Login" value={profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' }) : 'First session'} />
        <InfoRow label="Account Created" value={new Date(profile.createdAt).toLocaleDateString('en-IN', { dateStyle:'medium' })} />
        <div style={{ borderBottom:'none' }}>
          <InfoRow label="Session" value="Active" />
        </div>
      </div>

      {/* ── Login logs ── */}
      {profile.loginLogs && profile.loginLogs.length > 0 && (
        <div className="scf-card" style={{ marginBottom:18, overflow:'hidden' }}>
          <button onClick={() => setShowLogs(!showLogs)}
            style={{ width:'100%', padding:'14px 18px', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:3, height:14, background:'rgba(0,180,255,.5)', borderRadius:2 }} />
              <span style={{ fontSize:12.5, fontWeight:600, color:'rgba(140,190,230,.7)', letterSpacing:'.04em' }}>Recent Login Activity</span>
              <span className="scf-badge scf-b-cyan" style={{ fontSize:9 }}>{profile.loginLogs.length}</span>
            </div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(0,160,220,.4)" strokeWidth="2" strokeLinecap="round"
              style={{ transition:'transform .25s', transform: showLogs ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showLogs && (
            <div style={{ borderTop:'1px solid rgba(0,160,220,.07)', animation:'scfReveal .25s ease both' }}>
              {profile.loginLogs.slice(0, 8).map((log, i) => (
                <div key={log.id} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'9px 18px',
                  borderBottom: i < Math.min(profile.loginLogs!.length, 8) - 1 ? '1px solid rgba(0,160,220,.05)' : 'none',
                }}>
                  <div className={log.success ? 'scf-dot-green' : 'scf-dot-red'} style={{ width:5, height:5 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontSize:12, color: log.success ? 'rgba(0,220,120,.7)' : 'rgba(255,70,90,.7)', fontWeight:600 }}>
                      {log.success ? 'Login successful' : `Failed — ${log.failReason?.replace(/_/g,' ') ?? 'unknown'}`}
                    </p>
                    <p style={{ margin:'2px 0 0', fontSize:10.5, color:'rgba(70,120,170,.5)', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {log.ipAddress ?? 'unknown ip'} · {log.userAgent?.split(' ')[0] ?? ''}
                    </p>
                  </div>
                  <span style={{ fontSize:10.5, color:'rgba(70,120,170,.45)', fontFamily:'monospace', flexShrink:0 }}>
                    {new Date(log.createdAt).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Change password ── */}
      <div className="scf-card" style={{ padding:'20px 22px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
          <div style={{ width:3, height:16, background:'#00d4ff', borderRadius:2, boxShadow:'0 0 8px #00d4ff' }} />
          <span style={{ fontSize:13, fontWeight:600, color:'rgba(160,210,240,.8)', letterSpacing:'.04em' }}>Change Password</span>
        </div>

        {pwOk && (
          <div style={{ background:'rgba(0,200,100,.07)', border:'1px solid rgba(0,200,100,.2)', borderRadius:8, padding:'10px 14px', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
            <div className="scf-dot-green" />
            <p style={{ margin:0, color:'#00e87a', fontSize:13 }}>Password updated successfully.</p>
          </div>
        )}
        {pwErr && (
          <div style={{ background:'rgba(255,30,50,.07)', border:'1px solid rgba(255,30,50,.18)', borderRadius:8, padding:'10px 14px', marginBottom:14 }}>
            <p style={{ margin:0, color:'#ff4466', fontSize:13 }}>{pwErr}</p>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Current password */}
          <div>
            <label className="scf-label" style={{ display:'block', marginBottom:6 }}>Current Password</label>
            <div style={{ position:'relative' }}>
              <input className="scf-input" type={showCur ? 'text' : 'password'} value={curPwd}
                onChange={(e) => setCurPwd(e.target.value)} disabled={saving} style={{ paddingRight:52 }} />
              <button type="button" onClick={() => setShowCur(v => !v)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:10.5, fontWeight:700, color:'rgba(0,180,255,.4)', letterSpacing:'.06em', textTransform:'uppercase' }}>
                {showCur ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="scf-label" style={{ display:'block', marginBottom:6 }}>New Password</label>
            <div style={{ position:'relative' }}>
              <input className="scf-input" type={showNew ? 'text' : 'password'} value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)} disabled={saving} style={{ paddingRight:52 }} />
              <button type="button" onClick={() => setShowNew(v => !v)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:10.5, fontWeight:700, color:'rgba(0,180,255,.4)', letterSpacing:'.06em', textTransform:'uppercase' }}>
                {showNew ? 'Hide' : 'Show'}
              </button>
            </div>
            <StrengthMeter password={newPwd} />
          </div>

          {/* Confirm password */}
          <div>
            <label className="scf-label" style={{ display:'block', marginBottom:6 }}>Confirm New Password</label>
            <input className="scf-input" type="password" value={confPwd}
              onChange={(e) => setConfPwd(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canSave && void handleChangePwd()}
              disabled={saving}
              style={{ borderColor: mismatch ? 'rgba(255,50,80,.4)' : undefined }} />
            {mismatch && <p style={{ margin:'5px 0 0', fontSize:11, color:'rgba(255,60,80,.6)' }}>Passwords do not match</p>}
          </div>

          <button onClick={() => void handleChangePwd()} disabled={!canSave} className="scf-btn-primary"
            style={{ padding:'11px', width:'100%', opacity: canSave ? 1 : .38, cursor: canSave ? 'pointer' : 'not-allowed' }}>
            {saving ? 'Updating…' : 'Update Password'}
          </button>

          <p style={{ margin:0, fontSize:10.5, color:'rgba(60,110,160,.4)', textAlign:'center', letterSpacing:'.04em' }}>
            Min 12 chars · uppercase · number · special character
          </p>
        </div>
      </div>
    </div>
  );
}
