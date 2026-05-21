import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import {
  Search, Send, X, MoreVertical, User, RefreshCw, MessageCircle,
  Check, CheckCheck, Paperclip, Plus, Clock, ArrowLeft, ChevronDown,
  Zap, Edit3, ExternalLink, UserPlus, Phone, Mail, Tag, Bell,
  BellOff, Circle, CheckCircle2, XCircle, AlertCircle, Filter,
  Smile, Image, Mic, MoreHorizontal, Info, Star, Trash2, Forward
} from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';

/* ─── SVG Icons ─── */
const WhatsAppIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);
const InstagramIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>
);
const MessengerIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.908 1.438 5.504 3.686 7.205V22l3.372-1.85C10.007 20.38 10.984 20.5 12 20.5c5.523 0 10-4.145 10-9.257C22 6.145 17.523 2 12 2zm1.044 12.468l-2.55-2.72-4.976 2.72 5.476-5.812 2.612 2.72 4.914-2.72-5.476 5.812z"/>
  </svg>
);

const ChannelIcon = ({ type, size = 14 }) => {
  if (type === 'whatsapp') return <WhatsAppIcon size={size} />;
  if (type === 'instagram') return <InstagramIcon size={size} />;
  if (type === 'messenger') return <MessengerIcon size={size} />;
  return <MessageCircle size={size} />;
};

/* ─── Helpers ─── */
// DB stores direction as 'in'/'out'; SSE/optimistic use 'inbound'/'outbound'. Normalize both.
const isOutbound = (m) => m?.direction === 'out' || m?.direction === 'outbound';
const isInbound = (m) => m?.direction === 'in' || m?.direction === 'inbound';

const parseDate = (ts) => {
  if (!ts) return null;
  if (typeof ts === 'string' && !ts.includes('Z') && !ts.includes('+')) return new Date(ts + 'Z');
  return new Date(ts);
};

