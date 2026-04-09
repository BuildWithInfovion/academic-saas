'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface Inquiry {
  id: string; firstName: string; lastName: string; phone: string;
  email?: string; classInterest?: string; status: string; notes?: string; createdAt: string;
}

const STATUS_OPTIONS = ['new', 'contacted', 'visited', 'enrolled', 'dropped'];
const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  visited: 'bg-purple-100 text-purple-700',
  enrolled: 'bg-green-100 text-green-700',
  dropped: 'bg-gray-100 text-gray-500',
};

const emptyForm = { firstName: '', lastName: '', phone: '', email: '', classInterest: '', notes: '' };

export default function ReceptionistInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

  const load = () => {
    setLoading(true);
    apiFetch('/inquiries')
      .then(setInquiries)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!form.firstName || !form.phone) return setError('First name and phone are required');
    setSubmitting(true); setError(null);
    try {
      if (editId) {
        await apiFetch(`/inquiries/${editId}`, { method: 'PATCH', body: JSON.stringify(form) });
        showSuccess('Inquiry updated');
      } else {
        await apiFetch('/inquiries', { method: 'POST', body: JSON.stringify(form) });
        showSuccess('Inquiry logged');
      }
      setForm(emptyForm); setShowForm(false); setEditId(null);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiFetch(`/inquiries/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setInquiries((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    } catch (e: any) { setError(e.message); }
  };

  const openEdit = (inq: Inquiry) => {
    setForm({ firstName: inq.firstName, lastName: inq.lastName, phone: inq.phone,
      email: inq.email ?? '', classInterest: inq.classInterest ?? '', notes: inq.notes ?? '' });
    setEditId(inq.id);
    setShowForm(true);
  };

  const filtered = filterStatus === 'all' ? inquiries : inquiries.filter((i) => i.status === filterStatus);
  const inp = 'border border-gray-300 rounded-lg p-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-black';

  // Stats
  const stats = STATUS_OPTIONS.map((s) => ({ label: s, count: inquiries.filter((i) => i.status === s).length }));

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admission Inquiries</h1>
          <p className="text-sm text-gray-400 mt-0.5">Log and manage parent/student inquiries</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
          + New Inquiry
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 my-6">
        {stats.map((s) => (
          <div key={s.label}
            onClick={() => setFilterStatus(filterStatus === s.label ? 'all' : s.label)}
            className={`rounded-xl border p-4 text-center cursor-pointer transition-all
              ${filterStatus === s.label ? 'border-black bg-black text-white' : 'border-gray-100 bg-white shadow-sm hover:border-gray-300'}`}>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className={`text-xs mt-1 capitalize font-medium ${filterStatus === s.label ? 'text-gray-300' : 'text-gray-500'}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>}
      {success && <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-600 text-sm">{success}</div>}

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', ...STATUS_OPTIONS].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors
              ${filterStatus === s ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s === 'all' ? `All (${inquiries.length})` : s}
          </button>
        ))}
      </div>

      {/* Inquiry list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-gray-400">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">No inquiries yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Name</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Phone</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Class Interest</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Status</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Date</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((inq) => (
                <tr key={inq.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">
                    {inq.firstName} {inq.lastName}
                    {inq.notes && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[160px]">{inq.notes}</p>}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{inq.phone}</td>
                  <td className="px-5 py-3 text-gray-600">{inq.classInterest || '—'}</td>
                  <td className="px-5 py-3">
                    <select
                      value={inq.status}
                      onChange={(e) => updateStatus(inq.id, e.target.value)}
                      className={`text-xs font-medium px-2 py-1 rounded-lg border-0 focus:outline-none cursor-pointer ${STATUS_COLORS[inq.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {new Date(inq.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => openEdit(inq)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-800 mb-5">{editId ? 'Edit Inquiry' : 'Log New Inquiry'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">First Name *</label>
                <input className={inp} value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Last Name</label>
                <input className={inp} value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Phone *</label>
                <input className={inp} type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Email</label>
                <input className={inp} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 block mb-1">Class Interest</label>
                <input className={inp} placeholder="e.g. Class 5, Nursery" value={form.classInterest} onChange={(e) => setForm((f) => ({ ...f, classInterest: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
                <textarea className={inp + ' h-20 resize-none'} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowForm(false); setEditId(null); setError(null); }}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 bg-black text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {submitting ? 'Saving...' : editId ? 'Update' : 'Log Inquiry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
