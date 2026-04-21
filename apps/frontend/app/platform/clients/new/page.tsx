'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { platformFetch } from '@/lib/platform-api';

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

const PLANS = ['basic', 'standard', 'premium'];
const TYPES = ['school', 'college'];
const YEARS = [1, 2, 3];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\d{10}$/;

export default function OnboardClientPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    institutionType: 'school',
    planCode: 'standard',
    codeOverride: '',
    maxStudents: '500',
    pricePerUser: '50',
    subscriptionYears: '1',
    subscriptionStartDate: new Date().toISOString().split('T')[0],
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

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setFieldErrors((fe) => { const n = { ...fe }; delete n[key]; return n; });
  };

  const totalAmount = (parseInt(form.maxStudents) || 0) * (parseFloat(form.pricePerUser) || 0);

  const normalizedCodePreview = form.codeOverride
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!form.name.trim()) errs.name = 'Institution name is required';
    if (!form.maxStudents || parseInt(form.maxStudents) < 1) errs.maxStudents = 'Must be at least 1';
    if (form.codeOverride.trim() && !normalizedCodePreview) errs.codeOverride = 'Must contain at least one letter or number';

    if (form.adminEmail.trim() && !EMAIL_RE.test(form.adminEmail.trim())) {
      errs.adminEmail = 'Enter a valid email address (e.g. admin@school.com)';
    }
    if (form.adminPhone.trim() && !PHONE_RE.test(form.adminPhone.trim())) {
      errs.adminPhone = 'Enter a valid 10-digit phone number';
    }
    if (!form.adminEmail.trim() && !form.adminPhone.trim()) {
      // Auto-generated email is fine — no error
    }

    if (form.directorEmail.trim() && !EMAIL_RE.test(form.directorEmail.trim())) {
      errs.directorEmail = 'Enter a valid email address (e.g. director@school.com)';
    }
    if (form.directorPhone.trim() && !PHONE_RE.test(form.directorPhone.trim())) {
      errs.directorPhone = 'Enter a valid 10-digit phone number';
    }

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
      const res = await platformFetch('/platform/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          institutionType: form.institutionType,
          planCode: form.planCode,
          codeOverride: normalizedCodePreview || undefined,
          maxStudents: parseInt(form.maxStudents),
          pricePerUser: parseFloat(form.pricePerUser),
          subscriptionYears: parseInt(form.subscriptionYears),
          subscriptionStartDate: form.subscriptionStartDate,
          adminName: form.adminName.trim() || undefined,
          adminEmail: form.adminEmail.trim() || undefined,
          adminPhone: form.adminPhone.trim() || undefined,
          directorName: form.directorName.trim() || undefined,
          directorEmail: form.directorEmail.trim() || undefined,
          directorPhone: form.directorPhone.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      setResult(res as OnboardResult);
    } catch (e: any) {
      setError(e.message || 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  };

  const inp = (field?: string) =>
    `w-full p-2.5 bg-gray-800 border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
      field && fieldErrors[field] ? 'border-red-500' : 'border-gray-700'
    }`;
  const sel = `w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none`;

  const FieldError = ({ field }: { field: string }) =>
    fieldErrors[field] ? <p className="mt-1 text-xs text-red-400">{fieldErrors[field]}</p> : null;

  if (result) {
    return (
      <div className="p-8 max-w-xl">
        <div className="bg-green-900/20 border border-green-700 rounded-xl p-6 space-y-5">
          <div>
            <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-1">Onboarding Complete</p>
            <h2 className="text-xl font-bold text-white">{result.institution.name}</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              School code: <span className="font-mono text-indigo-300">{result.institution.code}</span>
            </p>
          </div>

          {/* Operator credentials */}
          <div className="bg-gray-900 rounded-lg p-4 space-y-2.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Operator Login — share securely</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">School Code</span>
              <span className="font-mono text-indigo-300 font-bold">{result.operatorCredentials.institutionCode}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Email</span>
              <span className="text-white">{result.operatorCredentials.email}</span>
            </div>
            {result.operatorCredentials.phone && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Phone</span>
                <span className="text-white">{result.operatorCredentials.phone}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Password</span>
              <span className="font-mono font-bold text-green-300 text-base tracking-widest">
                {result.operatorCredentials.password}
              </span>
            </div>
          </div>

          {/* Director credentials */}
          {result.directorCredentials && (
            <div className="bg-gray-900 rounded-lg p-4 space-y-2.5">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">Director Login — share securely</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">School Code</span>
                <span className="font-mono text-indigo-300 font-bold">{result.directorCredentials.institutionCode}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Email</span>
                <span className="text-white">{result.directorCredentials.email}</span>
              </div>
              {result.directorCredentials.phone && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Phone</span>
                  <span className="text-white">{result.directorCredentials.phone}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Password</span>
                <span className="font-mono font-bold text-amber-300 text-base tracking-widest">
                  {result.directorCredentials.password}
                </span>
              </div>
            </div>
          )}

          <div className="bg-gray-900 rounded-lg p-4 space-y-2 text-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Subscription</p>
            <div className="flex justify-between">
              <span className="text-gray-400">Seats</span>
              <span className="text-white">{result.subscription.maxStudents} students</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Annual Amount</span>
              <span className="text-white font-bold">
                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(result.subscription.totalAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Valid Until</span>
              <span className="text-white">{new Date(result.subscription.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Passwords are shown only once. Both accounts must change their password after first login.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/platform/clients')}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              View All Clients
            </button>
            <button
              onClick={() => router.push(`/platform/clients/${result.institution.id}`)}
              className="flex-1 py-2.5 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-colors"
            >
              Manage Client
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Onboard New Client</h1>
        <p className="text-sm text-gray-400 mt-1">Creates institution, roles, operator login, and subscription in one step.</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm">{error}</div>
      )}

      {/* Institution Details */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Institution Details</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Institution Name <span className="text-red-400">*</span></label>
            <input className={inp('name')} placeholder="e.g. Vedant Vidya Mandir" value={form.name} onChange={set('name')} />
            <FieldError field="name" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Type</label>
            <select className={sel} value={form.institutionType} onChange={set('institutionType')}>
              {TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Plan</label>
            <select className={sel} value={form.planCode} onChange={set('planCode')}>
              {PLANS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Custom School Code <span className="text-gray-600">(optional — auto-generated from name if empty)</span></label>
            <input className={inp('codeOverride')} placeholder="e.g. vedantvidya, stmary" value={form.codeOverride} onChange={set('codeOverride')} autoCapitalize="none" />
            {form.codeOverride.trim() && (
              <p className="text-xs text-gray-500 mt-1">
                Normalized: <span className="font-mono text-indigo-300">{normalizedCodePreview || 'invalid'}</span>
              </p>
            )}
            <FieldError field="codeOverride" />
          </div>
        </div>
      </div>

      {/* Subscription */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Subscription</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Max Students <span className="text-red-400">*</span></label>
            <input type="number" className={inp('maxStudents')} placeholder="500" min={1} value={form.maxStudents} onChange={set('maxStudents')} />
            <FieldError field="maxStudents" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Price / Student (₹)</label>
            <input type="number" className={inp()} placeholder="50" min={0} value={form.pricePerUser} onChange={set('pricePerUser')} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Years</label>
            <select className={sel} value={form.subscriptionYears} onChange={set('subscriptionYears')}>
              {YEARS.map((y) => <option key={y} value={y}>{y} year{y > 1 ? 's' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Start Date</label>
            <input type="date" className={inp()} value={form.subscriptionStartDate} onChange={set('subscriptionStartDate')} />
          </div>
          <div className="col-span-2 flex items-end">
            <div className="bg-indigo-900/30 border border-indigo-800 rounded-lg px-4 py-2.5 w-full">
              <p className="text-xs text-gray-400">Annual Amount</p>
              <p className="text-lg font-bold text-indigo-300">₹{totalAmount.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Notes <span className="text-gray-600">(optional)</span></label>
          <textarea className={`w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none`} rows={2} placeholder="Payment terms, special agreements..." value={form.notes} onChange={set('notes')} />
        </div>
      </div>

      {/* Operator Account */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-300">Operator Account</h2>
          <p className="text-xs text-gray-500 mt-0.5">If email/phone left empty, email is auto-generated as admin@{'{code}'}.in</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Operator Name <span className="text-gray-600">(optional)</span></label>
            <input className={inp()} type="text" placeholder="e.g. Rajesh Kumar" value={form.adminName} onChange={set('adminName')} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Operator Email <span className="text-gray-600">(optional)</span></label>
            <input className={inp('adminEmail')} type="email" placeholder="admin@school.com" value={form.adminEmail} onChange={set('adminEmail')} />
            <FieldError field="adminEmail" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Operator Phone <span className="text-gray-600">(optional)</span></label>
            <input className={inp('adminPhone')} type="tel" placeholder="9876543210" value={form.adminPhone} onChange={set('adminPhone')} maxLength={10} />
            <FieldError field="adminPhone" />
          </div>
        </div>
      </div>

      {/* Director Account */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-300">
            Director Account <span className="text-gray-600 font-normal">(optional)</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Creates a second login with the Director (super_admin) role. Leave blank to skip.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Director Name <span className="text-gray-600">(optional)</span></label>
            <input className={inp()} type="text" placeholder="e.g. Priya Sharma" value={form.directorName} onChange={set('directorName')} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Director Email <span className="text-gray-600">(optional)</span></label>
            <input className={inp('directorEmail')} type="email" placeholder="director@school.com" value={form.directorEmail} onChange={set('directorEmail')} />
            <FieldError field="directorEmail" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Director Phone <span className="text-gray-600">(optional)</span></label>
            <input className={inp('directorPhone')} type="tel" placeholder="9876543210" value={form.directorPhone} onChange={set('directorPhone')} maxLength={10} />
            <FieldError field="directorPhone" />
          </div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Creating institution…' : 'Create Institution + Generate Credentials'}
      </button>
    </div>
  );
}
