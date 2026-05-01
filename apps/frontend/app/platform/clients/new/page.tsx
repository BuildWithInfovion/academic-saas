'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { platformFetch } from '@/lib/platform-api';

// ── Constants ────────────────────────────────────────────────────────────────

const INST_TYPES = [
  { value: 'school',     label: 'K-12 School' },
  { value: 'pre_school', label: 'Pre-school / Nursery' },
  { value: 'college',    label: 'Junior / Degree College' },
  { value: 'coaching',   label: 'Coaching Institute' },
  { value: 'university', label: 'University' },
];

const BOARDS = [
  'CBSE',
  'ICSE / ISC',
  'IB',
  'Cambridge IGCSE',
  'State Board',
  'NIOS',
  'Others',
];

const MANAGEMENT_TYPES = [
  'Private Unaided',
  'Private Aided',
  'Government',
  'Central Government',
  'Trust / NGO',
];

const GENDER_TYPES = ['Co-education', 'Boys Only', 'Girls Only'];

const MEDIUMS = [
  'English', 'Hindi', 'Marathi', 'Gujarati', 'Telugu',
  'Tamil', 'Kannada', 'Malayalam', 'Bengali', 'Bilingual', 'Multilingual', 'Other',
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi (NCT)', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
  'Andaman & Nicobar', 'Dadra & Nagar Haveli', 'Daman & Diu', 'Lakshadweep',
];

const PLANS = ['basic', 'standard', 'premium'];
const YEARS = [1, 2, 3];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\d{10}$/;

// ── Types ────────────────────────────────────────────────────────────────────

interface Credentials {
  email: string;
  phone: string | null;
  password: string;
  institutionCode: string;
}

interface OnboardResult {
  institution: { id: string; name: string; code: string };
  operatorCredentials: Credentials;
  directorCredentials: Credentials | null;
  subscription: { totalAmount: number; endDate: string; maxStudents: number };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function OnboardClientPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    // Identity
    name: '',
    institutionType: 'school',
    planCode: 'standard',
    codeOverride: '',
    // Education profile
    board: '',
    affiliationNo: '',
    mediumOfInstruction: '',
    schoolGenderType: '',
    managementType: '',
    foundedYear: '',
    // Contact
    institutionPhone: '',
    institutionEmail: '',
    website: '',
    // Location
    city: '',
    state: '',
    institutionAddress: '',
    // Subscription
    maxStudents: '500',
    pricePerUser: '50',
    subscriptionYears: '1',
    subscriptionStartDate: new Date().toISOString().split('T')[0],
    // Accounts
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    directorName: '',
    directorEmail: '',
    directorPhone: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<OnboardResult | null>(null);

