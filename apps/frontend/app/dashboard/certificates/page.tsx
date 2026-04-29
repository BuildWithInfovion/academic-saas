'use client';

import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Institution {
  name: string;
  board?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  stampUrl?: string;
  signatureUrl?: string;
  affiliationNo?: string;
  principalName?: string;
  udiseCode?: string;
  gstin?: string;
}

interface Student {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  fatherName?: string;
  motherName?: string;
  parentPhone?: string;
  address?: string;
  nationality?: string;
  religion?: string;
  casteCategory?: string;
  bloodGroup?: string;
  admissionDate?: string;
  photoUrl?: string;
  academicUnit?: { id: string; displayName?: string; name?: string };
}

interface AcademicYear { id: string; name: string; isCurrent: boolean; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s?: string | null) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
}

function className(s: Student) {
  return s.academicUnit?.displayName || s.academicUnit?.name || '—';
}

function openPrint(html: string) {
  const w = window.open('', '_blank', 'width=760,height=960');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}

function letterheadHtml(inst: Institution) {
  const subLine = [
    inst.board ? `Affiliated to ${esc(inst.board)}` : '',
    inst.affiliationNo ? `Affil No: ${esc(inst.affiliationNo)}` : '',
    inst.udiseCode ? `UDISE: ${esc(inst.udiseCode)}` : '',
  ].filter(Boolean).join('  ·  ');
  const contactLine = [
    inst.address ? esc(inst.address) : '',
    inst.phone ? `Ph: ${esc(inst.phone)}` : '',
    inst.email ? `Email: ${esc(inst.email)}` : '',
    inst.website ? esc(inst.website) : '',
  ].filter(Boolean).join('  ·  ');
  return `
    <div class="letterhead">
      ${inst.logoUrl ? `<img class="lh-logo" src="${esc(inst.logoUrl)}" alt="Logo" />` : '<div style="width:60px;flex-shrink:0"></div>'}
      <div class="lh-center">
        <div class="lh-name">${esc(inst.name)}</div>
        ${subLine ? `<div class="lh-sub">${subLine}</div>` : ''}
        ${contactLine ? `<div class="lh-sub">${contactLine}</div>` : ''}
      </div>
      ${inst.stampUrl ? `<img class="lh-stamp" src="${esc(inst.stampUrl)}" alt="Stamp" />` : '<div style="width:60px;flex-shrink:0"></div>'}
    </div>`;
}

function sigRowHtml(inst: Institution) {
  return `
    <div class="sig-row">
      <div class="sig-block">
        <div class="sig-line" style="width:160px"></div>
        Signature of Class Teacher
      </div>
      <div class="sig-block">
        ${inst.signatureUrl ? `<img src="${esc(inst.signatureUrl)}" alt="Signature" style="max-height:40px;max-width:130px;object-fit:contain;display:block;margin:0 auto 3px" />` : ''}
        <div class="sig-line" style="width:200px"></div>
        ${inst.principalName ? esc(inst.principalName) : 'Principal'} — Sign &amp; Seal
      </div>
    </div>`;
}

