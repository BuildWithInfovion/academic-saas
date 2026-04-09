'use client';

import { useEffect, useState, useCallback } from 'react';
import { platformFetch } from '@/lib/platform-api';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
  code: string;
  institutionType: string;
  planCode: string;
  status: string;
  createdAt: string;
  subscription?: {
    planName: string;
    maxStudents: number;
    pricePerUser: number;
    totalAmount: number;
    endDate: string;
    status: string;
    amountPaid?: number;
  };
  _count: { students: number; users: number };
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function daysLeft(endDate: string) {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function SubBadge({ sub }: { sub?: Client['subscription'] }) {
  if (!sub) return <span className="text-xs text-gray-600">No subscription</span>;
  const days = daysLeft(sub.endDate);
  if (days < 0) return <span className="text-xs font-medium text-red-400 bg-red-900/20 px-2 py-0.5 rounded-full">Expired</span>;
  if (days <= 30) return <span className="text-xs font-medium text-yellow-400 bg-yellow-900/20 px-2 py-0.5 rounded-full">{days}d left</span>;
  return <span className="text-xs font-medium text-green-400 bg-green-900/20 px-2 py-0.5 rounded-full">Active · {days}d</span>;
}

export default function PlatformClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'no-sub'>('all');

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await platformFetch('/platform/clients');
      setClients(res as Client[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const filtered = clients.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'no-sub') return !c.subscription;
    if (filter === 'expired') return c.subscription && daysLeft(c.subscription.endDate) < 0;
    if (filter === 'active') return c.subscription && daysLeft(c.subscription.endDate) >= 0;
    return true;
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-sm text-gray-400 mt-1">{clients.length} institution{clients.length !== 1 ? 's' : ''} onboarded</p>
        </div>
        <Link
          href="/platform/clients/new"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Onboard Client
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'active', 'expired', 'no-sub'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {f === 'no-sub' ? 'No Subscription' : f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading clients...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No clients found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500">
                <th className="px-4 py-3 text-left font-medium">Institution</th>
                <th className="px-4 py-3 text-left font-medium">Login Code</th>
                <th className="px-4 py-3 text-left font-medium">Students</th>
                <th className="px-4 py-3 text-left font-medium">Seats</th>
                <th className="px-4 py-3 text-left font-medium">Total Fee</th>
                <th className="px-4 py-3 text-left font-medium">Subscription</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/platform/clients/${c.id}`} className="font-medium text-white hover:text-indigo-300">
                      {c.name}
                    </Link>
                    <p className="text-xs text-gray-500 capitalize">{c.institutionType}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-indigo-300 bg-indigo-900/30 px-2 py-1 rounded">{c.code}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{c._count.students}</td>
                  <td className="px-4 py-3 text-gray-300">{c.subscription?.maxStudents ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {c.subscription ? formatCurrency(c.subscription.totalAmount) : '—'}
                  </td>
                  <td className="px-4 py-3"><SubBadge sub={c.subscription} /></td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      c.status === 'active'
                        ? 'text-green-400 bg-green-900/20'
                        : 'text-gray-400 bg-gray-800'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/platform/clients/${c.id}`}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Manage →
                    </Link>
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