const fmtTime = (ts) => {
  if (!ts) return '';
  const d = parseDate(ts);
  if (!d || isNaN(d)) return '';
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const fmtMsgTime = (ts) => {
  if (!ts) return '';
  const d = parseDate(ts);
  if (!d || isNaN(d)) return '';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const channelStyle = (type) => {
  if (type === 'whatsapp') return { bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-200' };
  if (type === 'instagram') return { bg: 'bg-gradient-to-br from-purple-500 to-pink-500', text: 'text-pink-600', light: 'bg-pink-50 text-pink-700', border: 'border-pink-200' };
  if (type === 'messenger') return { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50 text-blue-700', border: 'border-blue-200' };
  return { bg: 'bg-slate-400', text: 'text-slate-600', light: 'bg-slate-50 text-slate-700', border: 'border-slate-200' };
};

const statusConfig = {
  open:     { icon: Circle,       color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200', label: 'Open' },
  pending:  { icon: AlertCircle,  color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-200',   label: 'Pending' },
  resolved: { icon: CheckCircle2, color: 'text-slate-500',   bg: 'bg-slate-50',    border: 'border-slate-200',   label: 'Resolved' },
};

/* ─── Avatar ─── */
function Avatar({ name = '?', size = 38, online = false }) {
  const palettes = [
    ['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'], ['#a18cd1', '#fbc2eb'],
    ['#fccb90', '#d57eeb'], ['#a1c4fd', '#c2e9fb'],
  ];
  const idx = (name.charCodeAt(0) || 0) % palettes.length;
  const [from, to] = palettes[idx];
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full flex items-center justify-center text-white font-bold select-none"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})`, fontSize: size * 0.38 }}>
        {name.charAt(0).toUpperCase()}
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full" />
      )}
    </div>
  );
}

/* ─── Message status tick ─── */
const MsgStatus = ({ status, isOut }) => {
  if (!isOut) return null;
  if (status === 'read') return <CheckCheck size={13} className="text-blue-400 flex-shrink-0" />;
  if (status === 'delivered') return <CheckCheck size={13} className="text-slate-300 flex-shrink-0" />;
  if (status === 'sent') return <Check size={13} className="text-slate-300 flex-shrink-0" />;
  return <Clock size={11} className="text-slate-300 flex-shrink-0" />;
};

/* ─── Channel badge ─── */
function ChannelBadge({ type }) {
  const s = channelStyle(type);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.light} border ${s.border}`}>
      <ChannelIcon type={type} size={9} />
      {type}
    </span>
  );
}

const CHANNEL_FILTERS = ['All', 'WhatsApp', 'Messenger', 'Instagram'];
const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'pending', label: 'Pending' },
  { key: 'resolved', label: 'Resolved' },
];

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function Inbox() {
  const [convs, setConvs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [channels, setChannels] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('all');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [showNewConv, setShowNewConv] = useState(false);
  const [sseStatus, setSseStatus] = useState('connecting'); // connecting | connected | error
  const [contextMenu, setContextMenu] = useState(null); // { x, y, msg }

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const selectedRef = useRef(null); // keep SSE in sync without re-subscribing
  const textareaRef = useRef(null);

  selectedRef.current = selected;

  /* ─── Load conversations ─── */
  const loadConvs = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const params = {};
      if (channelFilter !== 'All') params.type = channelFilter.toLowerCase();
      if (statusFilter !== 'all') params.status = statusFilter;
      const data = await api.conversations(params);
      setConvs(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, [channelFilter, statusFilter]);

  useEffect(() => { loadConvs(); }, [loadConvs]);

  useEffect(() => {
    api.channels().then(setChannels).catch(() => {});
    api.quickReplies().then(setQuickReplies).catch(() => {});
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  /* ─── SSE real-time events ─── */
  useEffect(() => {
    let es;
    let retryTimer;
    let reconnectDelay = 2000;

    function connect() {
      es = new EventSource('/api/events');
      setSseStatus('connecting');

      es.onopen = () => {
        setSseStatus('connected');
        reconnectDelay = 2000;
      };

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'ping') return;

          if (data.type === 'new_message') {
            const convId = data.conversation_id;
            const curSelected = selectedRef.current;

            // Update conversation list
            setConvs(prev => {
              const idx = prev.findIndex(c => c.id === convId);
              if (idx !== -1) {
                const updated = prev.map(c =>
                  c.id === convId ? {
                    ...c,
                    last_message: data.content || '',
                    last_message_at: data.created_at,
                    unread_count: curSelected?.id === convId ? 0 : (c.unread_count || 0) + (isInbound(data) ? 1 : 0)
                  } : c
                );
                // Sort by latest message
                return [...updated].sort((a, b) => {
                  const da = parseDate(a.last_message_at) || new Date(0);
                  const db2 = parseDate(b.last_message_at) || new Date(0);
                  return db2 - da;
                });
              }
              // New conversation — reload list
              loadConvs(true);
              return prev;
            });

            // Append to open chat
            if (curSelected?.id === convId) {
              setMessages(prev => {
                if (prev.find(m => m.id === data.id)) return prev;
                return [...prev, data];
              });
            }

            // Browser notification for incoming messages
            if (isInbound(data) && curSelected?.id !== convId) {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`New message`, {
                  body: data.content || 'New message',
                  icon: '/favicon.ico',
                  tag: `conv-${convId}`,
                });
              }
            }
          }

          // Message deleted elsewhere
          if (data.type === 'message_deleted') {
            if (selectedRef.current?.id === data.conversation_id) {
              setMessages(prev => prev.filter(m => m.id !== data.message_id));
            }
          }

          // Conversation deleted elsewhere
          if (data.type === 'conversation_deleted') {
            setConvs(prev => prev.filter(c => c.id !== data.conversation_id));
            if (selectedRef.current?.id === data.conversation_id) {
              setSelected(null);
              setMessages([]);
            }
          }
        } catch {}
      };

      es.onerror = () => {
        setSseStatus('error');
        es.close();
        retryTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
      };
    }

    connect();
    return () => {
      clearTimeout(retryTimer);
      es?.close();
    };
  }, [loadConvs]); // loadConvs is stable (useCallback with deps)

  /* ─── Load messages when conversation selected ─── */
  useEffect(() => {
    if (!selected) return;
    setMsgLoading(true);
    setMessages([]);
    api.messages(selected.id)
      .then(data => {
        setMessages(Array.isArray(data) ? data : []);
        setMsgLoading(false);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 30);
      })
      .catch(() => setMsgLoading(false));
    // Mark as read
    setConvs(prev => prev.map(c => c.id === selected.id ? { ...c, unread_count: 0 } : c));
  }, [selected?.id]);

  /* ─── Scroll to bottom on new messages ─── */
  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  /* ─── Auto-resize textarea ─── */
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const selectConv = (conv) => {
    setSelected(conv);
    setText('');
    setShowQR(false);
  };

  /* ─── Send message ─── */
  const send = async () => {
    if (!text.trim() || !selected || sending) return;
    const msg = text.trim();
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setSending(true);
    // Optimistic message
    const optimistic = {
      id: `opt-${Date.now()}`,
      content: msg,
      direction: 'outbound',
      status: 'sending',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const resp = await api.sendMessage(selected.id, { content: msg });
      const sent = resp?.message || resp;
      setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...sent, status: sent.status || 'sent' } : m));
      setConvs(prev => prev.map(c => c.id === selected.id
        ? { ...c, last_message: msg, last_message_at: new Date().toISOString() } : c));
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setText(msg);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const updateStatus = async (status) => {
    if (!selected) return;
    try {
      await api.updateConversation(selected.id, { status });
      setSelected(s => ({ ...s, status }));
      setConvs(prev => prev.map(c => c.id === selected.id ? { ...c, status } : c));
    } catch {}
  };

  /* ─── Delete a single message ─── */
  const deleteMessage = async (msgId) => {
    setContextMenu(null);
    // Optimistic remove
    const prevMessages = messages;
    setMessages(prev => prev.filter(m => m.id !== msgId));
    try {
      if (!String(msgId).startsWith('opt-')) {
        await api.deleteMessage(msgId);
      }
    } catch {
      setMessages(prevMessages); // rollback
    }
  };

  /* ─── Delete entire conversation ─── */
  const deleteConversation = async (convId) => {
    try {
      await api.deleteConversation(convId);
      setConvs(prev => prev.filter(c => c.id !== convId));
      if (selected?.id === convId) { setSelected(null); setMessages([]); }
    } catch {}
  };

  /* ─── Filter conversations ─── */
  const filtered = convs.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.contact_name?.toLowerCase().includes(q) ||
      c.contact_phone?.includes(q) ||
      c.last_message?.toLowerCase().includes(q)
    );
  });

  const totalUnread = convs.reduce((s, c) => s + (c.unread_count || 0), 0);

  /* ─── Group messages by date ─── */
  const groupedMessages = messages.reduce((groups, msg) => {
    const d = parseDate(msg.created_at);
    const key = d ? d.toDateString() : 'Unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(msg);
    return groups;
  }, {});

  const dateGroups = Object.entries(groupedMessages);

  const formatDateGroup = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  /* ════════════════ RENDER ════════════════ */
  return (
    <div className="flex h-full overflow-hidden -m-4 lg:-m-6" style={{ height: 'calc(100vh - 4rem)' }}
      onClick={() => setContextMenu(null)}>

      {/* ══════════════════════════════════════
          LEFT PANEL — Conversation List
      ══════════════════════════════════════ */}
      <div className={`flex flex-col bg-white border-r border-slate-100 flex-shrink-0 transition-all
        ${selected ? 'hidden md:flex' : 'flex'} w-full md:w-72 lg:w-80`}>

        {/* Header */}
        <div className="px-4 pt-4 pb-2 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-slate-900 text-[15px]">Inbox</span>
              {totalUnread > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-tight">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* SSE indicator */}
              <div title={sseStatus === 'connected' ? 'Live' : sseStatus === 'error' ? 'Reconnecting…' : 'Connecting…'}
                className={`w-2 h-2 rounded-full flex-shrink-0 ${sseStatus === 'connected' ? 'bg-emerald-400' : sseStatus === 'error' ? 'bg-red-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
              <button onClick={() => loadConvs()}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Refresh">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => setShowNewConv(true)}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="New conversation">
                <Edit3 size={14} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-colors" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Channel filter */}
          <div className="flex gap-1">
            {CHANNEL_FILTERS.map(f => (
              <button key={f} onClick={() => setChannelFilter(f)}
                className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-all
                  ${channelFilter === f ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                {f}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex gap-1">
            {STATUS_FILTERS.map(({ key, label }) => (
              <button key={key} onClick={() => setStatusFilter(key)}
                className={`flex-1 text-[11px] font-medium py-1 rounded-lg transition-all
                  ${statusFilter === key ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw size={22} className="animate-spin text-blue-400" />
              <p className="text-slate-400 text-sm">Loading conversations…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-1">
                <MessageCircle size={24} className="text-slate-300" />
              </div>
              <p className="text-slate-600 font-medium text-sm">No conversations</p>
              <p className="text-slate-400 text-xs">Start a new conversation or wait for incoming messages</p>
            </div>
          ) : (
            filtered.map(conv => {
              const isActive = selected?.id === conv.id;
              const hasUnread = conv.unread_count > 0;
              const cs = channelStyle(conv.channel_type);
              return (
                <button key={conv.id} onClick={() => selectConv(conv)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors relative
                    ${isActive ? 'bg-blue-50' : ''}`}>
                  {/* Active indicator */}
                  {isActive && <span className="absolute left-0 top-3 bottom-3 w-0.5 bg-blue-600 rounded-r-full" />}

                  <div className="relative flex-shrink-0">
                    <Avatar name={conv.contact_name || conv.contact_phone || '?'} size={44} />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center ${cs.bg} border-2 border-white`}>
                      <ChannelIcon type={conv.channel_type} size={10} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className={`text-[13px] truncate ${hasUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                        {conv.contact_name || conv.contact_phone || 'Unknown'}
                      </span>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">{fmtTime(conv.last_message_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs truncate flex-1 leading-relaxed ${hasUnread ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                        {conv.last_message || <span className="italic text-slate-300">No messages yet</span>}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {conv.assigned_to && (
                          <span className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center" title={`Assigned: ${conv.assigned_to}`}>
                            <User size={8} className="text-indigo-500" />
                          </span>
                        )}
                        {conv.status === 'pending' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending</span>
                        )}
                        {conv.status === 'resolved' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Done</span>
                        )}
                        {hasUnread ? (
                          <span className="bg-blue-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                            {conv.unread_count > 99 ? '99+' : conv.unread_count}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {conv.channel_name && (
                      <p className="text-[10px] text-slate-300 mt-0.5 truncate">{conv.channel_name}</p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          CENTER PANEL — Chat Area
      ══════════════════════════════════════ */}
      <div className={`flex-1 flex flex-col min-w-0 bg-slate-50 ${!selected ? 'hidden md:flex' : 'flex'}`}>
        {!selected ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="w-24 h-24 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center">
              <MessageCircle size={40} className="text-slate-200" />
            </div>
            <div>
              <p className="text-slate-700 font-bold text-xl mb-2">Welcome to Inbox</p>
              <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                Select a conversation from the left panel to start messaging, or create a new conversation.
              </p>
            </div>
            <button onClick={() => setShowNewConv(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
              <Plus size={16} /> New Conversation
            </button>
          </div>
        ) : (
          <>
            {/* ─── Chat Header ─── */}
            <div className="bg-white border-b border-slate-100 px-4 h-[60px] flex items-center gap-3 flex-shrink-0 shadow-sm">
              <button onClick={() => setSelected(null)} className="md:hidden p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg flex-shrink-0">
                <ArrowLeft size={18} />
              </button>

              <div className="relative flex-shrink-0">
                <Avatar name={selected.contact_name || selected.contact_phone || '?'} size={36} />
                <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white ${channelStyle(selected.channel_type).bg}`}>
                  <ChannelIcon type={selected.channel_type} size={8} />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-900 text-sm truncate">
                    {selected.contact_name || selected.contact_phone || 'Unknown'}
                  </p>
                  <ChannelBadge type={selected.channel_type} />
                </div>
                <p className="text-xs text-slate-400 truncate">
                  {selected.channel_name && <span>{selected.channel_name} · </span>}
                  {selected.contact_phone}
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Status dropdown */}
                <StatusDropdown status={selected.status} onChange={updateStatus} />

                <button onClick={() => setShowInfo(v => !v)}
                  className={`p-1.5 rounded-lg transition-colors ${showInfo ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
                  title="Contact info">
                  <Info size={17} />
                </button>

                <HeaderMenu
                  onDelete={() => deleteConversation(selected.id)}
                  onMarkResolved={() => updateStatus('resolved')} />
              </div>
            </div>

            {/* ─── Messages Area ─── */}
            <div className="flex-1 overflow-y-auto px-4 py-4" style={{ backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)', backgroundSize: '20px 20px', backgroundPosition: '0 0' }}>
              {msgLoading ? (
                <div className="flex items-center justify-center h-full gap-2">
                  <RefreshCw size={20} className="animate-spin text-blue-400" />
                  <span className="text-slate-400 text-sm">Loading messages…</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center">
                    <MessageCircle size={24} className="text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-medium text-sm">No messages yet</p>
                  <p className="text-slate-400 text-xs">Send a message to start the conversation</p>
                </div>
              ) : (
                <>
                  {dateGroups.map(([dateKey, msgs]) => (
                    <div key={dateKey}>
                      {/* Date divider */}
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-slate-200/60" />
                        <span className="text-[11px] font-semibold text-slate-400 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-200/60 flex-shrink-0 shadow-sm">
                          {formatDateGroup(dateKey)}
                        </span>
                        <div className="flex-1 h-px bg-slate-200/60" />
                      </div>

                      {/* Messages in group */}
                      <div className="space-y-1">
                        {msgs.map((msg, i) => {
                          const isOut = isOutbound(msg);
                          const prev = msgs[i - 1];
                          const next = msgs[i + 1];
                          const isSameGroup = prev && isOutbound(prev) === isOut;
                          const isLastInGroup = !next || isOutbound(next) !== isOut;
                          const isOptimistic = String(msg.id).startsWith('opt-');

                          return (
                            <div key={msg.id || i}
                              className={`flex ${isOut ? 'justify-end' : 'justify-start'} ${isSameGroup ? 'mt-0.5' : 'mt-3'}`}>

                              {/* Inbound avatar */}
                              {!isOut && (
                                <div className="w-8 flex-shrink-0 flex items-end mb-1 mr-1.5">
                                  {isLastInGroup && (
                                    <Avatar name={selected.contact_name || selected.contact_phone || '?'} size={26} />
                                  )}
                                </div>
                              )}

                              <div className={`max-w-[68%] flex flex-col ${isOut ? 'items-end' : 'items-start'}`}>
                                {/* Media */}
                                {msg.media_url && (
                                  <div className={`rounded-2xl overflow-hidden mb-1 max-w-xs ${isOut ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
                                    {msg.type === 'image' ? (
                                      <img src={msg.media_url} alt={msg.caption || 'image'} className="max-w-full block" />
                                    ) : (
                                      <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-2 text-sm text-slate-600 shadow-sm">
                                        <Paperclip size={14} className="text-slate-400" /> Attachment
                                        <a href={msg.media_url} target="_blank" rel="noreferrer" className="text-blue-500"><ExternalLink size={12} /></a>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Bubble */}
                                {msg.content && (
                                  <div
                                    onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, msg }); }}
                                    className={`px-4 py-2.5 text-[13.5px] leading-relaxed shadow-sm cursor-pointer select-text
                                      ${isOut
                                        ? `bg-blue-600 text-white ${isLastInGroup ? 'rounded-2xl rounded-br-md' : 'rounded-2xl'}`
                                        : `bg-white text-slate-800 border border-slate-100 ${isLastInGroup ? 'rounded-2xl rounded-bl-md' : 'rounded-2xl'}`}
                                      ${isOptimistic ? 'opacity-70' : ''}`}>
                                    {msg.content}
                                  </div>
                                )}

                                {/* Time + status */}
                                {isLastInGroup && (
                                  <div className={`flex items-center gap-1 mt-1 ${isOut ? 'flex-row-reverse' : ''}`}>
                                    <span className="text-[10px] text-slate-400">{fmtMsgTime(msg.created_at)}</span>
                                    {isOut && <MsgStatus status={msg.status} isOut={isOut} />}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} className="h-2" />
                </>
              )}
            </div>

            {/* ─── Input Area ─── */}
            <div className="bg-white border-t border-slate-100 px-3 pt-2 pb-3 flex-shrink-0">
              {/* Quick replies panel */}
              {showQR && quickReplies.length > 0 && (
                <div className="mb-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><Zap size={11} /> Quick Replies</span>
                    <button onClick={() => setShowQR(false)} className="text-slate-400 hover:text-slate-600"><X size={13} /></button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {quickReplies.map(qr => (
                      <button key={qr.id}
                        onClick={() => { setText(qr.body); setShowQR(false); inputRef.current?.focus(); }}
                        className="text-xs bg-white border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all font-medium shadow-sm">
                        {qr.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="flex items-center gap-0.5">
                  <button onClick={() => setShowQR(v => !v)}
                    className={`p-2 rounded-xl transition-colors ${showQR ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:bg-slate-100'}`}
                    title="Quick Replies">
                    <Zap size={17} />
                  </button>
                  <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors" title="Attach file">
                    <Paperclip size={17} />
                  </button>
                </div>

                <div className="flex-1">
                  <textarea
                    ref={el => { textareaRef.current = el; inputRef.current = el; }}
                    value={text}
                    onChange={e => { setText(e.target.value); autoResize(); }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                    rows={1}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white resize-none transition-colors leading-relaxed"
                    style={{ minHeight: '42px', maxHeight: '120px' }}
                  />
                </div>

                <button onClick={send} disabled={!text.trim() || sending}
                  className={`p-2.5 rounded-xl transition-all flex-shrink-0 shadow-sm
                    ${text.trim() && !sending
                      ? 'bg-blue-600 text-white hover:bg-blue-700 scale-100'
                      : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>
                  {sending
                    ? <RefreshCw size={17} className="animate-spin" />
                    : <Send size={17} className={text.trim() ? '' : ''} />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════
          RIGHT PANEL — Contact & Assignment Info
      ══════════════════════════════════════ */}
      {selected && showInfo && (
        <div className="w-72 bg-white border-l border-slate-100 flex-shrink-0 hidden lg:flex flex-col overflow-y-auto">

          {/* Header */}
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <span className="text-sm font-bold text-slate-800">Details</span>
            <button onClick={() => setShowInfo(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
              <X size={14} />
            </button>
          </div>

          {/* Contact card */}
          <div className="px-5 py-5 border-b border-slate-100 text-center">
            <div className="flex justify-center mb-3">
              <Avatar name={selected.contact_name || selected.contact_phone || '?'} size={64} />
            </div>
            <p className="font-bold text-slate-900 text-base mb-0.5">{selected.contact_name || 'Unknown'}</p>
            {selected.contact_phone && (
              <p className="text-sm text-slate-400 flex items-center justify-center gap-1 mb-3">
                <Phone size={11} /> {selected.contact_phone}
              </p>
            )}
            <div className="flex justify-center gap-2 flex-wrap">
              <ChannelBadge type={selected.channel_type} />
              <StatusBadge status={selected.status} />
            </div>
          </div>

          {/* Quick actions */}
          <div className="px-4 py-3 border-b border-slate-100 grid grid-cols-2 gap-2">
            <RouterLink to={`/leads?search=${encodeURIComponent(selected.contact_phone || selected.contact_name || '')}`}
              className="flex flex-col items-center gap-1.5 p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors group">
              <ExternalLink size={15} className="text-blue-600 group-hover:scale-110 transition-transform" />
              <span className="text-xs text-blue-700 font-semibold">View Lead</span>
            </RouterLink>
            <RouterLink to="/leads"
              className="flex flex-col items-center gap-1.5 p-3 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors group">
              <UserPlus size={15} className="text-emerald-600 group-hover:scale-110 transition-transform" />
              <span className="text-xs text-emerald-700 font-semibold">Add Lead</span>
            </RouterLink>
          </div>

          {/* Info sections */}
          <div className="px-4 py-4 space-y-5 flex-1">

            {/* Assign to Consultant */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                <User size={10} /> Assign to Consultant
              </p>
              <AssignSection convId={selected.id} current={selected.assigned_to}
                onAssigned={(name) => {
                  setSelected(s => ({ ...s, assigned_to: name }));
                  setConvs(prev => prev.map(c => c.id === selected.id ? { ...c, assigned_to: name } : c));
                }} />
            </div>

            {/* Conversation details */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Conversation</p>
              <div className="space-y-2.5">
                <DetailRow label="Status">
                  <StatusBadge status={selected.status} />
                </DetailRow>
                <DetailRow label="Channel">{selected.channel_name || '—'}</DetailRow>
                <DetailRow label="Started">{fmtTime(selected.created_at)}</DetailRow>
                <DetailRow label="Last message">{fmtTime(selected.last_message_at)}</DetailRow>
              </div>
            </div>

            {/* Update status */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Change Status</p>
              <div className="grid grid-cols-3 gap-1.5">
                {['open', 'pending', 'resolved'].map(s => {
                  const cfg = statusConfig[s];
                  const isActive = selected.status === s;
                  return (
                    <button key={s} onClick={() => updateStatus(s)}
                      className={`py-2 rounded-xl text-[11px] font-semibold transition-all border
                        ${isActive
                          ? `${cfg.bg} ${cfg.color} ${cfg.border} shadow-sm`
                          : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Context menu ─── */}
      {contextMenu && (
        <div className="fixed z-50 bg-white rounded-xl shadow-xl border border-slate-100 py-1 min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button onClick={() => { navigator.clipboard?.writeText(contextMenu.msg.content); setContextMenu(null); }}
            className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <CheckCheck size={14} className="text-slate-400" /> Copy
          </button>
          <button onClick={() => { setText(contextMenu.msg.content); setContextMenu(null); inputRef.current?.focus(); }}
            className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <Forward size={14} className="text-slate-400" /> Quote
          </button>
          <div className="h-px bg-slate-100 my-1" />
          <button onClick={() => deleteMessage(contextMenu.msg.id)}
            className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}

      {/* ─── New Conversation Modal ─── */}
      {showNewConv && (
        <NewConvModal channels={channels}
          onClose={() => setShowNewConv(false)}
          onCreated={(conv) => { setShowNewConv(false); loadConvs(true); setSelected(conv); }} />
      )}
    </div>
  );
}

/* ── Status Dropdown ── */
function StatusDropdown({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const cfg = statusConfig[status] || statusConfig.open;
  const Icon = cfg.icon;
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${cfg.bg} ${cfg.color} ${cfg.border}`}>
        <Icon size={11} /> {cfg.label} <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl z-30 min-w-[130px] py-1">
          {['open', 'pending', 'resolved'].map(s => {
            const c = statusConfig[s];
            const I = c.icon;
            return (
              <button key={s} onClick={() => { onChange(s); setOpen(false); }}
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors
                  ${status === s ? `${c.color} font-bold` : 'text-slate-600'}`}>
                <I size={11} className={c.color} /> {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Header "more options" Menu ── */
function HeaderMenu({ onDelete, onMarkResolved }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className={`p-1.5 rounded-lg transition-colors ${open ? 'bg-slate-100 text-slate-600' : 'text-slate-400 hover:bg-slate-100'}`}
        title="More options">
        <MoreVertical size={17} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => { setOpen(false); setConfirm(false); }} />
          <div className="absolute right-0 top-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl z-30 min-w-[180px] py-1">
            <button onClick={() => { onMarkResolved(); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <CheckCircle2 size={15} className="text-slate-400" /> Mark as Resolved
            </button>
            <div className="h-px bg-slate-100 my-1" />
            {!confirm ? (
              <button onClick={() => setConfirm(true)}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
                <Trash2 size={15} /> Delete Conversation
              </button>
            ) : (
              <div className="px-3 py-2">
                <p className="text-xs text-slate-500 mb-2 px-1">Delete this conversation and all its messages?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirm(false)}
                    className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button onClick={() => { onDelete(); setOpen(false); setConfirm(false); }}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium">Delete</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Status Badge ── */
function StatusBadge({ status }) {
  const cfg = statusConfig[status] || statusConfig.open;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      <Icon size={9} /> {cfg.label}
    </span>
  );
}

/* ── Detail Row ── */
function DetailRow({ label, children }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-xs text-slate-400 flex-shrink-0">{label}</span>
      <span className="text-xs text-slate-700 font-medium text-right">{children || '—'}</span>
    </div>
  );
}

/* ── Assign Section ── */
function AssignSection({ convId, current, onAssigned }) {
  const [employees, setEmployees] = useState([]);
  const [val, setVal] = useState(current || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.employees().then(setEmployees).catch(() => {});
  }, []);

  useEffect(() => { setVal(current || ''); }, [current]);

  const assign = async (newVal) => {
    setVal(newVal);
    setSaving(true);
    try {
      await api.updateConversation(convId, { assigned_to: newVal });
      onAssigned?.(newVal);
    } catch {}
    setSaving(false);
  };

  const assigned = employees.find(e => e.name === val);

  return (
    <div className="space-y-2">
      {val && assigned ? (
        <div className="flex items-center gap-2.5 p-2.5 bg-indigo-50 rounded-xl border border-indigo-100">
          <Avatar name={assigned.name} size={30} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">{assigned.name}</p>
            <p className="text-[10px] text-slate-400 truncate">{assigned.position || assigned.department || 'Consultant'}</p>
          </div>
          <button onClick={() => assign('')} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-white">
            <X size={13} />
          </button>
        </div>
      ) : (
        <div className={`flex items-center gap-2 p-2.5 rounded-xl border border-dashed border-slate-200 ${saving ? 'opacity-60' : ''}`}>
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            <User size={13} className="text-slate-400" />
          </div>
          <span className="text-xs text-slate-400 italic flex-1">Unassigned</span>
        </div>
      )}
      <select value={val} onChange={e => assign(e.target.value)} disabled={saving}
        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-700 bg-white cursor-pointer">
        <option value="">— Assign to consultant —</option>
        {employees.map(e => (
          <option key={e.id} value={e.name}>{e.name}{e.position ? ` · ${e.position}` : ''}</option>
        ))}
      </select>
      {saving && <p className="text-[10px] text-blue-500 flex items-center gap-1"><RefreshCw size={9} className="animate-spin" /> Saving…</p>}
    </div>
  );
}

/* ── New Conversation Modal ── */
function NewConvModal({ channels, onClose, onCreated }) {
  const [channelId, setChannelId] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    if (!channelId || !phone.trim()) { setError('Channel and phone number are required'); return; }
    setSaving(true);
    setError('');
    try {
      const conv = await api.createConversation({ channel_id: channelId, phone: phone.trim(), name: name.trim() });
      onCreated(conv);
    } catch (e) {
      setError(e.message || 'Failed to create conversation');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900">New Conversation</h3>
            <p className="text-xs text-slate-400 mt-0.5">Start a new chat with a contact</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-xs text-red-600 flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1.5">Channel *</label>
            <select value={channelId} onChange={e => setChannelId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
              <option value="">Select a channel…</option>
              {channels.filter(c => c.active).map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1.5">Phone Number *</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+8801XXXXXXXXX"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <p className="text-[10px] text-slate-400 mt-1">Include country code, e.g. +8801XXXXXXXXX</p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1.5">Contact Name <span className="font-normal text-slate-400">(optional)</span></label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Full name"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
          <button onClick={onClose}
            className="px-4 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-white transition-colors">
            Cancel
          </button>
          <button onClick={create} disabled={saving || !channelId || !phone.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <MessageCircle size={14} />}
            Start Conversation
          </button>
        </div>
      </div>
    </div>
  );
}
