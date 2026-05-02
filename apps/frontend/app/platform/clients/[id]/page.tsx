'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { platformFetch } from '@/lib/platform-api';

interface Client {
  id: string;
  name: string;
  code: string;
  institutionType: string;
  planCode: string;
  status: string;
  createdAt: string;
  subscription?: {
    id: string;
    planName: string;
    maxStudents: number;
    pricePerUser: number;
    billingCycleYears: number;
    totalAmount: number;
    startDate: string;
    endDate: string;
    status: string;
    amountPaid?: number;
    paidAt?: string;
    notes?: string;
  };
  _count: { students: number; users: number };
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysLeft(endDate: string) {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Subscription edit state
  const [editSub, setEditSub] = useState(false);
  const [subForm, setSubForm] = useState({
    maxStudents: '',
    pricePerUser: '',
    billingCycleYears: '',
    amountPaid: '',
    notes: '',
  });
  const [subSaving, setSubSaving] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  // Status change
  const [statusSaving, setStatusSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await platformFetch(`/platform/clients/${id}`);
      const c = res as Client;
      setClient(c);
      if (c.subscription) {
        setSubForm({
          maxStudents: String(c.subscription.maxStudents),
          pricePerUser: String(c.subscription.pricePerUser),
          billingCycleYears: String(c.subscription.billingCycleYears),
          amountPaid: c.subscription.amountPaid != null ? String(c.subscription.amountPaid) : '',
          notes: c.subscription.notes ?? '',
        });
      }
    } catch (e: any) {
      setLoadError(e.message ?? 'Failed to load client');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleDelete = async () => {
    if (!confirm(`Permanently soft-delete "${client?.name}"? This cannot be undone from the UI.`)) return;
    setDeleting(true);
    try {
      await platformFetch(`/platform/clients/${id}`, { method: 'DELETE' });
      router.push('/platform/clients');
    } catch (e: any) {
      alert(e.message);
      setDeleting(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (status: string) => {
    if (!confirm(`Change institution status to "${status}"?`)) return;
    setStatusSaving(true);
    try {
      await platformFetch(`/platform/clients/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setStatusSaving(false);
    }
  };

  const handleSaveSub = async () => {
    setSubSaving(true);
    setSubError(null);
    try {
      await platformFetch(`/platform/clients/${id}/subscription`, {
        method: 'POST',
        body: JSON.stringify({
          maxStudents: parseInt(subForm.maxStudents),
          pricePerUser: parseFloat(subForm.pricePerUser),
          billingCycleYears: parseInt(subForm.billingCycleYears),
          amountPaid: subForm.amountPaid ? parseFloat(subForm.amountPaid) : undefined,
          paidAt: subForm.amountPaid ? new Date().toISOString() : undefined,
          notes: subForm.notes || undefined,
        }),
      });
      setEditSub(false);
      await load();
    } catch (e: any) {
      setSubError(e.message);
    } finally {
      setSubSaving(false);
    }
  };

  const inp = 'w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500';

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading...</div>;
  if (loadError) return (
    <div className="p-8">
      <button onClick={() => router.push('/platform/clients')} className="text-xs text-gray-500 hover:text-gray-300 mb-4 block">← Back to Clients</button>
      <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-400 text-sm">{loadError}</div>
    </div>
  );
  if (!client) return <div className="p-8 text-gray-500 text-sm">Client not found</div>;

  const days = client.subscription ? daysLeft(client.subscription.endDate) : null;
  const actualStudents = client._count.students;
  const seatLimit = client.subscription?.maxStudents ?? null;
  const overLimit = seatLimit !== null && actualStudents > seatLimit;
  const usagePct = seatLimit ? Math.min(Math.round((actualStudents / seatLimit) * 100), 100) : 0;

  return (
    <div className="p-8 max-w-3xl space-y-6">
      {/* Over-limit warning banner */}
      {overLimit && (
        <div className="bg-red-900/30 border border-red-700/60 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-red-400 text-lg leading-none mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-semibold text-red-400">Student limit exceeded</p>
            <p className="text-xs text-red-400/70 mt-0.5">
              This school has <strong>{actualStudents.toLocaleString()}</strong> active students but their subscription covers only <strong>{seatLimit!.toLocaleString()}</strong> seats ({actualStudents - seatLimit!} over). Contact them to upgrade.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => router.push('/platform/clients')} className="text-xs text-gray-500 hover:text-gray-300 mb-2 block">
            ← Back to Clients
          </button>
          <h1 className="text-2xl font-bold text-white">{client.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="font-mono text-xs text-indigo-300 bg-indigo-900/30 px-2 py-0.5 rounded">{client.code}</span>
            <span className="text-xs text-gray-500 capitalize">{client.institutionType}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              client.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'
            }`}>
              {client.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {client.status !== 'suspended' && (
            <button
              onClick={() => handleStatusChange('suspended')}
              disabled={statusSaving}
              className="px-3 py-1.5 text-xs border border-yellow-700 text-yellow-400 rounded-lg hover:bg-yellow-900/20 disabled:opacity-50"
            >
              Suspend
            </button>
          )}
          {client.status !== 'active' && (
            <button
              onClick={() => handleStatusChange('active')}
              disabled={statusSaving}
              className="px-3 py-1.5 text-xs bg-green-700 hover:bg-green-600 text-white rounded-lg disabled:opacity-50"
            >
              Activate
            </button>
          )}
          {client.status !== 'inactive' && (
            <button
              onClick={() => handleStatusChange('inactive')}
              disabled={statusSaving}
              className="px-3 py-1.5 text-xs border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              Deactivate
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 text-xs bg-red-900/40 border border-red-700 text-red-400 rounded-lg hover:bg-red-900/70 disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Seat usage card */}
        <div className={`bg-gray-900 border rounded-xl p-4 ${overLimit ? 'border-red-700/60' : 'border-gray-800'}`}>
          <p className="text-xs text-gray-500">Active Students</p>
          <p className={`text-lg font-bold mt-1 ${overLimit ? 'text-red-400' : 'text-white'}`}>
            {actualStudents.toLocaleString()}
            {seatLimit && (
              <span className="text-sm font-normal text-gray-500"> / {seatLimit.toLocaleString()}</span>
            )}
          </p>
          {seatLimit && (
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${overLimit ? 'bg-red-500' : usagePct >= 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
              <p className={`text-xs mt-1 ${overLimit ? 'text-red-400' : 'text-gray-600'}`}>
                {overLimit ? `${actualStudents - seatLimit} over limit` : `${usagePct}% used`}
              </p>
            </div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500">Staff / Users</p>
          <p className="text-lg font-bold text-white mt-1">{client._count.users}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500">Onboarded</p>
          <p className="text-lg font-bold text-white mt-1">{formatDate(client.createdAt)}</p>
        </div>
      </div>

      {/* Subscription */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300">Subscription</h2>
          <button
            onClick={() => setEditSub(!editSub)}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            {editSub ? 'Cancel' : client.subscription ? 'Edit / Renew' : 'Add Subscription'}
          </button>
        </div>

        {!client.subscription && !editSub && (
          <p className="text-sm text-gray-500">No subscription configured yet.</p>
        )}

        {client.subscription && !editSub && (
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Plan</span>
              <span className="text-white capitalize">{client.subscription.planName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Seat Limit</span>
              <span className="text-white flex items-center gap-2">
                {client.subscription.maxStudents.toLocaleString()}
                {overLimit && (
                  <span className="text-xs bg-red-900/40 border border-red-700/50 text-red-400 px-2 py-0.5 rounded font-semibold">
                    {actualStudents - client.subscription.maxStudents} over
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Price / Student</span>
              <span className="text-white">₹{client.subscription.pricePerUser}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Annual Amount</span>
              <span className="text-white font-bold">{formatCurrency(client.subscription.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Amount Paid</span>
              <span className={client.subscription.amountPaid === client.subscription.totalAmount ? 'text-green-400' : 'text-orange-400'}>
                {client.subscription.amountPaid != null ? formatCurrency(client.subscription.amountPaid) : 'Pending'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Valid From</span>
              <span className="text-white">{formatDate(client.subscription.startDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Valid Until</span>
              <span className={`font-medium ${days !== null && days < 0 ? 'text-red-400' : days !== null && days <= 30 ? 'text-yellow-400' : 'text-white'}`}>
                {formatDate(client.subscription.endDate)}
                {days !== null && (
                  <span className="ml-2 text-xs">
                    {days < 0 ? `(expired ${Math.abs(days)}d ago)` : `(${days}d left)`}
                  </span>
                )}
              </span>
            </div>
            {client.subscription.notes && (
              <div className="pt-2 border-t border-gray-800">
                <p className="text-xs text-gray-500">{client.subscription.notes}</p>
              </div>
            )}
          </div>
        )}

        {editSub && (
          <div className="space-y-3">
            {subError && <div className="text-red-400 text-xs">{subError}</div>}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Max Students</label>
                <input type="number" className={inp} value={subForm.maxStudents}
                  onChange={(e) => setSubForm((f) => ({ ...f, maxStudents: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Price / Student (₹)</label>
                <input type="number" className={inp} value={subForm.pricePerUser}
                  onChange={(e) => setSubForm((f) => ({ ...f, pricePerUser: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Duration (years)</label>
                <input type="number" className={inp} min={1} max={5} value={subForm.billingCycleYears}
                  onChange={(e) => setSubForm((f) => ({ ...f, billingCycleYears: e.target.value }))} />
              </div>
            </div>
            <div className="bg-indigo-900/20 border border-indigo-800 rounded-lg px-4 py-2.5">
              <p className="text-xs text-gray-400">Total Amount</p>
              <p className="text-lg font-bold text-indigo-300">
                ₹{((parseInt(subForm.maxStudents) || 0) * (parseFloat(subForm.pricePerUser) || 0)).toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Amount Paid (₹) — leave empty if unpaid</label>
              <input type="number" className={inp} placeholder="0" value={subForm.amountPaid}
                onChange={(e) => setSubForm((f) => ({ ...f, amountPaid: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Notes</label>
              <input className={inp} placeholder="Payment notes..." value={subForm.notes}
                onChange={(e) => setSubForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <button
              onClick={handleSaveSub}
              disabled={subSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {subSaving ? 'Saving...' : 'Save Subscription'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
