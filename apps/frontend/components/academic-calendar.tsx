'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

export type EventType = 'holiday' | 'exam' | 'event' | 'meeting' | 'vacation' | 'other';

export type CalendarEvent = {
  id: string;
  title: string;
  description?: string;
  eventType: EventType;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  createdBy?: { email?: string; phone?: string };
  createdAt: string;
};

// ── Config ─────────────────────────────────────────────────────────────────

export const EVENT_TYPES: { value: EventType; label: string; color: string; bg: string; dot: string }[] = [
  { value: 'holiday',  label: 'Holiday',          color: 'text-red-700',    bg: 'bg-red-100',    dot: 'bg-red-500'    },
  { value: 'exam',     label: 'Exam',             color: 'text-purple-700', bg: 'bg-purple-100', dot: 'bg-purple-500' },
  { value: 'event',    label: 'School Event',     color: 'text-blue-700',   bg: 'bg-blue-100',   dot: 'bg-blue-500'   },
  { value: 'meeting',  label: 'Meeting / PTM',    color: 'text-green-700',  bg: 'bg-green-100',  dot: 'bg-green-500'  },
  { value: 'vacation', label: 'Vacation / Break', color: 'text-orange-700', bg: 'bg-orange-100', dot: 'bg-orange-500' },
  { value: 'other',    label: 'Other',            color: 'text-gray-700',   bg: 'bg-gray-100',   dot: 'bg-gray-400'   },
];

