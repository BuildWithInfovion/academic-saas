'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Teacher = { id: string; name: string; email?: string; roles?: string[] };
type Child = { id: string; firstName: string; lastName: string };
type Message = { id: string; senderId: string; content: string; createdAt: string; readAt?: string | null };
type Conversation = {
  id: string;
  teacherUserId: string;
  studentId?: string;
  subject?: string;
  updatedAt: string;
  teacherName?: string;
  lastMessage?: string;
  unreadCount?: number;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ParentMessagesPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [myUserId, setMyUserId] = useState('');
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newTeacherId, setNewTeacherId] = useState('');
  const [newChildId, setNewChildId] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    Promise.allSettled([
      apiFetch('/students/child'),
      apiFetch('/messages/teachers'),
      apiFetch('/messages/conversations?role=parent'),
    ]).then(([kids, tchs, convs]) => {
      if (kids.status === 'fulfilled') {
        const list = Array.isArray(kids.value) ? kids.value as Child[] : [];
        setChildren(list);
        if (list.length > 0) setNewChildId(list[0].id);
      }
      if (tchs.status === 'fulfilled') setTeachers((tchs.value as Teacher[]) || []);
      if (convs.status === 'fulfilled') setConversations((convs.value as Conversation[]) || []);
    });
  }, []);

  const loadConversation = (id: string) => {
    setActiveConv(id);
    setLoadingMsgs(true);
    apiFetch(`/messages/conversations/${id}`)
      .then((data: any) => {
        setMessages(data.messages || []);
        setMyUserId(data.myUserId || '');
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
        );
      })
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));
  };

  useEffect(() => {
    if (!activeConv) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      apiFetch(`/messages/conversations/${activeConv}`)
        .then((data: any) => {
          setMessages(data.messages || []);
          setMyUserId(data.myUserId || '');
        })
        .catch(() => {});
    }, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeConv]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMsg.trim() || !activeConv || sending) return;
    setSending(true);
    try {
      const data: any = await apiFetch(`/messages/conversations/${activeConv}/send`, {
        method: 'POST',
        body: JSON.stringify({ content: newMsg.trim() }),
      });
      setMessages((prev) => [...prev, data]);
      setNewMsg('');
    } catch (e: any) {
      setError(e.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const startConversation = async () => {
    if (!newTeacherId) return;
    setStarting(true);
    try {
      const conv: any = await apiFetch('/messages/conversations', {
        method: 'POST',
        body: JSON.stringify({
          teacherUserId: newTeacherId,
          studentId: newChildId || undefined,
          subject: newSubject.trim() || undefined,
        }),
      });
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === conv.id);
        if (exists) return prev;
        const teacher = teachers.find((t) => t.id === newTeacherId);
        return [{ ...conv, teacherName: teacher?.name }, ...prev];
      });
      setShowNew(false);
      setNewSubject('');
      loadConversation(conv.id);
    } catch (e: any) {
      setError(e.message || 'Failed to start conversation');
    } finally {
      setStarting(false);
    }
  };

  const activeConvObj = conversations.find((c) => c.id === activeConv);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 border-r border-ds-border bg-ds-surface flex flex-col">
        <div className="p-4 border-b border-ds-border flex items-center justify-between">
          <h2 className="font-semibold text-ds-text1">Messages</h2>
          <button
            onClick={() => setShowNew(true)}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-ds-brand text-white font-medium hover:opacity-90"
          >
            + New
          </button>
        </div>

        {/* New conversation modal */}
        {showNew && (
          <div className="p-4 bg-ds-bg2 border-b border-ds-border">
            <p className="text-xs font-semibold text-ds-text2 mb-2">Start New Conversation</p>
            <select
              value={newTeacherId}
              onChange={(e) => setNewTeacherId(e.target.value)}
              className="w-full border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface mb-2 focus:outline-none"
            >
              <option value="">Select Teacher…</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {children.length > 1 && (
              <select
                value={newChildId}
                onChange={(e) => setNewChildId(e.target.value)}
                className="w-full border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface mb-2 focus:outline-none"
              >
                {children.map((c) => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            )}
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Subject (optional)"
              className="w-full border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface mb-2 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={startConversation}
                disabled={!newTeacherId || starting}
                className="flex-1 py-1.5 rounded-lg bg-ds-brand text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
              >
                {starting ? 'Starting…' : 'Start'}
              </button>
              <button
                onClick={() => { setShowNew(false); setError(''); }}
                className="flex-1 py-1.5 rounded-lg border border-ds-border text-xs text-ds-text2 hover:bg-ds-bg2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <div className="p-6 text-center text-sm text-ds-text3">
              No conversations yet.<br />
              <span className="text-xs">Tap &quot;+ New&quot; to message a teacher.</span>
            </div>
          )}
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => loadConversation(conv.id)}
              className={`w-full text-left px-4 py-3 border-b border-ds-border hover:bg-ds-bg2 transition-colors ${activeConv === conv.id ? 'bg-ds-bg2' : ''}`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm font-medium text-ds-text1 truncate">{conv.teacherName ?? 'Teacher'}</span>
                <span className="text-xs text-ds-text3 flex-shrink-0 ml-2">{timeAgo(conv.updatedAt)}</span>
              </div>
              {conv.subject && <p className="text-xs text-ds-text2 truncate">{conv.subject}</p>}
              {conv.lastMessage && <p className="text-xs text-ds-text3 truncate mt-0.5">{conv.lastMessage}</p>}
              {(conv.unreadCount ?? 0) > 0 && (
                <span className="inline-block mt-1 px-1.5 py-0.5 bg-ds-brand text-white text-xs rounded-full">{conv.unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeConv ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-ds-text3">
              <svg className="mx-auto mb-3 opacity-30" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <p className="text-sm">Select a conversation or start a new one</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-5 py-3 border-b border-ds-border bg-ds-surface flex items-center gap-3">
              <div>
                <p className="font-semibold text-ds-text1 text-sm">{activeConvObj?.teacherName ?? 'Teacher'}</p>
                {activeConvObj?.subject && <p className="text-xs text-ds-text3">{activeConvObj.subject}</p>}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-ds-bg">
              {loadingMsgs && <p className="text-xs text-ds-text3 text-center">Loading…</p>}
              {messages.map((msg) => {
                const isMe = msg.senderId === myUserId;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-xs sm:max-w-sm px-3.5 py-2.5 rounded-2xl text-sm ${
                        isMe
                          ? 'bg-ds-brand text-white rounded-br-sm'
                          : 'bg-ds-surface border border-ds-border text-ds-text1 rounded-bl-sm'
                      }`}
                    >
                      <p className="leading-relaxed">{msg.content}</p>
                      <p className={`text-xs mt-1 ${isMe ? 'text-white/60' : 'text-ds-text3'}`}>{timeAgo(msg.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            {error && <p className="px-4 py-1 text-xs text-red-600 bg-red-50">{error}</p>}
            <div className="px-4 py-3 border-t border-ds-border bg-ds-surface flex gap-2 items-end">
              <textarea
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Type a message… (Enter to send)"
                rows={1}
                className="flex-1 resize-none border border-ds-border-strong rounded-xl px-3 py-2.5 text-sm bg-ds-surface focus:outline-none focus:ring-1 focus:ring-ds-brand max-h-28 overflow-y-auto"
                style={{ minHeight: '42px' }}
              />
              <button
                onClick={sendMessage}
                disabled={!newMsg.trim() || sending}
                className="p-2.5 rounded-xl bg-ds-brand text-white disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
