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
  subscription: { totalAmount: number; endDate: string; maxStudents: number };
}

const PLANS = ['basic', 'standard', 'premium'];
const TYPES = ['school', 'college'];
const YEARS = [1, 2, 3];

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
    adminEmail: '',
    adminPhone: '',
    adminName: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardResult | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const totalAmount =
    (parseInt(form.maxStudents) || 0) * (parseFloat(form.pricePerUser) || 0);
  const annualAmount = totalAmount;
  const normalizedCodePreview = form.codeOverride
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  const handleSubmit = async () => {
    if (!form.name.trim()) return setError('Institution name is required');
    if (!form.maxStudents || parseInt(form.maxStudents) < 1) return setError('Max students must be at least 1');
    if (form.codeOverride.trim() && !normalizedCodePreview) {
      return setError('Custom school code must contain at least one letter or number');
    }

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
          adminEmail: form.adminEmail.trim() || undefined,
          adminPhone: form.adminPhone.trim() || undefined,
          adminName: form.adminName.trim() || undefined,
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

  const inp = 'w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const sel = `${inp} appearance-none`;

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

          <div className="bg-gray-900 rounded-lg p-4 space-y-2.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Operator Login Credentials — share these securely
            </p>
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
            The password above is shown only once. The operator must change it after first login.
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

      {/* Institution */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Institution Details</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Institution Name *</label>
            <input className={inp} placeholder="e.g. Vedant Vidya Mandir" value={form.name} onChange={set('name')} />
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
            <label className="text-xs text-gray-400 block mb-1">Custom School Code (optional — auto-generated from name if empty)</label>
            <input className={inp} placeholder="e.g. vedantvidya, stmary" value={form.codeOverride} onChange={set('codeOverride')} autoCapitalize="none" />
            {form.codeOverride.trim() && (
              <p className="text-xs text-gray-500 mt-1">
                Normalized code: <span className="font-mono text-indigo-300">{normalizedCodePreview || 'invalid'}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Subscription */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Subscription</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Max Students *</label>
            <input type="number" className={inp} placeholder="500" min={1} value={form.maxStudents} onChange={set('maxStudents')} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Price / Student (₹)</label>
            <input type="number" className={inp} placeholder="50" min={1} value={form.pricePerUser} onChange={set('pricePerUser')} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Years</label>
            <select className={sel} value={form.subscriptionYears} onChange={set('subscriptionYears')}>
              {YEARS.map((y) => <option key={y} value={y}>{y} year{y > 1 ? 's' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Start Date</label>
            <input type="date" className={inp} value={form.subscriptionStartDate} onChange={set('subscriptionStartDate')} />
          </div>
          <div className="col-span-2 flex items-end">
            <div className="bg-indigo-900/30 border border-indigo-800 rounded-lg px-4 py-2.5 w-full">
              <p className="text-xs text-gray-400">Annual Amount</p>
              <p className="text-lg font-bold text-indigo-300">
                ₹{annualAmount.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Notes (optional)</label>
          <textarea className={`${inp} resize-none`} rows={2} placeholder="Payment terms, special agreements..." value={form.notes} onChange={set('notes')} />
        </div>
      </div>

      {/* Operator */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-300">Operator Account</h2>
          <p className="text-xs text-gray-500 mt-0.5">If email/phone left empty, email is auto-generated as admin@{'{code}'}.in</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Operator Email</label>
            <input className={inp} type="email" placeholder="admin@school.com (optional)" value={form.adminEmail} onChange={set('adminEmail')} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Operator Phone</label>
            <input className={inp} type="tel" placeholder="9876543210 (optional)" value={form.adminPhone} onChange={set('adminPhone')} />
          </div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Creating...' : 'Create Institution + Generate Credentials'}
      </button>
    </div>
  );
}