function getEventStyle(type: EventType) {
  return EVENT_TYPES.find((e) => e.value === type) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── Helpers ────────────────────────────────────────────────────────────────

function toLocalDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function eventSpansDate(event: CalendarEvent, dateStr: string): boolean {
  const start = toLocalDateStr(new Date(event.startDate));
  const end   = toLocalDateStr(new Date(event.endDate));
  return dateStr >= start && dateStr <= end;
}

function formatDateDisplay(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Modal: Create / Edit ───────────────────────────────────────────────────

type EventFormProps = {
  initial?: Partial<CalendarEvent> & { startDate?: string; endDate?: string };
  onSave: (data: Omit<CalendarEvent, 'id' | 'createdAt' | 'createdBy'>) => Promise<void>;
  onClose: () => void;
};

function EventForm({ initial, onSave, onClose }: EventFormProps) {
  const [title,       setTitle]       = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [eventType,   setEventType]   = useState<EventType>(initial?.eventType ?? 'event');
  const [startDate,   setStartDate]   = useState(initial?.startDate ? initial.startDate.slice(0, 10) : '');
  const [endDate,     setEndDate]     = useState(initial?.endDate   ? initial.endDate.slice(0, 10)   : '');
  const [isAllDay,    setIsAllDay]    = useState(initial?.isAllDay ?? true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const handleSave = async () => {
    if (!title.trim())    return setError('Title is required');
    if (!startDate)       return setError('Start date is required');
    if (!endDate)         return setError('End date is required');
    if (endDate < startDate) return setError('End date must be on or after start date');

    setSaving(true);
    setError(null);
    try {
      await onSave({ title: title.trim(), description: description.trim() || undefined, eventType, startDate, endDate, isAllDay });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full px-3 py-2 rounded-lg text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-800">{initial?.id ? 'Edit Event' : 'Add Event'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg text-xs bg-red-50 border border-red-200 text-red-600">{error}</div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
            <input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Diwali Holiday" maxLength={150} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select className={inp + ' bg-white'} value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
              {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date *</label>
              <input type="date" className={inp} value={startDate} onChange={(e) => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value); }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date *</label>
              <input type="date" className={inp} value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} className="w-4 h-4 accent-black" />
            All-day event
          </label>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
            <textarea className={inp + ' resize-none'} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Additional details…" maxLength={500} />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-black text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Event'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Event Detail Modal ─────────────────────────────────────────────────────

function EventDetail({
  event,
  canManage,
  onEdit,
  onDelete,
  onClose,
}: {
  event: CalendarEvent;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const style = getEventStyle(event.eventType);
  const sameDay = toLocalDateStr(new Date(event.startDate)) === toLocalDateStr(new Date(event.endDate));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${style.bg} ${style.color}`}>
              {style.label}
            </span>
            <h3 className="text-base font-bold text-gray-800 leading-tight">{event.title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-3 mt-1 shrink-0">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>
              {sameDay
                ? formatDateDisplay(event.startDate)
                : `${formatDateDisplay(event.startDate)} – ${formatDateDisplay(event.endDate)}`}
              {event.isAllDay && <span className="text-xs text-gray-400 ml-1">(All day)</span>}
            </span>
          </div>
          {event.description && <p className="text-gray-600 text-sm mt-1 leading-relaxed">{event.description}</p>}
          {event.createdBy && (
            <p className="text-xs text-gray-400">
              Added by {event.createdBy.email || event.createdBy.phone}
            </p>
          )}
        </div>

        {canManage && (
          <div className="flex gap-2">
            <button onClick={onEdit} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
              Edit
            </button>
            <button onClick={onDelete} className="flex-1 border border-red-200 text-red-600 py-2 rounded-lg text-sm font-medium hover:bg-red-50">
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Calendar Component ────────────────────────────────────────────────

type AcademicCalendarProps = {
  canManage?: boolean; // true → show Add/Edit/Delete buttons
};

export default function AcademicCalendar({ canManage = false }: AcademicCalendarProps) {
  const today      = new Date();
  const [year,     setYear]    = useState(today.getFullYear());
  const [month,    setMonth]   = useState(today.getMonth()); // 0-based
  const [events,   setEvents]  = useState<CalendarEvent[]>([]);
  const [loading,  setLoading] = useState(true);

  // Modal state
  const [formOpen,       setFormOpen]       = useState(false);
  const [editingEvent,   setEditingEvent]   = useState<CalendarEvent | null>(null);
  const [prefillStart,   setPrefillStart]   = useState('');
  const [detailEvent,    setDetailEvent]    = useState<CalendarEvent | null>(null);
  const [filterType,     setFilterType]     = useState<EventType | 'all'>('all');

  // Fetch events for visible month window (include a small buffer)
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const to   = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const data = await apiFetch(`/calendar/events?from=${from}&to=${to}`);
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth     = new Date(year, month + 1, 0).getDate();
  const todayStr        = toLocalDateStr(today);

  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  function eventsForDay(day: number): CalendarEvent[] {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(
      (e) => eventSpansDate(e, dateStr) && (filterType === 'all' || e.eventType === filterType),
    );
  }

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  async function handleSave(data: Omit<CalendarEvent, 'id' | 'createdAt' | 'createdBy'>) {
    if (editingEvent) {
      await apiFetch(`/calendar/events/${editingEvent.id}`, { method: 'PATCH', body: JSON.stringify(data) });
    } else {
      await apiFetch('/calendar/events', { method: 'POST', body: JSON.stringify(data) });
    }
    setFormOpen(false);
    setEditingEvent(null);
    await loadEvents();
  }

  async function handleDelete(event: CalendarEvent) {
    if (!confirm(`Delete "${event.title}"?`)) return;
    await apiFetch(`/calendar/events/${event.id}`, { method: 'DELETE' });
    setDetailEvent(null);
    await loadEvents();
  }

  function openAddForDay(day: number) {
    if (!canManage) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setPrefillStart(dateStr);
    setEditingEvent(null);
    setFormOpen(true);
  }

  // Filtered event list for sidebar
  const allFiltered = events.filter((e) => filterType === 'all' || e.eventType === filterType);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Academic Calendar</h1>
          <p className="text-xs text-gray-400 mt-0.5">School events, holidays, exams & term dates</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as EventType | 'all')}
            className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
          >
            <option value="all">All types</option>
            {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {canManage && (
            <button
              onClick={() => { setPrefillStart(''); setEditingEvent(null); setFormOpen(true); }}
              className="flex items-center gap-1.5 bg-black text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-800"
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Event
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-5 flex-col lg:flex-row">

        {/* ── Calendar grid ── */}
        <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <h2 className="text-sm font-bold text-gray-800">{MONTH_NAMES[month]} {year}</h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAY_NAMES.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400">{d}</div>
            ))}
          </div>

          {/* Date cells */}
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
          ) : (
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="min-h-[80px] border-b border-r border-gray-50 bg-gray-50/30" />;

                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = dateStr === todayStr;
                const dayEvents = eventsForDay(day);

                return (
                  <div
                    key={day}
                    className={`min-h-[80px] border-b border-r border-gray-100 p-1.5 transition-colors ${canManage ? 'cursor-pointer hover:bg-blue-50/30' : ''} ${isToday ? 'bg-amber-50/40' : ''}`}
                    onClick={() => canManage && dayEvents.length === 0 && openAddForDay(day)}
                  >
                    <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-0.5 ${isToday ? 'bg-black text-white' : 'text-gray-600'}`}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((event) => {
                        const style = getEventStyle(event.eventType);
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => { e.stopPropagation(); setDetailEvent(event); }}
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${style.bg} ${style.color}`}
                            title={event.title}
                          >
                            {event.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Upcoming events sidebar ── */}
        <div className="lg:w-72 shrink-0">
          {/* Legend */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Legend</p>
            <div className="space-y-1.5">
              {EVENT_TYPES.map((t) => (
                <div key={t.value} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.dot}`} />
                  <span className="text-xs text-gray-600">{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* This month's events list */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {MONTH_NAMES[month]} Events
              {allFiltered.length > 0 && <span className="ml-1 text-gray-400 font-normal">({allFiltered.length})</span>}
            </p>
            {allFiltered.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No events this month</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {allFiltered.map((event) => {
                  const style = getEventStyle(event.eventType);
                  const sameDay = toLocalDateStr(new Date(event.startDate)) === toLocalDateStr(new Date(event.endDate));
                  return (
                    <div
                      key={event.id}
                      onClick={() => setDetailEvent(event)}
                      className="cursor-pointer rounded-lg p-2.5 hover:bg-gray-50 border border-gray-100 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${style.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{event.title}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {sameDay
                              ? formatDateDisplay(event.startDate)
                              : `${formatDateDisplay(event.startDate)} – ${formatDateDisplay(event.endDate)}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add / Edit form modal ── */}
      {formOpen && (
        <EventForm
          initial={editingEvent
            ? { ...editingEvent }
            : prefillStart
              ? { startDate: prefillStart, endDate: prefillStart }
              : undefined}
          onSave={handleSave}
          onClose={() => { setFormOpen(false); setEditingEvent(null); }}
        />
      )}

      {/* ── Event detail modal ── */}
      {detailEvent && (
        <EventDetail
          event={detailEvent}
          canManage={canManage}
          onEdit={() => { setEditingEvent(detailEvent); setDetailEvent(null); setFormOpen(true); }}
          onDelete={() => handleDelete(detailEvent)}
          onClose={() => setDetailEvent(null)}
        />
      )}
    </div>
  );
}
