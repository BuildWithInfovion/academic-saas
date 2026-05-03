'use client';

import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '@/lib/api';

import type { Institution, Student, AcademicYear } from '@/lib/types';

// ── Customisation state shapes ─────────────────────────────────────────────────

interface BonafideOpts {
  showDob: boolean; showNationality: boolean; showReligion: boolean;
  showCaste: boolean; showBloodGroup: boolean; showMother: boolean;
  showAddress: boolean; customNote: string;
}
interface CharacterOpts {
  conduct: string; customConductText: string; showDob: boolean; showClass: boolean;
  remarks: string;
}
interface IdCardOpts {
  showDob: boolean; showFather: boolean; showContact: boolean;
  showBloodGroup: boolean; showAddress: boolean; validYear: string; accentColor: string;
}

const DEFAULT_BONAFIDE: BonafideOpts = {
  showDob: true, showNationality: true, showReligion: false,
  showCaste: false, showBloodGroup: false, showMother: false,
  showAddress: false, customNote: '',
};
const DEFAULT_CHARACTER: CharacterOpts = {
  conduct: 'Good', customConductText: '',
  showDob: false, showClass: true, remarks: '',
};
const DEFAULT_IDCARD: IdCardOpts = {
  showDob: true, showFather: true, showContact: true,
  showBloodGroup: true, showAddress: false,
  validYear: String(new Date().getFullYear() + 1),
  accentColor: '#0f172a',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s?: string | null) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
}
function cls(s: Student) { return s.academicUnit?.displayName || s.academicUnit?.name || '—'; }
function openPrint(html: string) {
  const w = window.open('', '_blank', 'width=780,height=980');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}

