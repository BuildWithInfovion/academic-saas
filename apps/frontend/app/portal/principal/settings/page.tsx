'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { TotpSetupCard } from '@/components/totp-setup-card';
import { validatePassword, checkPasswordStrength } from '@/lib/password-utils';

type Institution = {
  id: string; name: string; code: string; institutionType: string;
  address?: string; phone?: string; email?: string; website?: string; board?: string;
  logoUrl?: string; principalName?: string; tagline?: string; affiliationNo?: string;
  udiseCode?: string; gstin?: string; pan?: string; recognitionNo?: string;
  foundedYear?: number; mediumOfInstruction?: string; schoolType?: string; managementType?: string;
  stampUrl?: string; signatureUrl?: string;
  bankName?: string; bankAccountNo?: string; bankIfsc?: string; bankBranch?: string; bankAccountHolder?: string;
};
type AcademicYear = { id: string; name: string; startDate: string; endDate: string; isCurrent: boolean };
type AcademicUnit = { id: string; name: string; displayName?: string; level: number; parentId?: string };
type FeeHead = { id: string; name: string; isCustom: boolean };
type Subject = { id: string; name: string };

type Tab = 'profile' | 'years' | 'classes' | 'fees' | 'subjects' | 'security';

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile',  label: 'Institution Profile' },
  { id: 'years',    label: 'Academic Years' },
  { id: 'classes',  label: 'Class Structure' },
  { id: 'fees',     label: 'Fee Heads' },
  { id: 'subjects', label: 'Subject Master' },
  { id: 'security', label: 'Security' },
];

const inp = 'w-full p-2.5 border border-ds-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand bg-ds-surface';

