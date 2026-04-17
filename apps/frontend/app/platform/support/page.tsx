'use client';

import { useEffect, useState } from 'react';
import { platformFetch } from '@/lib/platform-api';

type Ticket = {
  id: string;
  institutionName: string;
  submittedBy: string;
  submitterRole: string;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function PlatformSupportPage() {
  const [tickets,   setTickets]   = useState<Ticket[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [fetchErr,  setFetchErr]  = useState<string | null>(null);
  const [filter,    setFilter]    = useState<'all' | 'open' | 'resolved'>('open');
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolveErr, setResolveErr] = useState<string | null>(null);

  useEffect(() => {
    platformFetch('/platform/support-tickets')
      .then((data) => setTickets(data as Ticket[]))
      .catch((e: unknown) => setFetchErr(e instanceof Error ? e.message : 'Failed to load tickets'))
      .finally(() => setLoading(false));
  }, []);

  const resolve = async (id: string) => {
    setResolving(id);
    setResolveErr(null);
    try {
      await platformFetch(`/platform/support-tickets/${id}/resolve`, { method: 'PATCH' });
      // Only update UI after backend confirms success
      setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status: 'resolved' } : t));
      setExpanded(null);
    } catch (e: unknown) {
      setResolveErr(e instanceof Error ? e.message : 'Failed to resolve ticket');
    } finally {
      setResolving(null);
    }
  };

  const shown = tickets.filter((t) => filter === 'all' || t.status === filter);
  const openCount = tickets.filter((t) => t.status === 'open').length;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Support Tickets</h1>
          <p className="text-sm text-gray-400 mt-1">
            {openCount > 0 ? `${openCount} open ticket${openCount !== 1 ? 's' : ''} need attention` : 'All tickets resolved'}
          </p>
        </div>
        <div className="flex gap-2">
          {(['open', 'resolved', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {resolveErr && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-sm text-red-400 flex items-center justify-between">
          <span>{resolveErr}</span>
          <button onClick={() => setResolveErr(null)} className="ml-3 text-red-400 hover:text-red-300">✕</button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading tickets…</p>
      ) : fetchErr ? (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-8 text-center">
          <p className="text-red-400 text-sm font-medium">Failed to load tickets</p>
          <p className="text-red-500 text-xs mt-1">{fetchErr}</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm">No {filter !== 'all' ? filter : ''} tickets</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((t) => (
            <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div
                className="flex items-start justify-between px-5 py-4 cursor-pointer hover:bg-gray-800/50"
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${t.status === 'open' ? 'bg-red-400' : 'bg-green-500'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{t.subject}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      <span className="text-indigo-300">{t.institutionName}</span>
                      {' · '}{t.submittedBy}{' · '}{t.submitterRole}{' · '}{timeAgo(t.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    t.status === 'open' ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'
                  }`}>
                    {t.status}
                  </span>
                  <svg
                    width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                    className={`text-gray-500 transition-transform ${expanded === t.id ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>

              {expanded === t.id && (
                <div className="px-5 pb-4 border-t border-gray-800">
                  <p className="text-sm text-gray-300 mt-4 whitespace-pre-wrap">{t.message}</p>
                  {t.status === 'open' && (
                    <button
                      onClick={() => void resolve(t.id)}
                      disabled={resolving === t.id}
                      className="mt-4 px-4 py-1.5 rounded-lg text-xs font-semibold bg-green-700 text-white hover:bg-green-600 transition-colors disabled:opacity-50"
                    >
                      {resolving === t.id ? 'Resolving…' : 'Mark as Resolved'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