const BASE_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1e293b;margin:40px;line-height:1.7}
  .letterhead{display:flex;align-items:center;gap:16px;border-bottom:2px solid #1e293b;padding-bottom:14px;margin-bottom:24px}
  .lh-logo{width:64px;height:64px;object-fit:contain;flex-shrink:0}
  .lh-center{flex:1;text-align:center}
  .lh-name{font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
  .lh-sub{font-size:10.5px;color:#4b5563;line-height:1.7}
  .lh-stamp{width:64px;height:64px;object-fit:contain;flex-shrink:0;opacity:.8}
  .cert-title{text-align:center;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.16em;text-decoration:underline;margin-bottom:24px}
  .cert-no{text-align:right;font-size:11px;color:#6b7280;margin-bottom:20px}
  .body-text{font-size:13px;line-height:2;text-align:justify;margin-bottom:18px}
  .highlight{font-weight:700;text-decoration:underline}
  .purpose-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 16px;margin-bottom:22px;font-size:12.5px}
  .sig-row{display:flex;justify-content:space-between;align-items:flex-end;margin-top:36px}
  .sig-block{text-align:center;font-size:11px;color:#6b7280}
  .sig-line{border-top:1px solid #6b7280;margin:0 auto 4px}
  .footnote{font-size:10px;color:#9ca3af;text-align:center;margin-top:28px}
  @media print{body{margin:20px}@page{margin:16mm}}
`;

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
      ${inst.logoUrl ? `<img class="lh-logo" src="${esc(inst.logoUrl)}" alt="Logo" />` : '<div style="width:64px;flex-shrink:0"></div>'}
      <div class="lh-center">
        <div class="lh-name">${esc(inst.name)}</div>
        ${subLine ? `<div class="lh-sub">${subLine}</div>` : ''}
        ${contactLine ? `<div class="lh-sub">${contactLine}</div>` : ''}
      </div>
      ${inst.stampUrl ? `<img class="lh-stamp" src="${esc(inst.stampUrl)}" alt="Stamp" />` : '<div style="width:64px;flex-shrink:0"></div>'}
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

// ── Certificate generators ────────────────────────────────────────────────────

function printBonafide(
  student: Student, inst: Institution, yearName: string,
  purpose: string, certNo: string, opts: BonafideOpts,
) {
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const html = `<!DOCTYPE html><html><head><title>Bonafide Certificate</title>
<style>${BASE_CSS}</style></head><body>
${letterheadHtml(inst)}
${certNo ? `<div class="cert-no">Certificate No: ${esc(certNo)}</div>` : ''}
<div class="cert-title">Bonafide Certificate</div>
<div class="body-text">
  This is to certify that <span class="highlight">${esc(student.firstName)} ${esc(student.lastName)}</span>,
  ${opts.showMother
    ? `son / daughter of <span class="highlight">${esc(student.fatherName ?? 'N/A')}</span> and <span class="highlight">${esc(student.motherName ?? 'N/A')}</span>,`
    : `son / daughter of <span class="highlight">${esc(student.fatherName ?? 'N/A')}</span>,`}
  is a <em>bonafide</em> student of this institution, currently enrolled in
  <span class="highlight">${esc(cls(student))}</span>
  for the academic year <span class="highlight">${esc(yearName)}</span>.
</div>
<div class="body-text">
  Admission No.: <span class="highlight">${esc(student.admissionNo)}</span>
  ${opts.showDob ? `&nbsp;&nbsp;·&nbsp;&nbsp;Date of Birth: <span class="highlight">${fmtDate(student.dateOfBirth)}</span>` : ''}
  ${opts.showNationality && student.nationality ? `&nbsp;&nbsp;·&nbsp;&nbsp;Nationality: <span class="highlight">${esc(student.nationality)}</span>` : ''}
  ${opts.showBloodGroup && student.bloodGroup ? `&nbsp;&nbsp;·&nbsp;&nbsp;Blood Group: <span class="highlight">${esc(student.bloodGroup)}</span>` : ''}
</div>
${opts.showReligion && (student.religion || student.casteCategory) ? `<div class="body-text">
  ${student.religion ? `Religion: <span class="highlight">${esc(student.religion)}</span>` : ''}
  ${opts.showCaste && student.casteCategory ? `&nbsp;&nbsp;·&nbsp;&nbsp;Category: <span class="highlight">${esc(student.casteCategory)}</span>` : ''}
</div>` : ''}
${opts.showAddress && student.address ? `<div class="body-text">Address: <span class="highlight">${esc(student.address)}</span></div>` : ''}
${purpose ? `<div class="purpose-box">Purpose: This certificate is issued for <strong>${esc(purpose)}</strong>.</div>` : ''}
${opts.customNote ? `<div class="body-text">${esc(opts.customNote)}</div>` : ''}
<div class="body-text">This certificate is issued on request of the student / parent.</div>
<div style="text-align:right;font-size:12px;color:#374151;margin-bottom:4px">Date: ${today}</div>
${sigRowHtml(inst)}
<div class="footnote">${esc(inst.name)}${inst.gstin ? `  ·  GSTIN: ${esc(inst.gstin)}` : ''}</div>
<script>window.onload=function(){window.print();}</script></body></html>`;
  openPrint(html);
}

function printCharacter(
  student: Student, inst: Institution, yearName: string,
  certNo: string, opts: CharacterOpts,
) {
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const conductText = opts.customConductText.trim() ||
    `During the period of study, the student's character and conduct were found to be <span class="highlight">${esc(opts.conduct || 'Good')}</span>. The student was regular, disciplined, and maintained a positive attitude in all academic and co-curricular activities.`;
  const html = `<!DOCTYPE html><html><head><title>Character Certificate</title>
<style>${BASE_CSS}</style></head><body>
${letterheadHtml(inst)}
${certNo ? `<div class="cert-no">Certificate No: ${esc(certNo)}</div>` : ''}
<div class="cert-title">Character &amp; Conduct Certificate</div>
<div class="body-text">
  This is to certify that <span class="highlight">${esc(student.firstName)} ${esc(student.lastName)}</span>
  (Admission No: <span class="highlight">${esc(student.admissionNo)}</span>),
  son / daughter of <span class="highlight">${esc(student.fatherName ?? 'N/A')}</span>,
  ${opts.showClass ? `was a student of this institution in <span class="highlight">${esc(cls(student))}</span>` : 'was a student of this institution'}
  during the academic year <span class="highlight">${esc(yearName)}</span>.
  ${opts.showDob ? `Date of Birth: <span class="highlight">${fmtDate(student.dateOfBirth)}</span>.` : ''}
</div>
<div class="body-text">${conductText}</div>
${opts.remarks ? `<div class="body-text">${esc(opts.remarks)}</div>` : ''}
<div class="body-text">We wish the student all success in future endeavours.</div>
<div style="text-align:right;font-size:12px;color:#374151;margin-bottom:4px">Date: ${today}</div>
${sigRowHtml(inst)}
<div class="footnote">${esc(inst.name)}${inst.gstin ? `  ·  GSTIN: ${esc(inst.gstin)}` : ''}</div>
<script>window.onload=function(){window.print();}</script></body></html>`;
  openPrint(html);
}

function printIdCard(student: Student, inst: Institution, photoSrc: string | undefined, opts: IdCardOpts) {
  const accent = esc(opts.accentColor || '#0f172a');
  const html = `<!DOCTYPE html><html><head><title>Student ID Card — ${esc(student.admissionNo)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;display:flex;justify-content:center;align-items:flex-start;padding:40px;min-height:100vh}
  .card{width:340px;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.15);background:#fff;font-size:13px;color:#1e293b}
  .card-top{background:${accent};padding:16px;display:flex;align-items:center;gap:12px}
  .card-logo{width:44px;height:44px;object-fit:contain;flex-shrink:0;background:#fff;border-radius:4px;padding:2px}
  .card-school{flex:1;min-width:0}
  .card-school-name{font-size:13px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.04em;line-height:1.3}
  .card-school-sub{font-size:9.5px;color:rgba(255,255,255,.6);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-body{padding:16px;display:flex;gap:14px;align-items:flex-start}
  .photo-wrap{width:80px;height:96px;flex-shrink:0;border-radius:8px;border:2px solid #e2e8f0;background:#f8fafc;overflow:hidden;display:flex;align-items:center;justify-content:center}
  .photo-wrap img{width:100%;height:100%;object-fit:cover}
  .photo-placeholder{font-size:9.5px;color:#94a3b8;text-align:center;padding:4px;line-height:1.4}
  .student-info{flex:1}
  .student-name{font-size:15px;font-weight:700;color:#0f172a;line-height:1.3;margin-bottom:6px}
  .info-row{font-size:11px;color:#475569;line-height:1.8}
  .info-row strong{color:#1e293b;font-weight:600}
  .card-footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:10px 16px;display:flex;justify-content:space-between;align-items:center}
  .adm-no{font-family:monospace;font-size:12px;font-weight:700;color:#0f172a}
  .valid-lbl{font-size:9.5px;color:#6b7280}
  .sig-box{text-align:center;padding:0 16px 14px}
  .sig-box img{max-height:34px;max-width:120px;object-fit:contain}
  .sig-label{font-size:9px;color:#9ca3af;border-top:1px solid #e2e8f0;padding-top:3px;margin-top:3px}
  @media print{body{background:#fff;padding:0}.card{box-shadow:none;border-radius:0}}
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
    <div class="photo-wrap">
      ${photoSrc
        ? `<img src="${esc(photoSrc)}" alt="Photo" />`
        : `<div class="photo-placeholder">STUDENT<br/>PHOTO</div>`}
    </div>
    <div class="student-info">
      <div class="student-name">${esc(student.firstName)} ${esc(student.lastName)}</div>
      <div class="info-row"><strong>Class:</strong> ${esc(cls(student))}</div>
      <div class="info-row"><strong>Adm. No:</strong> ${esc(student.admissionNo)}</div>
      ${opts.showDob && student.dateOfBirth ? `<div class="info-row"><strong>DOB:</strong> ${fmtDate(student.dateOfBirth)}</div>` : ''}
      ${opts.showFather && student.fatherName ? `<div class="info-row"><strong>Father:</strong> ${esc(student.fatherName)}</div>` : ''}
      ${opts.showContact && student.parentPhone ? `<div class="info-row"><strong>Contact:</strong> ${esc(student.parentPhone)}</div>` : ''}
      ${opts.showBloodGroup && student.bloodGroup ? `<div class="info-row"><strong>Blood Grp:</strong> ${esc(student.bloodGroup)}</div>` : ''}
      ${opts.showAddress && student.address ? `<div class="info-row"><strong>Address:</strong> ${esc(student.address)}</div>` : ''}
    </div>
  </div>
  ${inst.signatureUrl ? `<div class="sig-box"><img src="${esc(inst.signatureUrl)}" alt="Signature" /><div class="sig-label">${inst.principalName ? esc(inst.principalName) : 'Principal'}</div></div>` : ''}
  <div class="card-footer">
    <div class="adm-no">${esc(student.admissionNo)}</div>
    <div class="valid-lbl">Valid till: ${esc(opts.validYear)} &nbsp;·&nbsp; STUDENT ID</div>
  </div>
</div>
<script>window.onload=function(){window.print();}</script></body></html>`;
  openPrint(html);
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        onClick={onChange}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
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

  // Cert options
  const [certNo, setCertNo] = useState('');
  const [purpose, setPurpose] = useState('');
  const [bonafide, setBonafide] = useState<BonafideOpts>({ ...DEFAULT_BONAFIDE });
  const [character, setCharacter] = useState<CharacterOpts>({ ...DEFAULT_CHARACTER });
  const [idCard, setIdCard] = useState<IdCardOpts>({ ...DEFAULT_IDCARD });

  // Photo upload state
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [showCustomize, setShowCustomize] = useState(false);
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

  // Reset photo when student changes
  useEffect(() => {
    setPhotoDataUrl(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  }, [student]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        // /students?search=... returns { data: [...], meta: {...} }
        const res = await apiFetch(`/students?search=${encodeURIComponent(query.trim())}&limit=8`);
        setResults((res as any)?.data ?? []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
  }, [query]);

  const selectStudent = async (hit: Student) => {
    setResults([]); setQuery('');
    try {
      const full = await apiFetch(`/students/${hit.id}`) as Student;
      setStudent(full);
    } catch { setStudent(hit); }
  };

  // Upload photo to Cloudinary then persist to student record
  const handlePhotoUpload = async (file: File) => {
    if (!student) return;
    setPhotoUploading(true);
    try {
      // Read as data URL for immediate preview in the print
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setPhotoDataUrl(dataUrl);

      // Upload to Cloudinary (get signature, then upload directly)
      const sig = await apiFetch<{
        signature: string; timestamp: number; apiKey: string; cloudName: string; folder: string;
      }>(`/students/${student.id}/photo-signature`);

      const fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', sig.apiKey);
      fd.append('timestamp', String(sig.timestamp));
      fd.append('signature', sig.signature);
      fd.append('folder', sig.folder);
      const upload = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
        method: 'POST', body: fd,
      });
      if (!upload.ok) throw new Error('Upload failed');
      const data = await upload.json() as { secure_url: string };

      // Save permanently to student record
      await apiFetch(`/students/${student.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ photoUrl: data.secure_url }),
      });
      setStudent((prev) => prev ? { ...prev, photoUrl: data.secure_url } : prev);
      showToast('Photo saved to student profile');
    } catch (e: any) {
      showToast(e.message || 'Photo upload failed', false);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleGenerate = () => {
    if (!student || !institution) return;
    const yearName = years.find((y) => y.id === yearId)?.name ?? '';
    const photoSrc = photoDataUrl ?? student.photoUrl ?? undefined;
    if (certType === 'bonafide') printBonafide(student, institution, yearName, purpose, certNo, bonafide);
    else if (certType === 'character') printCharacter(student, institution, yearName, certNo, character);
    else if (certType === 'id_card') printIdCard(student, institution, photoSrc, idCard);
    showToast('Document opened for printing');
  };

  const unitLabel = (s: Student) => s.academicUnit?.displayName || s.academicUnit?.name || '';
  const photoSrc = photoDataUrl ?? student?.photoUrl ?? null;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Certificates &amp; Documents</h1>
      <p className="text-sm text-slate-500 mb-6">Generate bonafide, character certificates, and student ID cards</p>

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
            onClick={() => { setCertType(ct.id); setShowCustomize(false); }}
            className={`rounded-xl border-2 p-4 text-left transition-all ${certType === ct.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'}`}
          >
            <div className="text-2xl mb-2">{ct.icon}</div>
            <div className={`text-sm font-semibold ${certType === ct.id ? 'text-indigo-700' : 'text-slate-800'}`}>{ct.label}</div>
          </button>
        ))}
      </div>

      {/* Student search */}
      {!student ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <h3 className="font-semibold text-slate-800 text-sm mb-3">Select Student</h3>
          <div className="relative max-w-md">
            <input
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Type name or admission number…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching && <div className="absolute right-3 top-3 w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
            {results.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-20 shadow-lg bg-white border border-slate-200">
                {results.map((s) => (
                  <button key={s.id} onClick={() => void selectStudent(s)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 border-b border-slate-100 last:border-0 flex items-center justify-between">
                    <span className="font-medium text-slate-900">{s.firstName} {s.lastName}</span>
                    <span className="text-xs font-mono text-slate-400">{s.admissionNo}{unitLabel(s) ? ` · ${unitLabel(s)}` : ''}</span>
                  </button>
                ))}
              </div>
            )}
            {query.length >= 2 && !searching && results.length === 0 && (
              <div className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-20 shadow-lg bg-white border border-slate-200 px-4 py-3 text-sm text-slate-400">
                No students found for &ldquo;{query}&rdquo;
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {photoSrc ? (
              <img src={photoSrc} alt="Photo" className="w-10 h-12 object-cover rounded border border-indigo-200" />
            ) : (
              <div className="w-10 h-12 bg-indigo-100 rounded border border-indigo-200 flex items-center justify-center text-indigo-400 text-xs">No<br/>Photo</div>
            )}
            <div>
              <p className="font-semibold text-sm text-slate-900">{student.firstName} {student.lastName}</p>
              <p className="text-xs font-mono mt-0.5 text-slate-500">{student.admissionNo}{unitLabel(student) ? ` · ${unitLabel(student)}` : ''}</p>
            </div>
          </div>
          <button onClick={() => setStudent(null)} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-white">Change</button>
        </div>
      )}

      {/* Photo upload — shown for all types once student selected */}
      {student && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <h3 className="font-semibold text-slate-800 text-sm mb-3">
            Student Photo
            {certType !== 'id_card' && <span className="font-normal text-slate-400 ml-1">(optional — used on ID card)</span>}
          </h3>
          <div className="flex items-center gap-4">
            <div className="w-20 h-24 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
              {photoSrc
                ? <img src={photoSrc} alt="Photo" className="w-full h-full object-cover" />
                : <span className="text-xs text-slate-400 text-center px-1 leading-tight">No photo</span>}
            </div>
            <div>
              <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${photoUploading ? 'opacity-50 pointer-events-none' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                {photoUploading ? 'Uploading…' : student.photoUrl ? 'Replace Photo' : 'Upload Photo'}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handlePhotoUpload(f); e.target.value = ''; }}
                />
              </label>
              <p className="text-xs text-slate-400 mt-2">
                {student.photoUrl ? 'Photo saved to student record.' : 'Upload a passport-size photo. It will be saved to the student profile.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Certificate options + customization */}
      {student && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-sm">Options</h3>
            <button
              onClick={() => setShowCustomize((v) => !v)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              {showCustomize ? 'Hide Customization ↑' : 'Customize Format ↓'}
            </button>
          </div>

          {/* Academic year + cert no — shown for bonafide/character */}
          {certType !== 'id_card' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Academic Year</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={yearId} onChange={(e) => setYearId(e.target.value)}>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Certificate No. <span className="text-slate-400">(optional)</span></label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. BON/2025/001" value={certNo} onChange={(e) => setCertNo(e.target.value)} />
              </div>
            </div>
          )}

          {/* Bonafide-specific */}
          {certType === 'bonafide' && (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Purpose</label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Bank account opening, passport application…"
                value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </div>
          )}

          {/* Character-specific */}
          {certType === 'character' && (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Conduct Grade</label>
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={character.conduct} onChange={(e) => setCharacter((p) => ({ ...p, conduct: e.target.value }))}>
                {['Excellent', 'Very Good', 'Good', 'Satisfactory'].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}

          {/* ID Card-specific */}
          {certType === 'id_card' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Valid Until Year</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  type="number" min={2024} max={2035} placeholder="e.g. 2026"
                  value={idCard.validYear} onChange={(e) => setIdCard((p) => ({ ...p, validYear: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Card Header Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={idCard.accentColor}
                    onChange={(e) => setIdCard((p) => ({ ...p, accentColor: e.target.value }))}
                    className="w-10 h-9 rounded border border-slate-300 cursor-pointer p-0.5" />
                  <div className="flex gap-1.5">
                    {['#0f172a', '#1e3a8a', '#064e3b', '#7c2d12', '#581c87', '#9f1239'].map((c) => (
                      <button key={c} onClick={() => setIdCard((p) => ({ ...p, accentColor: c }))}
                        className="w-6 h-6 rounded-full border-2 transition-all"
                        style={{ background: c, borderColor: idCard.accentColor === c ? '#6366f1' : 'transparent' }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Customization Panel ── */}
          {showCustomize && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Customize Fields &amp; Format</p>

              {certType === 'bonafide' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Toggle checked={bonafide.showDob} onChange={() => setBonafide((p) => ({ ...p, showDob: !p.showDob }))} label="Date of Birth" />
                    <Toggle checked={bonafide.showNationality} onChange={() => setBonafide((p) => ({ ...p, showNationality: !p.showNationality }))} label="Nationality" />
                    <Toggle checked={bonafide.showMother} onChange={() => setBonafide((p) => ({ ...p, showMother: !p.showMother }))} label="Mother's Name" />
                    <Toggle checked={bonafide.showBloodGroup} onChange={() => setBonafide((p) => ({ ...p, showBloodGroup: !p.showBloodGroup }))} label="Blood Group" />
                    <Toggle checked={bonafide.showReligion} onChange={() => setBonafide((p) => ({ ...p, showReligion: !p.showReligion }))} label="Religion" />
                    <Toggle checked={bonafide.showCaste} onChange={() => setBonafide((p) => ({ ...p, showCaste: !p.showCaste }))} label="Caste Category" />
                    <Toggle checked={bonafide.showAddress} onChange={() => setBonafide((p) => ({ ...p, showAddress: !p.showAddress }))} label="Address" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Additional Paragraph <span className="text-slate-400">(optional)</span></label>
                    <textarea
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      rows={2} placeholder="Any extra clause or remark to appear in the certificate…"
                      value={bonafide.customNote} onChange={(e) => setBonafide((p) => ({ ...p, customNote: e.target.value }))} />
                  </div>
                </div>
              )}

              {certType === 'character' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Toggle checked={character.showClass} onChange={() => setCharacter((p) => ({ ...p, showClass: !p.showClass }))} label="Class / Grade" />
                    <Toggle checked={character.showDob} onChange={() => setCharacter((p) => ({ ...p, showDob: !p.showDob }))} label="Date of Birth" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Custom Conduct Paragraph <span className="text-slate-400">(leave blank for default)</span></label>
                    <textarea
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      rows={3}
                      placeholder={`Default: "During the period of study, the student's character and conduct were found to be Good. The student was regular, disciplined…"`}
                      value={character.customConductText}
                      onChange={(e) => setCharacter((p) => ({ ...p, customConductText: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Additional Remarks <span className="text-slate-400">(optional)</span></label>
                    <textarea
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      rows={2} placeholder="Any additional remark…"
                      value={character.remarks} onChange={(e) => setCharacter((p) => ({ ...p, remarks: e.target.value }))} />
                  </div>
                </div>
              )}

              {certType === 'id_card' && (
                <div className="grid grid-cols-2 gap-3">
                  <Toggle checked={idCard.showDob} onChange={() => setIdCard((p) => ({ ...p, showDob: !p.showDob }))} label="Date of Birth" />
                  <Toggle checked={idCard.showFather} onChange={() => setIdCard((p) => ({ ...p, showFather: !p.showFather }))} label="Father's Name" />
                  <Toggle checked={idCard.showContact} onChange={() => setIdCard((p) => ({ ...p, showContact: !p.showContact }))} label="Contact Number" />
                  <Toggle checked={idCard.showBloodGroup} onChange={() => setIdCard((p) => ({ ...p, showBloodGroup: !p.showBloodGroup }))} label="Blood Group" />
                  <Toggle checked={idCard.showAddress} onChange={() => setIdCard((p) => ({ ...p, showAddress: !p.showAddress }))} label="Address" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={!student || !institution}
        className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Generate &amp; Print {CERT_TYPES.find((c) => c.id === certType)?.label}
      </button>

      <p className="text-xs text-center mt-3 text-slate-400">
        The document will open in a new browser tab with a print dialog. Ensure pop-ups are allowed for this site.
      </p>
    </div>
  );
}