function validateAcademicYearForm(form: { name: string; startDate: string; endDate: string }): string | null {
  const name = form.name.trim();
  if (!name || !form.startDate || !form.endDate) return 'Enter year value, start date, and end date';
  if (!/^\d{4}-\d{2}$/.test(name)) return 'Enter a valid year value like 2026-27';
  const startDate = new Date(`${form.startDate}T00:00:00`);
  const endDate   = new Date(`${form.endDate}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 'Enter valid start and end dates';
  if (startDate >= endDate) return 'End date must be after start date';
  const expected = `${startDate.getFullYear()}-${String(endDate.getFullYear()).slice(-2)}`;
  if (name !== expected) return `Year name must match the selected dates, for example ${expected}`;
  return null;
}

function compareAcademicUnits(a: AcademicUnit, b: AcademicUnit): number {
  const la = (a.displayName || a.name).toLowerCase();
  const lb = (b.displayName || b.name).toLowerCase();
  const order = ['lkg', 'ukg', 'kg', 'nursery'];
  const ai = order.findIndex((k) => la.includes(k));
  const bi = order.findIndex((k) => lb.includes(k));
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  return la.localeCompare(lb, undefined, { numeric: true, sensitivity: 'base' });
}

export default function PrincipalSettingsPage() {
  const [tab, setTab]       = useState<Tab>('years');
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3500); };
  const showError   = (msg: string) => { setError(msg);   setTimeout(() => setError(null), 5000); };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">School Settings</h1>
      <p className="text-sm text-ds-text3 mb-6">Manage academic structure, fee heads, subjects and institution profile</p>

      {error   && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}
      {success && <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{success}</div>}

      <div className="flex gap-1 bg-ds-bg2 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setError(null); setSuccess(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id ? 'bg-ds-surface text-ds-text1 shadow-sm' : 'text-ds-text2 hover:text-ds-text1'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile'  && <ProfileTab  showSuccess={showSuccess} showError={showError} />}
      {tab === 'years'    && <YearsTab    showSuccess={showSuccess} showError={showError} />}
      {tab === 'classes'  && <ClassesTab  showSuccess={showSuccess} showError={showError} />}
      {tab === 'fees'     && <FeeHeadsTab showSuccess={showSuccess} showError={showError} />}
      {tab === 'subjects' && <SubjectsTab showSuccess={showSuccess} showError={showError} />}
      {tab === 'security' && (
        <div className="max-w-xl space-y-6">
          <div>
            <h2 className="text-base font-semibold text-ds-text1 mb-1">Account Security</h2>
            <p className="text-sm text-ds-text3 mb-4">Manage two-factor authentication and your password</p>
          </div>
          <TotpSetupCard />
          <ChangePasswordSection />
        </div>
      )}
    </div>
  );
}

// ── Tab: Institution Profile ──────────────────────────────────────────────────
function ProfileTab({ showSuccess, showError }: { showSuccess: (m: string) => void; showError: (m: string) => void }) {
  const [inst, setInst] = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'stamp' | 'signat' | null>(null);

  const [form, setForm] = useState({
    name: '', institutionType: '', address: '', phone: '', email: '',
    website: '', board: '', logoUrl: '', principalName: '', tagline: '', affiliationNo: '',
    udiseCode: '', gstin: '', pan: '', recognitionNo: '',
    foundedYear: '', mediumOfInstruction: '', schoolType: '', managementType: '',
    stampUrl: '', signatureUrl: '',
    bankName: '', bankAccountNo: '', bankIfsc: '', bankBranch: '', bankAccountHolder: '',
  });

  const sf = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    apiFetch('/institution/me')
      .then((data) => {
        const d = data as Institution;
        setInst(d);
        setForm({
          name: d.name ?? '', institutionType: d.institutionType ?? '',
          address: d.address ?? '', phone: d.phone ?? '', email: d.email ?? '',
          website: d.website ?? '', board: d.board ?? '',
          logoUrl: d.logoUrl ?? '', principalName: d.principalName ?? '',
          tagline: d.tagline ?? '', affiliationNo: d.affiliationNo ?? '',
          udiseCode: d.udiseCode ?? '', gstin: d.gstin ?? '', pan: d.pan ?? '',
          recognitionNo: d.recognitionNo ?? '',
          foundedYear: d.foundedYear ? String(d.foundedYear) : '',
          mediumOfInstruction: d.mediumOfInstruction ?? '',
          schoolType: d.schoolType ?? '', managementType: d.managementType ?? '',
          stampUrl: d.stampUrl ?? '', signatureUrl: d.signatureUrl ?? '',
          bankName: d.bankName ?? '', bankAccountNo: d.bankAccountNo ?? '',
          bankIfsc: d.bankIfsc ?? '', bankBranch: d.bankBranch ?? '',
          bankAccountHolder: d.bankAccountHolder ?? '',
        });
      })
      .catch((e: any) => showError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleImageUpload = async (file: File, field: 'logoUrl' | 'stampUrl' | 'signatureUrl', asset: string, uploadKey: 'logo' | 'stamp' | 'signat') => {
    if (!file.type.startsWith('image/')) { showError('Please upload an image file (PNG, JPG, SVG)'); return; }
    if (file.size > 2 * 1024 * 1024) { showError('File must be under 2 MB'); return; }
    setUploading(uploadKey);
    try {
      const sig = await apiFetch(`/institution/me/branding-signature?asset=${asset}`) as any;
      const fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', sig.apiKey);
      fd.append('timestamp', String(sig.timestamp));
      fd.append('signature', sig.signature);
      fd.append('folder', sig.folder);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.secure_url) throw new Error(json.error?.message ?? 'Upload failed');
      await apiFetch('/institution/me', { method: 'PATCH', body: JSON.stringify({ [field]: json.secure_url }) });
      setForm((f) => ({ ...f, [field]: json.secure_url }));
      showSuccess('Image uploaded successfully');
    } catch (e: any) { showError(e.message || 'Upload failed'); }
    finally { setUploading(null); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        foundedYear: form.foundedYear ? parseInt(form.foundedYear) : undefined,
      };
      await apiFetch('/institution/me', { method: 'PATCH', body: JSON.stringify(payload) });
      showSuccess('School profile saved successfully');
    } catch (e: any) { showError(e.message); }
    finally { setSaving(false); }
  };

  const ImageUploader = ({ field, asset, uploadKey, label, hint }: {
    field: 'logoUrl' | 'stampUrl' | 'signatureUrl'; asset: string; uploadKey: 'logo' | 'stamp' | 'signat';
    label: string; hint: string;
  }) => (
    <div className="flex items-center gap-4">
      {form[field] ? (
        <img src={form[field]} alt={label} className="h-16 w-16 object-contain rounded border border-ds-border bg-white p-1" />
      ) : (
        <div className="h-16 w-16 rounded border-2 border-dashed border-ds-border flex items-center justify-center text-xs text-ds-text3 text-center leading-tight bg-ds-bg2">{label}</div>
      )}
      <div className="flex-1">
        <label className="cursor-pointer">
          <span className={`inline-block px-4 py-2 rounded-lg border border-ds-border text-sm font-medium text-ds-text1 hover:bg-ds-bg2 transition-colors ${uploading === uploadKey ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading === uploadKey ? 'Uploading…' : form[field] ? `Replace ${label}` : `Upload ${label}`}
          </span>
          <input type="file" accept="image/*" className="hidden" disabled={uploading !== null}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, field, asset, uploadKey); e.target.value = ''; }} />
        </label>
        <p className="text-xs text-ds-text3 mt-1.5">{hint}</p>
      </div>
      {form[field] && (
        <button onClick={async () => {
          await apiFetch('/institution/me', { method: 'PATCH', body: JSON.stringify({ [field]: '' }) });
          setForm((f) => ({ ...f, [field]: '' }));
          showSuccess(`${label} removed`);
        }} className="text-xs text-ds-error-text hover:underline shrink-0">Remove</button>
      )}
    </div>
  );

  if (loading) return <p className="text-sm text-ds-text3">Loading…</p>;

  return (
    <div className="space-y-6">
      {/* Live Document Preview */}
      <div className="bg-ds-bg2 border border-ds-border rounded-xl p-5">
        <p className="text-xs font-semibold text-ds-text2 uppercase tracking-wider mb-3">Preview — Letterhead on receipts &amp; documents</p>
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-4">
          {form.logoUrl ? (
            <img src={form.logoUrl} alt="Logo" className="h-14 w-14 object-contain rounded shrink-0" />
          ) : (
            <div className="h-14 w-14 rounded bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400 text-center leading-tight shrink-0">School<br/>Logo</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 text-base leading-tight">{form.name || 'School Name'}</p>
            {form.tagline && <p className="text-xs text-slate-500 italic mt-0.5">{form.tagline}</p>}
            <p className="text-xs text-slate-500 mt-1">
              {[form.board, form.affiliationNo ? `Affil: ${form.affiliationNo}` : '', form.udiseCode ? `UDISE: ${form.udiseCode}` : ''].filter(Boolean).join(' · ')}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {[form.address, form.phone ? `Ph: ${form.phone}` : '', form.email, form.website].filter(Boolean).join(' · ')}
            </p>
          </div>
          {form.stampUrl && (
            <img src={form.stampUrl} alt="Stamp" className="h-14 w-14 object-contain opacity-70 shrink-0" />
          )}
        </div>
        {(form.bankName || form.bankAccountNo) && (
          <div className="mt-2 bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">Bank:</span> {[form.bankName, form.bankAccountNo ? `A/C ${form.bankAccountNo}` : '', form.bankIfsc, form.bankBranch].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>

      {/* Logo & Branding Images */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6 space-y-5">
        <h3 className="text-sm font-semibold text-ds-text1">School Logo &amp; Official Stamp</h3>
        <div>
          <p className="text-xs font-medium text-ds-text2 mb-2">School Logo <span className="text-ds-text3 font-normal">— appears in letterhead on all documents</span></p>
          <ImageUploader field="logoUrl" asset="logo" uploadKey="logo" label="Logo" hint="PNG, JPG or SVG · Max 2 MB · Used on receipts, TC, certificates" />
        </div>
        <div className="border-t border-ds-border pt-5">
          <p className="text-xs font-medium text-ds-text2 mb-2">Official Stamp / Seal <span className="text-ds-text3 font-normal">— printed on TC, bonafide &amp; formal documents</span></p>
          <ImageUploader field="stampUrl" asset="stamp" uploadKey="stamp" label="Stamp" hint="Upload a transparent PNG of your school seal · Max 2 MB" />
        </div>
        <div className="border-t border-ds-border pt-5">
          <p className="text-xs font-medium text-ds-text2 mb-2">Principal Signature <span className="text-ds-text3 font-normal">— printed on formal documents and TC</span></p>
          <ImageUploader field="signatureUrl" asset="signat" uploadKey="signat" label="Signature" hint="Upload a transparent PNG of the principal's signature · Max 2 MB" />
        </div>
      </div>

      {/* Identity & Branding */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6">
        <h3 className="text-sm font-semibold text-ds-text1 mb-4">Identity &amp; Branding</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-medium text-ds-text2 block mb-1">School / Institution Name *</label>
            <input className={inp} value={form.name} onChange={sf('name')} placeholder="e.g. St. Mary's High School" />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Institution Type</label>
            <select className={inp} value={form.institutionType} onChange={sf('institutionType')}>
              <option value="school">School</option>
              <option value="college">College</option>
              <option value="coaching">Coaching Institute</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">School Type</label>
            <select className={inp} value={form.schoolType} onChange={sf('schoolType')}>
              <option value="">Select…</option>
              <option value="Co-ed">Co-educational</option>
              <option value="Boys">Boys Only</option>
              <option value="Girls">Girls Only</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Affiliation Board</label>
            <input className={inp} placeholder="e.g. CBSE, ICSE, SSC, State Board" value={form.board} onChange={sf('board')} />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Affiliation / Registration No</label>
            <input className={inp} placeholder="e.g. CBSE/AFF/1234567" value={form.affiliationNo} onChange={sf('affiliationNo')} />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Principal / Director Name</label>
            <input className={inp} placeholder="Name shown on TC and reports" value={form.principalName} onChange={sf('principalName')} />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Year of Establishment</label>
            <input className={inp} type="number" placeholder="e.g. 1995" value={form.foundedYear} onChange={sf('foundedYear')} />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Medium of Instruction</label>
            <select className={inp} value={form.mediumOfInstruction} onChange={sf('mediumOfInstruction')}>
              <option value="">Select…</option>
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="English & Hindi">English &amp; Hindi</option>
              <option value="Marathi">Marathi</option>
              <option value="Gujarati">Gujarati</option>
              <option value="Tamil">Tamil</option>
              <option value="Telugu">Telugu</option>
              <option value="Kannada">Kannada</option>
              <option value="Malayalam">Malayalam</option>
              <option value="Bengali">Bengali</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Management Type</label>
            <select className={inp} value={form.managementType} onChange={sf('managementType')}>
              <option value="">Select…</option>
              <option value="Private Unaided">Private Unaided</option>
              <option value="Private Aided">Private Aided</option>
              <option value="Government">Government</option>
              <option value="Government Aided">Government Aided</option>
              <option value="Central Government">Central Government</option>
              <option value="Trust">Trust / NGO</option>
              <option value="Minority">Minority Institution</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-ds-text2 block mb-1">Tagline / Motto</label>
            <input className={inp} placeholder="e.g. Nurturing Excellence Since 1990" value={form.tagline} onChange={sf('tagline')} />
          </div>
        </div>
      </div>

      {/* Contact Details */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6">
        <h3 className="text-sm font-semibold text-ds-text1 mb-4">Contact Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-medium text-ds-text2 block mb-1">Address</label>
            <input className={inp} placeholder="Full postal address" value={form.address} onChange={sf('address')} />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Phone</label>
            <input className={inp} placeholder="Contact number" value={form.phone} onChange={sf('phone')} />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Email</label>
            <input type="email" className={inp} placeholder="school@email.com" value={form.email} onChange={sf('email')} />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Website</label>
            <input className={inp} placeholder="https://yourschool.edu.in" value={form.website} onChange={sf('website')} />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Login Code</label>
            <input className={inp + ' bg-ds-bg2 text-ds-text3'} value={inst?.code ?? ''} readOnly />
            <p className="text-[10px] text-ds-text3 mt-1">Contact platform admin to change.</p>
          </div>
        </div>
      </div>

      {/* Legal & Compliance */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6">
        <h3 className="text-sm font-semibold text-ds-text1 mb-1">Legal &amp; Compliance</h3>
        <p className="text-xs text-ds-text3 mb-4">Required for official documents, government submissions, and audit records.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">UDISE+ Code</label>
            <input className={inp} placeholder="11-digit UDISE code" value={form.udiseCode} onChange={sf('udiseCode')} maxLength={11} />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">State Recognition No.</label>
            <input className={inp} placeholder="State / district recognition number" value={form.recognitionNo} onChange={sf('recognitionNo')} />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">GST Number (GSTIN)</label>
            <input className={inp} placeholder="15-digit GSTIN (if registered)" value={form.gstin} onChange={sf('gstin')} maxLength={15} />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">PAN Number</label>
            <input className={inp} placeholder="10-character PAN" value={form.pan} onChange={sf('pan')} maxLength={10} style={{ textTransform: 'uppercase' }} />
          </div>
        </div>
      </div>

      {/* Bank Details */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6">
        <h3 className="text-sm font-semibold text-ds-text1 mb-1">Bank Account Details</h3>
        <p className="text-xs text-ds-text3 mb-4">Printed at the bottom of fee receipts for online transfer payments.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Bank Name</label>
            <input className={inp} placeholder="e.g. State Bank of India" value={form.bankName} onChange={sf('bankName')} />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Account Holder Name</label>
            <input className={inp} placeholder="Name on the account" value={form.bankAccountHolder} onChange={sf('bankAccountHolder')} />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Account Number</label>
            <input className={inp} placeholder="Bank account number" value={form.bankAccountNo} onChange={sf('bankAccountNo')} />
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">IFSC Code</label>
            <input className={inp} placeholder="e.g. SBIN0001234" value={form.bankIfsc} onChange={sf('bankIfsc')} style={{ textTransform: 'uppercase' }} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-ds-text2 block mb-1">Branch</label>
            <input className={inp} placeholder="Branch name and city" value={form.bankBranch} onChange={sf('bankBranch')} />
          </div>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-brand px-8 py-2.5 rounded-lg">
        {saving ? 'Saving…' : 'Save All Changes'}
      </button>
    </div>
  );
}

// ── Tab: Academic Years ───────────────────────────────────────────────────────
function YearsTab({ showSuccess, showError }: { showSuccess: (m: string) => void; showError: (m: string) => void }) {
  const [years, setYears]       = useState<AcademicYear[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name: '', startDate: '', endDate: '' });
  const [submitting, setSubmitting] = useState(false);
  const [settingCurrent, setSettingCurrent] = useState<string | null>(null);

  const load = () => apiFetch('/academic/years')
    .then((d) => setYears(d as AcademicYear[]))
    .catch((e: any) => showError(e.message))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  // Auto-fill year name when dates change
  const updateYearName = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return;
    const s = new Date(`${startDate}T00:00:00`);
    const e = new Date(`${endDate}T00:00:00`);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && s < e) {
      setForm((f) => ({ ...f, name: `${s.getFullYear()}-${String(e.getFullYear()).slice(-2)}` }));
    }
  };

  const handleCreate = async () => {
    const err = validateAcademicYearForm(form);
    if (err) return showError(err);
    setSubmitting(true);
    try {
      await apiFetch('/academic/years', { method: 'POST', body: JSON.stringify({ ...form, name: form.name.trim() }) });
      showSuccess('Academic year created');
      setShowForm(false);
      setForm({ name: '', startDate: '', endDate: '' });
      await load();
    } catch (e: any) { showError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleSetCurrent = async (id: string) => {
    setSettingCurrent(id);
    try {
      await apiFetch(`/academic/years/${id}/set-current`, { method: 'PATCH' });
      showSuccess('Current year updated');
      await load();
    } catch (e: any) { showError(e.message); }
    finally { setSettingCurrent(null); }
  };

  const currentYear = years.find((y) => y.isCurrent);
  const now = new Date();
  const suggestedName = now.getMonth() >= 5
    ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(-2)}`
    : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(-2)}`;

  return (
    <div className="space-y-4">
      {!currentYear && (
        <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-4 text-sm text-ds-warning-text">
          No current academic year set. Create one below so the system knows the active session.
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-ds-text2">
          Suggested for this session: <strong>{suggestedName}</strong>
        </p>
        <button onClick={() => setShowForm(!showForm)}
          className="btn-brand px-4 py-2 rounded-lg">
          + New Academic Year
        </button>
      </div>

      {showForm && (
        <div className="bg-ds-surface rounded-xl border border-ds-border p-5 shadow-sm">
          <h3 className="font-semibold text-ds-text1 text-sm mb-4">Create Academic Year</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Start Date *</label>
              <input type="date" className={inp} value={form.startDate}
                onChange={(e) => { setForm((f) => ({ ...f, startDate: e.target.value })); updateYearName(e.target.value, form.endDate); }} />
            </div>
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">End Date *</label>
              <input type="date" className={inp} value={form.endDate}
                onChange={(e) => { setForm((f) => ({ ...f, endDate: e.target.value })); updateYearName(form.startDate, e.target.value); }} />
            </div>
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Name (auto-filled) *</label>
              <input className={inp} placeholder="e.g. 2026-27" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowForm(false)}
              className="border border-ds-border-strong text-ds-text1 px-4 py-2 rounded-lg text-sm hover:bg-ds-bg2">Cancel</button>
            <button onClick={handleCreate} disabled={submitting}
              className="btn-brand px-4 py-2 rounded-lg">
              {submitting ? 'Creating...' : 'Create Year'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
        {loading ? <p className="p-6 text-sm text-ds-text3">Loading...</p> : years.length === 0 ? (
          <p className="p-6 text-sm text-ds-text3">No academic years yet. Create one above.</p>
        ) : (
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[25%]" />
              <col className="w-[45%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead className="bg-ds-bg2">
              <tr>
                <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Name</th>
                <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Period</th>
                <th className="text-center px-5 py-3 text-ds-text2 font-medium text-xs">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ds-border">
              {years.map((y) => (
                <tr key={y.id} className="hover:bg-ds-bg2">
                  <td className="px-5 py-3 font-medium text-ds-text1">{y.name}</td>
                  <td className="px-5 py-3 text-ds-text2 text-xs">
                    {new Date(y.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} —{' '}
                    {new Date(y.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {y.isCurrent
                      ? <span className="px-2 py-0.5 bg-ds-success-bg text-ds-success-text rounded-full text-xs font-medium">Current</span>
                      : <span className="px-2 py-0.5 bg-ds-bg2 text-ds-text2 rounded-full text-xs">Inactive</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!y.isCurrent && (
                      <button onClick={() => handleSetCurrent(y.id)} disabled={settingCurrent === y.id}
                        className="text-xs text-ds-brand hover:text-blue-800 font-medium disabled:opacity-50">
                        {settingCurrent === y.id ? 'Setting...' : 'Set Current'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Tab: Class Structure ──────────────────────────────────────────────────────
function ClassesTab({ showSuccess, showError }: { showSuccess: (m: string) => void; showError: (m: string) => void }) {
  const [units, setUnits]       = useState<AcademicUnit[]>([]);
  const [years, setYears]       = useState<AcademicYear[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', displayName: '', level: '1', parentId: '', academicYearId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);

  const load = async () => {
    try {
      const [u, y] = await Promise.all([apiFetch('/academic/units'), apiFetch('/academic/years')]);
      setUnits(u as AcademicUnit[]);
      const ys = y as AcademicYear[];
      setYears(ys);
      if (!form.academicYearId) {
        const cur = ys.find((yr) => yr.isCurrent);
        if (cur) setForm((f) => ({ ...f, academicYearId: cur.id }));
      }
    } catch (e: any) { showError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return showError('Class name is required');
    setSubmitting(true);
    try {
      await apiFetch('/academic/units', {
        method: 'POST',
        body: JSON.stringify({ name: form.name.trim(), displayName: form.displayName.trim() || undefined, level: parseInt(form.level), parentId: form.parentId || undefined, academicYearId: form.academicYearId || undefined }),
      });
      showSuccess('Class created');
      setShowForm(false);
      setForm((f) => ({ ...f, name: '', displayName: '' }));
      await load();
    } catch (e: any) { showError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete class "${name}"?`)) return;
    setDeleting(id);
    try {
      await apiFetch(`/academic/units/${id}`, { method: 'DELETE' });
      showSuccess('Class deleted');
      await load();
    } catch (e: any) { showError(e.message); }
    finally { setDeleting(null); }
  };

  const rootUnits = [...units.filter((u) => !u.parentId)].sort(compareAcademicUnits);
  const childUnits = (parentId: string) => units.filter((u) => u.parentId === parentId).sort(compareAcademicUnits);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)}
          className="btn-brand px-4 py-2 rounded-lg">
          + Add Class / Section
        </button>
      </div>

      {showForm && (
        <div className="bg-ds-surface rounded-xl border border-ds-border p-5 shadow-sm">
          <h3 className="font-semibold text-ds-text1 text-sm mb-4">Create Class or Section</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Name *</label>
              <input className={inp} placeholder="e.g. Class 10" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Display Name (optional)</label>
              <input className={inp} placeholder="10th Standard" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Level</label>
              <select className={inp} value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}>
                <option value="1">1 — Class / Grade</option>
                <option value="2">2 — Section / Division</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Parent Class (for sections)</label>
              <select className={inp} value={form.parentId} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}>
                <option value="">None (top-level)</option>
                {rootUnits.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">Academic Year</label>
              <select className={inp} value={form.academicYearId} onChange={(e) => setForm((f) => ({ ...f, academicYearId: e.target.value }))}>
                <option value="">None</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' (Current)' : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="border border-ds-border-strong text-ds-text1 px-4 py-2 rounded-lg text-sm hover:bg-ds-bg2">Cancel</button>
            <button onClick={handleCreate} disabled={submitting} className="btn-brand px-4 py-2 rounded-lg">
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
        {loading ? <p className="p-6 text-sm text-ds-text3">Loading...</p> : units.length === 0 ? (
          <p className="p-6 text-sm text-ds-text3">No classes yet.</p>
        ) : (
          <div className="divide-y divide-ds-border">
            {rootUnits.map((unit) => (
              <div key={unit.id}>
                <div className="flex items-center justify-between px-5 py-3 hover:bg-ds-bg2">
                  <div>
                    <span className="font-medium text-ds-text1 text-sm">{unit.displayName || unit.name}</span>
                    <span className="ml-2 px-1.5 py-0.5 bg-ds-bg2 text-ds-text2 rounded text-[10px]">Level {unit.level}</span>
                  </div>
                  <button onClick={() => handleDelete(unit.id, unit.displayName || unit.name)} disabled={deleting === unit.id}
                    className="text-xs text-red-500 hover:text-ds-error-text font-medium disabled:opacity-50">
                    {deleting === unit.id ? '...' : 'Delete'}
                  </button>
                </div>
                {childUnits(unit.id).map((child) => (
                  <div key={child.id} className="flex items-center justify-between px-5 py-2.5 pl-10 bg-ds-bg2/50 border-t border-ds-border hover:bg-ds-bg2/50">
                    <div>
                      <span className="text-sm text-ds-text1">{child.displayName || child.name}</span>
                      <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-ds-info-text rounded text-[10px]">Section</span>
                    </div>
                    <button onClick={() => handleDelete(child.id, child.displayName || child.name)} disabled={deleting === child.id}
                      className="text-xs text-red-500 hover:text-ds-error-text font-medium disabled:opacity-50">
                      {deleting === child.id ? '...' : 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Fee Heads ────────────────────────────────────────────────────────────
function FeeHeadsTab({ showSuccess, showError }: { showSuccess: (m: string) => void; showError: (m: string) => void }) {
  const [heads, setHeads]   = useState<FeeHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => apiFetch('/fees/heads').then((d) => setHeads(d as FeeHead[])).catch((e: any) => showError(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return showError('Fee head name is required');
    setAdding(true);
    try {
      await apiFetch('/fees/heads', { method: 'POST', body: JSON.stringify({ name: newName.trim() }) });
      showSuccess('Fee head added');
      setNewName('');
      await load();
    } catch (e: any) { showError(e.message); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete fee head "${name}"?`)) return;
    setDeleting(id);
    try {
      await apiFetch(`/fees/heads/${id}`, { method: 'DELETE' });
      showSuccess('Fee head deleted');
      await load();
    } catch (e: any) { showError(e.message); }
    finally { setDeleting(null); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-ds-surface rounded-xl border border-ds-border p-4 shadow-sm flex gap-3">
        <input className={inp} placeholder="e.g. Hostel Fee, Bus Fee" value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
        <button onClick={handleAdd} disabled={adding}
          className="btn-brand px-4 py-2 rounded-lg shrink-0">
          {adding ? 'Adding...' : '+ Add'}
        </button>
      </div>
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
        {loading ? <p className="p-6 text-sm text-ds-text3">Loading...</p> : heads.length === 0 ? (
          <p className="p-6 text-sm text-ds-text3">No fee heads yet.</p>
        ) : (
          <div className="divide-y divide-ds-border">
            {heads.map((h) => (
              <div key={h.id} className="flex items-center justify-between px-5 py-3 hover:bg-ds-bg2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ds-text1">{h.name}</span>
                  {!h.isCustom && <span className="px-1.5 py-0.5 bg-ds-bg2 text-ds-text3 rounded text-[10px]">Default</span>}
                </div>
                <button onClick={() => handleDelete(h.id, h.name)} disabled={deleting === h.id}
                  className="text-xs text-red-500 hover:text-ds-error-text font-medium disabled:opacity-50">
                  {deleting === h.id ? '...' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Subject Master ───────────────────────────────────────────────────────
function SubjectsTab({ showSuccess, showError }: { showSuccess: (m: string) => void; showError: (m: string) => void }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading]   = useState(true);
  const [newName, setNewName]   = useState('');
  const [adding, setAdding]     = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => apiFetch('/subjects').then((d) => setSubjects(d as Subject[])).catch((e: any) => showError(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return showError('Subject name is required');
    setAdding(true);
    try {
      await apiFetch('/subjects', { method: 'POST', body: JSON.stringify({ name: newName.trim() }) });
      showSuccess('Subject added');
      setNewName('');
      await load();
    } catch (e: any) { showError(e.message); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete subject "${name}"?`)) return;
    setDeleting(id);
    try {
      await apiFetch(`/subjects/${id}`, { method: 'DELETE' });
      showSuccess('Subject deleted');
      await load();
    } catch (e: any) { showError(e.message); }
    finally { setDeleting(null); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-ds-surface rounded-xl border border-ds-border p-4 shadow-sm flex gap-3">
        <input className={inp} placeholder="e.g. Environmental Science, Economics" value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
        <button onClick={handleAdd} disabled={adding}
          className="btn-brand px-4 py-2 rounded-lg shrink-0">
          {adding ? 'Adding...' : '+ Add'}
        </button>
      </div>
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
        {loading ? <p className="p-6 text-sm text-ds-text3">Loading...</p> : subjects.length === 0 ? (
          <p className="p-6 text-sm text-ds-text3">No subjects yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-0 divide-y divide-ds-border">
            {subjects.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-ds-bg2">
                <span className="text-sm text-ds-text1">{s.name}</span>
                <button onClick={() => handleDelete(s.id, s.name)} disabled={deleting === s.id}
                  className="text-xs text-red-400 hover:text-ds-error-text font-medium disabled:opacity-50 ml-2">
                  {deleting === s.id ? '...' : '×'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Change Password ───────────────────────────────────────────────────────────
function ChangePasswordSection() {
  const [oldPassword, setOldPassword]         = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving]                   = useState(false);
  const [pwError, setPwError]                 = useState<string | null>(null);
  const [pwSuccess, setPwSuccess]             = useState<string | null>(null);

  const inp = 'w-full p-2.5 border border-ds-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand bg-ds-surface';

  const handle = async () => {
    setPwError(null);
    if (!oldPassword.trim()) return setPwError('Current password is required');
    if (!newPassword.trim()) return setPwError('New password is required');
    const pwErr = validatePassword(newPassword);
    if (pwErr) return setPwError(pwErr);
    if (newPassword !== confirmPassword) return setPwError('Passwords do not match');
    setSaving(true);
    try {
      await apiFetch('/users/me/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setPwSuccess('Password changed successfully');
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => setPwSuccess(null), 4000);
    } catch (e: any) {
      setPwError(e.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6">
      <h2 className="text-sm font-semibold text-ds-text1 mb-4">Change Password</h2>
      {pwError   && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{pwError}</div>}
      {pwSuccess && <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{pwSuccess}</div>}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-ds-text2 block mb-1">Current Password</label>
          <input type="password" className={inp} placeholder="Enter current password"
            value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-ds-text2 block mb-1">New Password</label>
          <input type="password" className={inp} placeholder="At least 8 characters"
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          {newPassword && (() => {
            const s = checkPasswordStrength(newPassword);
            return (
              <div className="mt-2 grid grid-cols-2 gap-1">
                {([['minLength', '8+ characters'], ['hasUppercase', 'Uppercase letter'], ['hasLowercase', 'Lowercase letter'], ['hasNumber', 'Number']] as const).map(([k, label]) => (
                  <span key={k} className={`text-xs flex items-center gap-1 ${s[k] ? 'text-ds-success-text' : 'text-ds-text3'}`}>
                    {s[k] ? '✓' : '○'} {label}
                  </span>
                ))}
              </div>
            );
          })()}
        </div>
        <div>
          <label className="text-xs font-medium text-ds-text2 block mb-1">Confirm New Password</label>
          <input type="password" className={inp} placeholder="Repeat new password"
            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
      </div>
      <button onClick={handle} disabled={saving}
        className="mt-5 px-5 py-2.5 btn-brand rounded-lg disabled:opacity-50 transition-colors">
        {saving ? 'Saving…' : 'Update Password'}
      </button>
    </div>
  );
}
