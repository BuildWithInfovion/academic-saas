'use client';

import { useEffect, useState } from 'react';
import { platformFetch } from '@/lib/platform-api';
import Link from 'next/link';

interface Stats {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  totalRevenue: number;
  pendingRevenue: number;
}

interface Client {
  id: string;
  name: string;
  code: string;
  institutionType: string;
  status: string;
  createdAt: string;
  subscription?: {
    endDate: string;
    status: string;
    maxStudents: number;
    totalAmount: number;
  };
  _count: { students: number; users: number };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function daysLeft(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function PlatformDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      platformFetch('/platform/stats'),
      platformFetch('/platform/clients'),
    ]).then(([s, c]) => {
      setStats(s as Stats);
      setClients((c as Client[]).slice(0, 5));
    }).catch((e: any) => setError(e.message ?? 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading dashboard...</div>;
  if (error) return (
    <div className="p-8">
      <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-400 text-sm">{error}</div>
    </div>
  );

  const statCards = [
    { label: 'Total Clients', value: stats?.total ?? 0, color: 'text-white', bg: 'bg-gray-800' },
    { label: 'Active', value: stats?.active ?? 0, color: 'text-green-400', bg: 'bg-green-900/20 border-green-800' },
    { label: 'Expiring Soon', value: stats?.expiringSoon ?? 0, color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-800' },
    { label: 'Expired', value: stats?.expired ?? 0, color: 'text-red-400', bg: 'bg-red-900/20 border-red-800' },
    { label: 'Total Revenue', value: formatCurrency(stats?.totalRevenue ?? 0), color: 'text-indigo-300', bg: 'bg-indigo-900/20 border-indigo-800' },
    { label: 'Pending Collection', value: formatCurrency(stats?.pendingRevenue ?? 0), color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-800' },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-sm text-gray-400 mt-1">All clients across the Infovion network</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border border-gray-800 p-5 ${card.bg}`}
          >
            <p className="text-xs text-gray-400 mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Recent clients */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300">Recent Onboardings</h2>
          <Link href="/platform/clients" className="text-xs text-indigo-400 hover:text-indigo-300">
            View all →
          </Link>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {clients.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No clients yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500">
                  <th className="px-4 py-3 text-left font-medium">Institution</th>
                  <th className="px-4 py-3 text-left font-medium">Code</th>
                  <th className="px-4 py-3 text-left font-medium">Students</th>
                  <th className="px-4 py-3 text-left font-medium">Subscription</th>
                  <th className="px-4 py-3 text-left font-medium">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {clients.map((c) => {
                  const days = c.subscription ? daysLeft(c.subscription.endDate) : null;
                  const expStatus = days === null ? 'none' : days < 0 ? 'expired' : days <= 30 ? 'expiring' : 'ok';
                  return (
                    <tr key={c.id} className="hover:bg-gray-800/50 transition-colors">
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
                      <td className="px-4 py-3">
                        {c.subscription ? (
                          <span className="text-gray-300">{c.subscription.maxStudents} seats</span>
                        ) : (
                          <span className="text-gray-600">No subscription</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {expStatus === 'none' && <span className="text-gray-600">—</span>}
                        {expStatus === 'expired' && <span className="text-red-400 text-xs font-medium">Expired</span>}
                        {expStatus === 'expiring' && <span className="text-yellow-400 text-xs font-medium">{days}d left</span>}
                        {expStatus === 'ok' && <span className="text-gray-400 text-xs">{days}d left</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