  const isSchoolType = ['school', 'pre_school'].includes(form.institutionType);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setFieldErrors((fe) => { const n = { ...fe }; delete n[key]; return n; });
    };

  const totalAmount =
    (parseInt(form.maxStudents) || 0) * (parseFloat(form.pricePerUser) || 0);

  const normalizedCode = form.codeOverride
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!form.name.trim()) errs.name = 'Institution name is required';
    if (!form.maxStudents || parseInt(form.maxStudents) < 1)
      errs.maxStudents = 'Must be at least 1';
    if (form.codeOverride.trim() && !normalizedCode)
      errs.codeOverride = 'Must contain at least one letter or number';
    if (form.institutionPhone.trim() && !PHONE_RE.test(form.institutionPhone.trim()))
      errs.institutionPhone = 'Enter a valid 10-digit phone number';
    if (form.institutionEmail.trim() && !EMAIL_RE.test(form.institutionEmail.trim()))
      errs.institutionEmail = 'Enter a valid email address';
    if (form.adminEmail.trim() && !EMAIL_RE.test(form.adminEmail.trim()))
      errs.adminEmail = 'Enter a valid email address';
    if (form.adminPhone.trim() && !PHONE_RE.test(form.adminPhone.trim()))
      errs.adminPhone = 'Enter a valid 10-digit phone number';
    if (form.directorEmail.trim() && !EMAIL_RE.test(form.directorEmail.trim()))
      errs.directorEmail = 'Enter a valid email address';
    if (form.directorPhone.trim() && !PHONE_RE.test(form.directorPhone.trim()))
      errs.directorPhone = 'Enter a valid 10-digit phone number';
    if (form.foundedYear && (parseInt(form.foundedYear) < 1800 || parseInt(form.foundedYear) > new Date().getFullYear()))
      errs.foundedYear = `Enter a year between 1800 and ${new Date().getFullYear()}`;

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError('Please fix the highlighted fields before submitting.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        institutionType: form.institutionType,
        planCode: form.planCode,
        maxStudents: parseInt(form.maxStudents),
        pricePerUser: parseFloat(form.pricePerUser),
        subscriptionYears: parseInt(form.subscriptionYears),
        subscriptionStartDate: form.subscriptionStartDate,
      };

      if (normalizedCode) payload.codeOverride = normalizedCode;
      if (form.board) payload.board = form.board;
      if (form.affiliationNo.trim()) payload.affiliationNo = form.affiliationNo.trim();
      if (form.mediumOfInstruction) payload.mediumOfInstruction = form.mediumOfInstruction;
      if (form.schoolGenderType) payload.schoolGenderType = form.schoolGenderType;
      if (form.managementType) payload.managementType = form.managementType;
      if (form.foundedYear) payload.foundedYear = parseInt(form.foundedYear);
      if (form.institutionPhone.trim()) payload.institutionPhone = form.institutionPhone.trim();
      if (form.institutionEmail.trim()) payload.institutionEmail = form.institutionEmail.trim();
      if (form.website.trim()) payload.website = form.website.trim();
      if (form.city.trim()) payload.city = form.city.trim();
      if (form.state) payload.state = form.state;
      if (form.institutionAddress.trim()) payload.institutionAddress = form.institutionAddress.trim();
      if (form.adminName.trim()) payload.adminName = form.adminName.trim();
      if (form.adminEmail.trim()) payload.adminEmail = form.adminEmail.trim();
      if (form.adminPhone.trim()) payload.adminPhone = form.adminPhone.trim();
      if (form.directorName.trim()) payload.directorName = form.directorName.trim();
      if (form.directorEmail.trim()) payload.directorEmail = form.directorEmail.trim();
      if (form.directorPhone.trim()) payload.directorPhone = form.directorPhone.trim();
      if (form.notes.trim()) payload.notes = form.notes.trim();

      const res = await platformFetch('/platform/clients', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setResult(res as OnboardResult);
    } catch (e: unknown) {
      setError((e as Error).message || 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Styles ─────────────────────────────────────────────────────────────────

  const inp = (field?: string) =>
    `w-full px-3 py-2.5 bg-gray-800/60 border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
      field && fieldErrors[field] ? 'border-red-500' : 'border-gray-700 hover:border-gray-600'
    }`;
  const sel = `w-full px-3 py-2.5 bg-gray-800/60 border border-gray-700 hover:border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none transition-colors`;

  const FieldErr = ({ field }: { field: string }) =>
    fieldErrors[field] ? (
      <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
        <span>⚠</span> {fieldErrors[field]}
      </p>
    ) : null;

  const Section = ({
    title,
    subtitle,
    badge,
    children,
  }: {
    title: string;
    subtitle?: string;
    badge?: string;
    children: React.ReactNode;
  }) => (
    <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {badge && (
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full border border-gray-700">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );

  // ── Success screen ─────────────────────────────────────────────────────────

  if (result) {
    const credCard = (
      label: string,
      creds: Credentials,
      color: 'indigo' | 'amber',
    ) => (
      <div className={`rounded-xl p-4 space-y-3 border ${
        color === 'indigo'
          ? 'bg-indigo-950/40 border-indigo-800/60'
          : 'bg-amber-950/40 border-amber-800/60'
      }`}>
        <p className={`text-xs font-bold uppercase tracking-wider ${
          color === 'indigo' ? 'text-indigo-400' : 'text-amber-400'
        }`}>
          {label}
        </p>
        {[
          { k: 'School Code', v: creds.institutionCode, mono: true, highlight: true },
          { k: 'Email', v: creds.email, mono: false, highlight: false },
          ...(creds.phone ? [{ k: 'Phone', v: creds.phone, mono: false, highlight: false }] : []),
          { k: 'Password', v: creds.password, mono: true, highlight: true },
        ].map(({ k, v, mono, highlight }) => (
          <div key={k} className="flex items-center justify-between gap-4">
            <span className="text-xs text-gray-400 shrink-0">{k}</span>
            <span
              className={`text-sm font-medium truncate ${
                mono ? 'font-mono' : ''
              } ${
                highlight
                  ? color === 'indigo' ? 'text-indigo-300' : 'text-amber-300'
                  : 'text-white'
              }`}
            >
              {v}
            </span>
          </div>
        ))}
      </div>
    );

    return (
      <div className="p-8 max-w-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-900/40 border border-green-700 flex items-center justify-center text-green-400 text-lg">
            ✓
          </div>
          <div>
            <p className="text-xs text-green-400 font-semibold uppercase tracking-wider">Onboarding Complete</p>
            <h2 className="text-xl font-bold text-white">{result.institution.name}</h2>
            <p className="text-sm text-gray-400">
              School code:{' '}
              <span className="font-mono text-indigo-300 font-semibold">
                {result.institution.code}
              </span>
            </p>
          </div>
        </div>

        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg px-4 py-3 text-xs text-yellow-300">
          Credentials shown only once — copy and share securely. Both accounts must change password after first login.
        </div>

        {credCard('Operator (Admin) Login', result.operatorCredentials, 'indigo')}
        {result.directorCredentials &&
          credCard('Director Login', result.directorCredentials, 'amber')}

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2 text-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Subscription</p>
          {[
            { k: 'Seats', v: `${result.subscription.maxStudents} students` },
            {
              k: 'Annual Amount',
              v: new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0,
              }).format(result.subscription.totalAmount),
            },
            {
              k: 'Valid Until',
              v: new Date(result.subscription.endDate).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'long', year: 'numeric',
              }),
            },
          ].map(({ k, v }) => (
            <div key={k} className="flex justify-between">
              <span className="text-gray-400">{k}</span>
              <span className="text-white font-medium">{v}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={() => router.push('/platform/clients')}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            View All Clients
          </button>
          <button
            onClick={() => router.push(`/platform/clients/${result.institution.id}`)}
            className="flex-1 py-2.5 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-colors"
          >
            Manage This Client
          </button>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="text-xs text-gray-500 hover:text-gray-300 mb-3 flex items-center gap-1 transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-white">Onboard New Client</h1>
        <p className="text-sm text-gray-400 mt-1">
          Creates institution, roles, operator login, and subscription in one step.
        </p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── 1. Identity ───────────────────────────────────────────────────── */}
      <Section title="Institution Identity" subtitle="Core identification details">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">
              Institution Name <span className="text-red-400">*</span>
            </label>
            <input
              className={inp('name')}
              placeholder="e.g. Vedant Vidya Mandir, St. Xavier's School"
              value={form.name}
              onChange={set('name')}
            />
            <FieldErr field="name" />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Institution Type</label>
            <select className={sel} value={form.institutionType} onChange={set('institutionType')}>
              {INST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Subscription Plan</label>
            <select className={sel} value={form.planCode} onChange={set('planCode')}>
              {PLANS.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">
              Custom School Code{' '}
              <span className="text-gray-600">(optional — auto-generated from name if empty)</span>
            </label>
            <input
              className={inp('codeOverride')}
              placeholder="e.g. vedantvidya, stmary2026"
              value={form.codeOverride}
              onChange={set('codeOverride')}
              autoCapitalize="none"
            />
            {form.codeOverride.trim() && (
              <p className="text-xs text-gray-500 mt-1">
                Normalized:{' '}
                <span className="font-mono text-indigo-300">
                  {normalizedCode || '— invalid'}
                </span>
              </p>
            )}
            <FieldErr field="codeOverride" />
          </div>
        </div>
      </Section>

      {/* ── 2. School Profile (education-specific) ────────────────────────── */}
      {isSchoolType && (
        <Section
          title="Academic Profile"
          subtitle="Board affiliation, medium, and school classification"
          badge="School"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Board / Curriculum</label>
              <select className={sel} value={form.board} onChange={set('board')}>
                <option value="">— Select board —</option>
                {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Affiliation / School No.{' '}
                <span className="text-gray-600">(optional)</span>
              </label>
              <input
                className={inp('affiliationNo')}
                placeholder="e.g. 1100234"
                value={form.affiliationNo}
                onChange={set('affiliationNo')}
              />
              <FieldErr field="affiliationNo" />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Medium of Instruction</label>
              <select className={sel} value={form.mediumOfInstruction} onChange={set('mediumOfInstruction')}>
                <option value="">— Select medium —</option>
                {MEDIUMS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">School Type</label>
              <select className={sel} value={form.schoolGenderType} onChange={set('schoolGenderType')}>
                <option value="">— Select type —</option>
                {GENDER_TYPES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Management</label>
              <select className={sel} value={form.managementType} onChange={set('managementType')}>
                <option value="">— Select management —</option>
                {MANAGEMENT_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Year Established <span className="text-gray-600">(optional)</span>
              </label>
              <input
                type="number"
                className={inp('foundedYear')}
                placeholder={`e.g. 1998`}
                min={1800}
                max={new Date().getFullYear()}
                value={form.foundedYear}
                onChange={set('foundedYear')}
              />
              <FieldErr field="foundedYear" />
            </div>
          </div>
        </Section>
      )}

      {/* ── 3. Contact Information ────────────────────────────────────────── */}
      <Section title="Contact Information" subtitle="Institution's public contact details">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Phone <span className="text-gray-600">(optional)</span>
            </label>
            <input
              className={inp('institutionPhone')}
              type="tel"
              placeholder="9876543210"
              maxLength={10}
              value={form.institutionPhone}
              onChange={set('institutionPhone')}
            />
            <FieldErr field="institutionPhone" />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Email <span className="text-gray-600">(optional)</span>
            </label>
            <input
              className={inp('institutionEmail')}
              type="email"
              placeholder="info@school.edu.in"
              value={form.institutionEmail}
              onChange={set('institutionEmail')}
            />
            <FieldErr field="institutionEmail" />
          </div>

          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">
              Website <span className="text-gray-600">(optional)</span>
            </label>
            <input
              className={inp()}
              type="url"
              placeholder="https://www.schoolname.edu.in"
              value={form.website}
              onChange={set('website')}
            />
          </div>
        </div>
      </Section>

      {/* ── 4. Location ───────────────────────────────────────────────────── */}
      <Section title="Location" subtitle="City, state and address for official documents">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">City</label>
            <input
              className={inp()}
              placeholder="e.g. Pune, Nagpur, Mumbai"
              value={form.city}
              onChange={set('city')}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">State</label>
            <select className={sel} value={form.state} onChange={set('state')}>
              <option value="">— Select state —</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">
              Street Address <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              className="w-full px-3 py-2.5 bg-gray-800/60 border border-gray-700 hover:border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-colors"
              rows={2}
              placeholder="Building, street, area..."
              value={form.institutionAddress}
              onChange={set('institutionAddress')}
            />
          </div>
        </div>
      </Section>

      {/* ── 5. Subscription ───────────────────────────────────────────────── */}
      <Section title="Subscription" subtitle="Seat count, pricing, and billing period">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Max Students <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              className={inp('maxStudents')}
              placeholder="500"
              min={1}
              value={form.maxStudents}
              onChange={set('maxStudents')}
            />
            <FieldErr field="maxStudents" />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Price / Student (₹)</label>
            <input
              type="number"
              className={inp()}
              placeholder="50"
              min={0}
              value={form.pricePerUser}
              onChange={set('pricePerUser')}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Duration</label>
            <select className={sel} value={form.subscriptionYears} onChange={set('subscriptionYears')}>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y} Year{y > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Start Date</label>
            <input
              type="date"
              className={inp()}
              value={form.subscriptionStartDate}
              onChange={set('subscriptionStartDate')}
            />
          </div>

          <div className="col-span-2 flex items-end">
            <div className="bg-indigo-950/50 border border-indigo-800/60 rounded-lg px-4 py-3 w-full">
              <p className="text-xs text-indigo-400">Annual Contract Value</p>
              <p className="text-xl font-bold text-indigo-300">
                ₹{totalAmount.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">
            Notes <span className="text-gray-600">(optional)</span>
          </label>
          <textarea
            className="w-full px-3 py-2.5 bg-gray-800/60 border border-gray-700 hover:border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-colors"
            rows={2}
            placeholder="Payment terms, special agreements, referral source..."
            value={form.notes}
            onChange={set('notes')}
          />
        </div>
      </Section>

      {/* ── 6. Operator Account ───────────────────────────────────────────── */}
      <Section
        title="Operator Account"
        subtitle={`If email/phone left empty, email auto-generates as admin@{code}.in`}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">
              Name <span className="text-gray-600">(optional)</span>
            </label>
            <input
              className={inp()}
              type="text"
              placeholder="e.g. Rajesh Kumar"
              value={form.adminName}
              onChange={set('adminName')}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Email <span className="text-gray-600">(optional)</span>
            </label>
            <input
              className={inp('adminEmail')}
              type="email"
              placeholder="admin@school.com"
              value={form.adminEmail}
              onChange={set('adminEmail')}
            />
            <FieldErr field="adminEmail" />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Phone <span className="text-gray-600">(optional)</span>
            </label>
            <input
              className={inp('adminPhone')}
              type="tel"
              placeholder="9876543210"
              value={form.adminPhone}
              onChange={set('adminPhone')}
              maxLength={10}
            />
            <FieldErr field="adminPhone" />
          </div>
        </div>
      </Section>

      {/* ── 7. Director Account ───────────────────────────────────────────── */}
      <Section
        title="Director Account"
        subtitle="Creates a second login with read-only Director role. Leave blank to skip."
        badge="Optional"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Name</label>
            <input
              className={inp()}
              type="text"
              placeholder="e.g. Priya Sharma"
              value={form.directorName}
              onChange={set('directorName')}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Email</label>
            <input
              className={inp('directorEmail')}
              type="email"
              placeholder="director@school.com"
              value={form.directorEmail}
              onChange={set('directorEmail')}
            />
            <FieldErr field="directorEmail" />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Phone</label>
            <input
              className={inp('directorPhone')}
              type="tel"
              placeholder="9876543210"
              value={form.directorPhone}
              onChange={set('directorPhone')}
              maxLength={10}
            />
            <FieldErr field="directorPhone" />
          </div>
        </div>
      </Section>

      {/* ── Submit ────────────────────────────────────────────────────────── */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-900/30"
      >
        {loading ? 'Creating institution…' : 'Create Institution & Generate Credentials →'}
      </button>
    </div>
  );
}