const BASE_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1e293b;margin:40px;line-height:1.7}
  .letterhead{display:flex;align-items:center;gap:16px;border-bottom:2px solid #1e293b;padding-bottom:14px;margin-bottom:24px}
  .lh-logo{width:60px;height:60px;object-fit:contain;flex-shrink:0}
  .lh-center{flex:1;text-align:center}
  .lh-name{font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
  .lh-sub{font-size:10.5px;color:#4b5563;line-height:1.7}
  .lh-stamp{width:60px;height:60px;object-fit:contain;flex-shrink:0;opacity:.8}
  .cert-title{text-align:center;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.16em;text-decoration:underline;margin-bottom:24px}
  .cert-no{text-align:right;font-size:11px;color:#6b7280;margin-bottom:20px}
  .body-text{font-size:13px;line-height:2;text-align:justify;margin-bottom:18px}
  .highlight{font-weight:700;text-decoration:underline}
  .purpose-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 16px;margin-bottom:22px;font-size:12.5px}
  .sig-row{display:flex;justify-content:space-between;align-items:flex-end;margin-top:32px}
  .sig-block{text-align:center;font-size:11px;color:#6b7280}
  .sig-line{border-top:1px solid #6b7280;margin:0 auto 4px}
  .footnote{font-size:10px;color:#9ca3af;text-align:center;margin-top:28px}
  @media print{body{margin:20px}@page{margin:16mm}}
`;

// ── Certificate generators ────────────────────────────────────────────────────

function printBonafide(student: Student, inst: Institution, yearName: string, purpose: string, certNo: string) {
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const dob = fmtDate(student.dateOfBirth);
  const html = `<!DOCTYPE html><html><head><title>Bonafide Certificate</title>
<style>${BASE_CSS}</style></head><body>
${letterheadHtml(inst)}
${certNo ? `<div class="cert-no">Certificate No: ${esc(certNo)}</div>` : ''}
<div class="cert-title">Bonafide Certificate</div>
<div class="body-text">
  This is to certify that <span class="highlight">${esc(student.firstName)} ${esc(student.lastName)}</span>,
  son / daughter of <span class="highlight">${esc(student.fatherName ?? 'N/A')}</span>,
  is a <em>bonafide</em> student of this institution, currently enrolled in
  <span class="highlight">${esc(className(student))}</span>
  for the academic year <span class="highlight">${esc(yearName)}</span>.
</div>
<div class="body-text">
  Date of Birth: <span class="highlight">${dob}</span>&nbsp;&nbsp;·&nbsp;&nbsp;
  Admission No.: <span class="highlight">${esc(student.admissionNo)}</span>
  ${student.nationality ? `&nbsp;&nbsp;·&nbsp;&nbsp;Nationality: <span class="highlight">${esc(student.nationality)}</span>` : ''}
</div>
${purpose ? `<div class="purpose-box">Purpose: This certificate is issued for <strong>${esc(purpose)}</strong>.</div>` : ''}
<div class="body-text">This certificate is issued on request of the student / parent.</div>
<div style="text-align:right;font-size:12px;color:#374151;margin-bottom:4px">Date: ${today}</div>
${sigRowHtml(inst)}
<div class="footnote">${esc(inst.name)}${inst.gstin ? `  ·  GSTIN: ${esc(inst.gstin)}` : ''}</div>
<script>window.onload=function(){window.print();}</script></body></html>`;
  openPrint(html);
}

function printCharacter(student: Student, inst: Institution, yearName: string, conduct: string, certNo: string) {
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const html = `<!DOCTYPE html><html><head><title>Character Certificate</title>
<style>${BASE_CSS}</style></head><body>
${letterheadHtml(inst)}
${certNo ? `<div class="cert-no">Certificate No: ${esc(certNo)}</div>` : ''}
<div class="cert-title">Character &amp; Conduct Certificate</div>
<div class="body-text">
  This is to certify that <span class="highlight">${esc(student.firstName)} ${esc(student.lastName)}</span>
  (Admission No: <span class="highlight">${esc(student.admissionNo)}</span>),
  son / daughter of <span class="highlight">${esc(student.fatherName ?? 'N/A')}</span>,
  was a student of this institution in <span class="highlight">${esc(className(student))}</span>
  during the academic year <span class="highlight">${esc(yearName)}</span>.
</div>
<div class="body-text">
  During the period of study, the student's character and conduct were found to be
  <span class="highlight">${esc(conduct || 'Good')}</span>.
  The student was regular, disciplined, and maintained a positive attitude in all academic and
  co-curricular activities.
</div>
<div class="body-text">
  We wish the student all success in future endeavours.
</div>
<div style="text-align:right;font-size:12px;color:#374151;margin-bottom:4px">Date: ${today}</div>
${sigRowHtml(inst)}
<div class="footnote">${esc(inst.name)}${inst.gstin ? `  ·  GSTIN: ${esc(inst.gstin)}` : ''}</div>
<script>window.onload=function(){window.print();}</script></body></html>`;
  openPrint(html);
}

function printIdCard(student: Student, inst: Institution) {
  const html = `<!DOCTYPE html><html><head><title>Student ID Card — ${esc(student.admissionNo)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;display:flex;justify-content:center;align-items:flex-start;padding:40px;min-height:100vh}
  .card{width:340px;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.15);background:#fff;font-size:13px;color:#1e293b}
  .card-top{background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:16px;display:flex;align-items:center;gap:12px}
  .card-logo{width:44px;height:44px;object-fit:contain;flex-shrink:0;background:#fff;border-radius:4px;padding:2px}
  .card-school{flex:1}
  .card-school-name{font-size:13px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.04em;line-height:1.3}
  .card-school-sub{font-size:9.5px;color:rgba(255,255,255,.6);margin-top:2px}
  .card-body{padding:16px;display:flex;gap:14px;align-items:flex-start}
  .student-photo{width:80px;height:96px;object-fit:cover;border-radius:8px;border:2px solid #e2e8f0;flex-shrink:0;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:10px;color:#94a3b8;text-align:center}
  .student-info{flex:1}
  .student-name{font-size:15px;font-weight:700;color:#0f172a;line-height:1.3;margin-bottom:6px}
  .info-row{font-size:11px;color:#475569;line-height:1.8}
  .info-row strong{color:#1e293b;font-weight:600}
  .card-footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:10px 16px;display:flex;justify-content:space-between;align-items:center}
  .adm-no{font-family:monospace;font-size:12px;font-weight:700;color:#0f172a}
  .valid{font-size:10px;color:#6b7280}
  .sig-box{text-align:center;padding:0 16px 14px}
  .sig-box img{max-height:34px;max-width:120px;object-fit:contain}
  .sig-label{font-size:9px;color:#9ca3af;border-top:1px solid #e2e8f0;padding-top:3px;margin-top:3px}
  @media print{body{background:#fff;padding:0}.card{box-shadow:none}}
</style></head><body>
<div class="card">
  <div class="card-top">
    ${inst.logoUrl ? `<img class="card-logo" src="${esc(inst.logoUrl)}" alt="Logo" />` : ''}
    <div class="card-school">
      <div class="card-school-name">${esc(inst.name)}</div>
      <div class="card-school-sub">${[inst.board, inst.address].filter(Boolean).map(esc).join('  ·  ')}</div>
    </div>
  </div>
  <div class="card-body">
    ${student.photoUrl
      ? `<img class="student-photo" src="${esc(student.photoUrl)}" alt="Photo" />`
      : `<div class="student-photo" style="display:flex;align-items:center;justify-content:center">No Photo</div>`}
    <div class="student-info">
      <div class="student-name">${esc(student.firstName)} ${esc(student.lastName)}</div>
      <div class="info-row"><strong>Class:</strong> ${esc(className(student))}</div>
      <div class="info-row"><strong>Adm. No:</strong> ${esc(student.admissionNo)}</div>
      ${student.dateOfBirth ? `<div class="info-row"><strong>DOB:</strong> ${fmtDate(student.dateOfBirth)}</div>` : ''}
      ${student.fatherName ? `<div class="info-row"><strong>Father:</strong> ${esc(student.fatherName)}</div>` : ''}
      ${student.parentPhone ? `<div class="info-row"><strong>Contact:</strong> ${esc(student.parentPhone)}</div>` : ''}
      ${student.bloodGroup ? `<div class="info-row"><strong>Blood Group:</strong> ${esc(student.bloodGroup)}</div>` : ''}
    </div>
  </div>
  ${inst.signatureUrl ? `<div class="sig-box"><img src="${esc(inst.signatureUrl)}" alt="Signature" /><div class="sig-label">${inst.principalName ? esc(inst.principalName) : 'Principal'}</div></div>` : ''}
  <div class="card-footer">
    <div class="adm-no">${esc(student.admissionNo)}</div>
    <div class="valid">STUDENT ID CARD</div>
  </div>
</div>
<script>window.onload=function(){window.print();}</script></body></html>`;
  openPrint(html);
}

// ── Main Component ────────────────────────────────────────────────────────────

const CERT_TYPES = [
  { id: 'bonafide', label: 'Bonafide Certificate', icon: '📄' },
  { id: 'character', label: 'Character Certificate', icon: '⭐' },
  { id: 'id_card', label: 'Student ID Card', icon: '🪪' },
] as const;

type CertType = typeof CERT_TYPES[number]['id'];

export default function CertificatesPage() {
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearId, setYearId] = useState('');
  const [certType, setCertType] = useState<CertType>('bonafide');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bonafide fields
  const [purpose, setPurpose] = useState('');
  const [certNo, setCertNo] = useState('');
  // Character fields
  const [conduct, setConduct] = useState('Good');

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    Promise.all([apiFetch('/academic/years'), apiFetch('/institution/me')])
      .then(([yrs, inst]) => {
        const list = Array.isArray(yrs) ? yrs : [];
        setYears(list);
        const cur = list.find((y: AcademicYear) => y.isCurrent) ?? list[0];
        if (cur) setYearId(cur.id);
        if (inst) setInstitution(inst as Institution);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch(`/students?search=${encodeURIComponent(query.trim())}&limit=8`);
        setResults(Array.isArray(res) ? res : (res as any)?.students ?? []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
  }, [query]);

  const selectStudent = async (hit: Student) => {
    setResults([]); setQuery('');
    try {
      const full = await apiFetch(`/students/${hit.id}`) as Student;
      setStudent(full);
    } catch {
      setStudent(hit);
    }
  };

  const handleGenerate = () => {
    if (!student || !institution) return;
    const yearName = years.find((y) => y.id === yearId)?.name ?? '';
    if (certType === 'bonafide') {
      printBonafide(student, institution, yearName, purpose, certNo);
    } else if (certType === 'character') {
      printCharacter(student, institution, yearName, conduct, certNo);
    } else if (certType === 'id_card') {
      printIdCard(student, institution);
    }
    showToast('Document opened for printing');
  };

  const unitLabel = (s: Student) => s.academicUnit?.displayName || s.academicUnit?.name || '';

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Certificates &amp; Documents</h1>
      <p className="text-sm text-ds-text3 mb-6">Generate bonafide, character certificates, and student ID cards</p>

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Certificate type selector */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {CERT_TYPES.map((ct) => (
          <button
            key={ct.id}
            onClick={() => setCertType(ct.id)}
            className={`rounded-xl border p-4 text-left transition-all ${certType === ct.id ? 'border-indigo-500 bg-indigo-50/60' : 'border-ds-border hover:border-indigo-300'}`}
            style={{ background: certType === ct.id ? 'rgba(99,102,241,.07)' : 'var(--surface)' }}
          >
            <div className="text-2xl mb-2">{ct.icon}</div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{ct.label}</div>
          </button>
        ))}
      </div>

      {/* Student search */}
      {!student ? (
        <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-1)' }}>Select Student</h3>
          <div className="relative max-w-md">
            <input
              className="field w-full"
              placeholder="Type name or admission number…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching && <div className="absolute right-3 top-2.5 w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
            {results.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-20 shadow-lg"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {results.map((s) => (
                  <button key={s.id} onClick={() => selectStudent(s)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-ds-bg2 border-b last:border-0 flex items-center justify-between"
                    style={{ borderColor: 'var(--border)' }}>
                    <span className="font-medium" style={{ color: 'var(--text-1)' }}>{s.firstName} {s.lastName}</span>
                    <span className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>
                      {s.admissionNo}{unitLabel(s) ? ` · ${unitLabel(s)}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-4 mb-5 flex items-center justify-between"
          style={{ background: 'rgba(99,102,241,.05)', border: '1px solid rgba(99,102,241,.2)' }}>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
              {student.firstName} {student.lastName}
            </p>
            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-3)' }}>
              {student.admissionNo}{unitLabel(student) ? ` · ${unitLabel(student)}` : ''}
            </p>
          </div>
          <button onClick={() => setStudent(null)} className="btn-secondary text-sm">Change</button>
        </div>
      )}

      {/* Certificate-specific options */}
      {student && (
        <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-1)' }}>Certificate Options</h3>

          {certType !== 'id_card' && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Academic Year</label>
                <select className="field w-full text-sm" value={yearId} onChange={(e) => setYearId(e.target.value)}>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Certificate No. (optional)</label>
                <input className="field w-full text-sm" placeholder="e.g. BON/2024/001"
                  value={certNo} onChange={(e) => setCertNo(e.target.value)} />
              </div>
            </div>
          )}

          {certType === 'bonafide' && (
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Purpose</label>
              <input className="field w-full text-sm" placeholder="e.g. Bank account opening, passport application…"
                value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </div>
          )}

          {certType === 'character' && (
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Conduct Grade</label>
              <select className="field w-full text-sm" value={conduct} onChange={(e) => setConduct(e.target.value)}>
                {['Excellent', 'Very Good', 'Good', 'Satisfactory'].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          )}

          {certType === 'id_card' && (
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              ID card will be generated with the student's photo, class, admission number, blood group, and parent contact.
              Make sure the student's photo is uploaded in their profile.
            </p>
          )}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={!student || !institution}
        className="btn-primary w-full text-sm"
        style={{ opacity: !student || !institution ? 0.5 : 1 }}
      >
        Generate &amp; Print {CERT_TYPES.find((c) => c.id === certType)?.label}
      </button>

      <p className="text-xs text-center mt-3" style={{ color: 'var(--text-3)' }}>
        The document will open in a new browser tab with a print dialog. Ensure pop-ups are allowed for this site.
      </p>
    </div>
  );
}
