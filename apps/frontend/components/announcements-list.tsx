'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Announcement = {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  targetRoles: string[];
  createdAt: string;
  author: { email: string };
};

type Props = {
  canCreate?: boolean;
  currentRole?: string;
};

const TARGET_ROLE_OPTIONS = [
  { value: 'all', label: 'Everyone' },
  { value: 'teacher', label: 'Teachers only' },
  { value: 'student', label: 'Students only' },
  { value: 'parent', label: 'Parents only' },
  { value: 'principal', label: 'Principal only' },
];

export default function AnnouncementsList({ canCreate = false, currentRole }: Props) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState('all');
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch('/announcements')
      .then(setAnnouncements)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!title.trim() || !body.trim()) return setError('Title and body are required');
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          targetRoles: [targetRole],
          isPinned,
        }),
      });
      setTitle(''); setBody(''); setTargetRole('all'); setIsPinned(false);
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await apiFetch(`/announcements/${id}`, { method: 'DELETE' });
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch {}
  };

  const pinned = announcements.filter((a) => a.isPinned);
  const regular = announcements.filter((a) => !a.isPinned);

  return (
    <div className="space-y-5">
      {/* Create button */}
      {canCreate && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          + New Announcement
        </button>
      )}

      {/* Create form */}
      {canCreate && showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">New Announcement</p>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            <textarea
              placeholder="Announcement body..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
            />
            <div className="flex gap-4 items-center flex-wrap">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Visible to</label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="border border-gray-300 rounded-lg p-2 text-sm bg-white"
                >
                  {TARGET_ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mt-4">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 accent-black"
                />
                Pin to top
              </label>
            </div>
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-5 py-2 bg-black text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {submitting ? 'Posting...' : 'Post'}
              </button>
              <button
                onClick={() => { setShowForm(false); setError(null); }}
                className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <p className="text-sm text-gray-400">Loading announcements...</p>}

      {/* No announcements */}
      {!loading && announcements.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-gray-400 text-sm">No announcements yet.</p>
          {canCreate && <p className="text-gray-300 text-xs mt-1">Click &ldquo;New Announcement&rdquo; to post one.</p>}
        </div>
      )}

      {/* Pinned announcements */}
      {pinned.map((a) => (
        <AnnouncementCard key={a.id} a={a} canDelete={canCreate} onDelete={handleDelete} pinned />
      ))}

      {/* Regular announcements */}
      {regular.map((a) => (
        <AnnouncementCard key={a.id} a={a} canDelete={canCreate} onDelete={handleDelete} />
      ))}
    </div>
  );
}

function AnnouncementCard({
  a,
  canDelete,
  onDelete,
  pinned = false,
}: {
  a: Announcement;
  canDelete: boolean;
  onDelete: (id: string) => void;
  pinned?: boolean;
}) {
  const date = new Date(a.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 ${pinned ? 'border-amber-200' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {pinned && (
              <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">Pinned</span>
            )}
            <h3 className="font-semibold text-gray-800 text-sm">{a.title}</h3>
          </div>
          <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">{a.body}</p>
          <p className="text-xs text-gray-400 mt-3">
            {a.author?.email} · {date}
          </p>
        </div>
        {canDelete && (
          <button
            onClick={() => onDelete(a.id)}
            className="text-xs text-red-400 hover:text-red-600 shrink-0"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
