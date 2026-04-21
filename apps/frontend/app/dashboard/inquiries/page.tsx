'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface Inquiry {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  classInterest?: string;
  status: string;
  notes?: string;
  createdAt: string;
}

const STATUS_OPTIONS = ['new', 'contacted', 'visited', 'enrolled', 'dropped'];

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-ds-info-bg text-ds-info-text',
  contacted: 'bg-yellow-100 text-yellow-700',
  visited: 'bg-purple-100 text-purple-700',
  enrolled: 'bg-ds-success-bg text-ds-success-text',
  dropped: 'bg-ds-bg2 text-ds-text2',
};

const emptyForm = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  classInterest: '',
  notes: '',
};

export default function InquiriesPage() {
  const user = useAuthStore((s) => s.user);
  const [isReady, setIsReady] = useState(false);

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({ ...emptyForm });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { setIsReady(true); }, []);

  const fetchInquiries = async (status?: string) => {
    setLoading(true);
    try {
      const qs = status ? `?status=${status}` : '';
      const res = await apiFetch(`/inquiries${qs}`);
      setInquiries(Array.isArray(res) ? res : res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isReady || !user?.institutionId) return;
    fetchInquiries(filterStatus);
  }, [isReady, user?.institutionId, filterStatus]);

  const showSuccessMsg = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleCreate = async () => {
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim())
      return setError('First and last name are required');
    if (!form.phone.trim()) return setError('Phone is required');
    if (!/^[6-9]\d{9}$/.test(form.phone.trim())) return setError('Phone must be a valid 10-digit Indian mobile number (starts with 6-9)');

    setCreating(true);
    try {
      await apiFetch('/inquiries', {
        method: 'POST',
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          classInterest: form.classInterest.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      setForm({ ...emptyForm });
      setShowForm(false);
      await fetchInquiries(filterStatus);
      showSuccessMsg('Inquiry recorded');
    } catch (err: any) {
      setError(err.message || 'Failed to save inquiry');
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiFetch(`/inquiries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await fetchInquiries(filterStatus);
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this inquiry?')) return;
    try {
      await apiFetch(`/inquiries/${id}`, { method: 'DELETE' });
      await fetchInquiries(filterStatus);
      showSuccessMsg('Inquiry removed');
    } catch (err: any) {
      setError(err.message || 'Failed to remove inquiry');
    }
  };

  const inp = 'border border-ds-border-strong p-2 rounded w-full text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand';
  const lbl = 'text-xs font-medium text-ds-text2 block mb-1';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ds-text1">Inquiries</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-brand px-4 py-2 rounded-lg"
        >
          {showForm ? 'Cancel' : '+ New Inquiry'}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{success}</div>
      )}

      {/* New Inquiry Form */}
      {showForm && (
        <div className="bg-ds-surface shadow-sm rounded-xl p-6 mb-6 border border-ds-border">
          <h2 className="text-base font-medium mb-4">New Inquiry</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>First Name *</label>
              <input className={inp} value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Last Name *</label>
              <input className={inp} value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Phone *</label>
              <input className={inp} placeholder="10-digit mobile"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input className={inp} type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Interested in Class</label>
              <input className={inp} placeholder="e.g. Class 5"
                value={form.classInterest}
                onChange={(e) => setForm({ ...form, classInterest: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Notes</label>
              <input className={inp} placeholder="Optional remarks"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="col-span-3">
              <button onClick={handleCreate} disabled={creating}
                className="btn-brand px-6 py-2.5 rounded-lg">
                {creating ? 'Saving...' : 'Save Inquiry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['', ...STATUS_OPTIONS].map((s) => (
          <button key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filterStatus === s
                ? 'bg-ds-brand text-white border-ds-brand-dark'
                : 'bg-ds-surface text-ds-text2 border-ds-border-strong hover:border-gray-500'
            }`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-ds-surface shadow-sm rounded-xl border border-ds-border overflow-hidden">
        <div className="px-6 py-4 border-b border-ds-border flex items-center justify-between">
          <h2 className="font-medium text-ds-text1">Leads</h2>
          <span className="text-sm text-ds-text3">{inquiries.length} total</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-ds-text3 text-sm">Loading...</div>
        ) : inquiries.length === 0 ? (
          <div className="p-8 text-center text-ds-text3 text-sm">No inquiries yet.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-ds-bg2">
              <tr>
                <th className="px-6 py-3 text-xs font-medium text-ds-text2 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-xs font-medium text-ds-text2 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-xs font-medium text-ds-text2 uppercase tracking-wider">Class Interest</th>
                <th className="px-6 py-3 text-xs font-medium text-ds-text2 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-xs font-medium text-ds-text2 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-xs font-medium text-ds-text2 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ds-border">
              {inquiries.map((inq) => (
                <tr key={inq.id} className="hover:bg-ds-bg2 transition-colors">
                  <td className="px-6 py-4 font-medium text-ds-text1">
                    {inq.firstName} {inq.lastName}
                    {inq.notes && (
                      <div className="text-xs text-ds-text3 mt-0.5">{inq.notes}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-ds-text2 text-xs">{inq.phone}</td>
                  <td className="px-6 py-4 text-ds-text2 text-xs">{inq.classInterest || '—'}</td>
                  <td className="px-6 py-4">
                    <select
                      value={inq.status}
                      onChange={(e) => updateStatus(inq.id, e.target.value)}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:ring-1 focus:ring-ds-brand ${STATUS_COLORS[inq.status] ?? 'bg-ds-bg2 text-ds-text2'}`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-ds-text2 text-xs">
                    {new Date(inq.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleDelete(inq.id)}
                      className="text-red-500 hover:text-ds-error-text text-sm font-medium">
                      Remove
                    </button>
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
