'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface AuditLog {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string | null } | null;
}

interface AuditResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

const ENTITY_TYPES = ['', 'student', 'user', 'fee_payment', 'attendance', 'exam', 'announcement', 'institution', 'role'];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

function actionColor(action: string) {
  if (action.includes('DELETE') || action.includes('REMOVE') || action.includes('UNLINK')) return '#dc2626';
  if (action.includes('CREATE') || action.includes('ADMIT') || action.includes('ADD')) return '#16a34a';
  if (action.includes('UPDATE') || action.includes('EDIT') || action.includes('LINK')) return '#2563eb';
  if (action.includes('LOGIN') || action.includes('LOGOUT')) return '#7c3aed';
  return '#6b7280';
}

export default function AuditLogPage() {
  const [data,    setData]    = useState<AuditResponse | null>(null);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState('');
  const [entity,  setEntity]  = useState('');

  const limit = 50;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) });
      if (filter.trim()) params.set('action', filter.trim());
      if (entity) params.set('entityType', entity);
      const res = await apiFetch(`/audit-logs?${params}`) as AuditResponse;
      setData(res);
      setPage(p);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [filter, entity]);

  useEffect(() => { void load(1); }, [load]);

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Activity trail — who did what, when</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Search action</label>
            <input
              type="text"
              placeholder="e.g. CREATE, DELETE, LOGIN…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Entity type</label>
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            >
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t || 'All types'}</option>)}
            </select>
          </div>
          <button
            onClick={() => void load(1)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--brand)' }}
          >
            Apply
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* Log table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
            {data ? `${data.total.toLocaleString('en-IN')} events` : 'Loading…'}
          </span>
          {data && totalPages > 1 && (
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>Page {page} of {totalPages}</span>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-3)' }}>Loading…</div>
        ) : !data || data.logs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--brand-subtle)' }}>
              <svg width="20" height="20" fill="none" stroke="var(--brand)" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>No events found</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Try adjusting your filters</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {data.logs.map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-start gap-4 hover:bg-[var(--bg)] transition-colors">
                {/* Action badge */}
                <div className="shrink-0 mt-0.5">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold"
                    style={{ background: `${actionColor(log.action)}15`, color: actionColor(log.action) }}>
                    {log.action}
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                      {log.user?.name || log.user?.email || 'System'}
                    </span>
                    {log.entityType && (
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--brand-subtle)', color: 'var(--brand)', border: '1px solid var(--brand-border)' }}>
                        {log.entityType}
                      </span>
                    )}
                    {log.entityId && (
                      <span className="text-xs font-mono truncate max-w-[120px]" style={{ color: 'var(--text-3)' }}>
                        {log.entityId.slice(0, 12)}…
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {log.ipAddress && (
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>IP: {log.ipAddress}</span>
                    )}
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {timeAgo(log.createdAt)}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-4, var(--text-3))' }}>
                      {new Date(log.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <button
              disabled={page <= 1}
              onClick={() => void load(page - 1)}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
            >
              ← Previous
            </button>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => void load(page + 1)}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
