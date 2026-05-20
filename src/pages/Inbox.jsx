import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import {
  Search, Send, X, MoreVertical, User,
  RefreshCw, MessageCircle, Check, CheckCheck,
  Paperclip, Plus, Clock, Link,
  ArrowLeft, ChevronDown, Zap, Edit3,
  ExternalLink, UserPlus
} from 'lucide-react';

const InstagramIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>
);
import { Link as RouterLink } from 'react-router-dom';

/* ─── helpers ─── */
const fmtTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const fmtFull = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const WhatsAppIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const ChannelIcon = ({ type, size = 14 }) => {
  if (type === 'whatsapp') return <WhatsAppIcon size={size} />;
  if (type === 'instagram') return <InstagramIcon size={size} />;
  return <MessageCircle size={size} />;
};

const channelColor = (type) => {
  if (type === 'whatsapp') return 'text-green-600 bg-green-100';
  if (type === 'instagram') return 'text-pink-600 bg-pink-100';
  return 'text-blue-600 bg-blue-100';
};

const statusColor = (s) => {
  if (s === 'open') return 'bg-blue-100 text-blue-700';
  if (s === 'pending') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-500';
};

const FILTERS = ['All', 'WhatsApp', 'Messenger', 'Instagram'];
const STATUS_FILTERS = ['all', 'open', 'pending', 'resolved'];

function Avatar({ name = '?', size = 38 }) {
  const colors = ['bg-blue-400', 'bg-purple-400', 'bg-green-400', 'bg-pink-400', 'bg-amber-400', 'bg-indigo-400'];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div style={{ width: size, height: size, minWidth: size }}
      className={`${colors[idx]} rounded-full flex items-center justify-center text-white font-bold`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/* ── tick icons for message status ── */
const MsgStatus = ({ status }) => {
  if (status === 'read') return <CheckCheck size={12} className="text-blue-400" />;
  if (status === 'delivered') return <CheckCheck size={12} className="text-slate-400" />;
  if (status === 'sent') return <Check size={12} className="text-slate-400" />;
  return <Clock size={12} className="text-slate-300" />;
};

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
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const esRef = useRef(null);

  /* load initial data */
  const loadConvs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (channelFilter !== 'All') params.type = channelFilter.toLowerCase();
      if (statusFilter !== 'all') params.status = statusFilter;
      const data = await api.conversations(params);
      setConvs(data);
    } catch {}
    setLoading(false);
  }, [channelFilter, statusFilter]);

  useEffect(() => { loadConvs(); }, [loadConvs]);

  useEffect(() => {
    api.channels().then(setChannels).catch(() => {});
    api.quickReplies().then(setQuickReplies).catch(() => {});
  }, []);

  /* SSE */
  useEffect(() => {
    const es = new EventSource('/api/events');
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'new_message') {
          setConvs(prev => {
            const exists = prev.find(c => c.id === data.conversation_id);
            if (exists) {
              return prev.map(c => c.id === data.conversation_id
                ? { ...c, last_message: data.content, last_message_at: data.created_at, unread_count: (c.unread_count || 0) + (data.direction === 'inbound' ? 1 : 0) }
                : c
              ).sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
            }
            loadConvs();
            return prev;
          });
          if (selected?.id === data.conversation_id) {
            setMessages(prev => {
              if (prev.find(m => m.id === data.id)) return prev;
              return [...prev, data];
            });
          }
        }
      } catch {}
    };
    return () => es.close();
  }, [selected?.id, loadConvs]);

  /* load messages when conversation selected */
  useEffect(() => {
    if (!selected) return;
    setMsgLoading(true);
    api.messages(selected.id).then(data => {
      setMessages(data);
      setMsgLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }).catch(() => setMsgLoading(false));
    // mark as read
    setConvs(prev => prev.map(c => c.id === selected.id ? { ...c, unread_count: 0 } : c));
  }, [selected?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const selectConv = (conv) => {
    setSelected(conv);
    if (window.innerWidth < 768) setShowInfo(false);
  };

  const send = async () => {
    if (!text.trim() || !selected || sending) return;
    const msg = text.trim();
    setText('');
    setSending(true);
    try {
      const sent = await api.sendMessage(selected.id, { text: msg });
      setMessages(prev => [...prev, sent]);
      setConvs(prev => prev.map(c => c.id === selected.id ? { ...c, last_message: msg, last_message_at: new Date().toISOString() } : c));
    } catch (e) {
      setText(msg);
      alert('Failed to send: ' + e.message);
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

  const filtered = convs.filter(c => {
    if (search && !c.contact_name?.toLowerCase().includes(search.toLowerCase()) &&
        !c.contact_phone?.includes(search) && !c.last_message?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalUnread = convs.reduce((s, c) => s + (c.unread_count || 0), 0);

  return (
    <div className="flex h-full -m-4 lg:-m-6 rounded-none overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>

      {/* ── LEFT: Conversation List ── */}
      <div className={`flex flex-col bg-white border-r border-slate-100 flex-shrink-0
        ${selected ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96`}>

        {/* Header */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-800 text-base">Inbox</h2>
              {totalUnread > 0 && (
                <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <button onClick={loadConvs} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <RefreshCw size={15} />
              </button>
              <button onClick={() => setShowNewConv(true)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                <Edit3 size={15} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"><X size={14}/></button>}
          </div>

          {/* Channel filter tabs */}
          <div className="flex gap-1 mb-2">
            {FILTERS.map(f => (
              <button key={f} onClick={() => setChannelFilter(f)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors
                  ${channelFilter === f ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                {f}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex gap-1">
            {STATUS_FILTERS.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`capitalize text-xs px-2.5 py-1 rounded-lg font-medium transition-colors
                  ${statusFilter === s ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw size={20} className="animate-spin text-blue-400 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Loading…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <MessageCircle size={32} className="text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No conversations</p>
            </div>
          ) : filtered.map(conv => (
            <button key={conv.id} onClick={() => selectConv(conv)}
              className={`w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-slate-50 hover:bg-slate-50 transition-colors
                ${selected?.id === conv.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
              <div className="relative flex-shrink-0">
                <Avatar name={conv.contact_name || conv.contact_phone || '?'} size={42} />
                <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center ${channelColor(conv.channel_type)}`}>
                  <ChannelIcon type={conv.channel_type} size={11} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-sm font-semibold truncate ${conv.unread_count > 0 ? 'text-slate-900' : 'text-slate-700'}`}>
                    {conv.contact_name || conv.contact_phone || 'Unknown'}
                  </span>
                  <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">{fmtTime(conv.last_message_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className={`text-xs truncate flex-1 ${conv.unread_count > 0 ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                    {conv.last_message || 'No messages yet'}
                  </p>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {conv.status !== 'open' && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${statusColor(conv.status)}`}>{conv.status}</span>
                    )}
                    {conv.unread_count > 0 && (
                      <span className="bg-blue-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
                {conv.channel_name && (
                  <p className="text-[10px] text-slate-300 mt-0.5 truncate">{conv.channel_name}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── CENTER: Chat View ── */}
      <div className={`flex-1 flex flex-col min-w-0 ${!selected ? 'hidden md:flex' : 'flex'}`}>
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center mb-4">
              <MessageCircle size={36} className="text-slate-300" />
            </div>
            <p className="text-slate-700 font-semibold text-lg mb-1">Select a conversation</p>
            <p className="text-slate-400 text-sm">Choose from WhatsApp, Messenger, or Instagram</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="h-14 bg-white border-b border-slate-100 flex items-center gap-3 px-4 shadow-sm flex-shrink-0">
              <button onClick={() => setSelected(null)} className="md:hidden p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><ArrowLeft size={18}/></button>
              <div className="relative flex-shrink-0">
                <Avatar name={selected.contact_name || selected.contact_phone || '?'} size={34} />
                <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ${channelColor(selected.channel_type)}`}>
                  <ChannelIcon type={selected.channel_type} size={9} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">
                  {selected.contact_name || selected.contact_phone || 'Unknown'}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {selected.channel_name} · {selected.contact_phone}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {/* Status toggle */}
                <div className="relative group">
                  <button className={`text-xs px-2.5 py-1 rounded-lg font-medium capitalize flex items-center gap-1 ${statusColor(selected.status)}`}>
                    {selected.status} <ChevronDown size={11}/>
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-100 rounded-xl shadow-lg z-20 hidden group-hover:block min-w-[120px]">
                    {['open', 'pending', 'resolved'].map(s => (
                      <button key={s} onClick={() => updateStatus(s)}
                        className="block w-full text-left text-xs px-3 py-2 hover:bg-slate-50 capitalize first:rounded-t-xl last:rounded-b-xl">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => setShowInfo(v => !v)} className={`p-1.5 rounded-lg transition-colors ${showInfo ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}>
                  <User size={16}/>
                </button>
                <button className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                  <MoreVertical size={16}/>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-slate-50">
              {msgLoading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw size={24} className="animate-spin text-blue-300" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageCircle size={28} className="text-slate-200 mb-2" />
                  <p className="text-slate-400 text-sm">No messages yet</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => {
                    const isOut = msg.direction === 'outbound';
                    const showDate = i === 0 || new Date(messages[i-1].created_at).toDateString() !== new Date(msg.created_at).toDateString();
                    return (
                      <div key={msg.id || i}>
                        {showDate && (
                          <div className="flex items-center justify-center my-3">
                            <span className="text-[11px] text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                              {new Date(msg.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-0.5`}>
                          <div className={`max-w-[72%] ${isOut ? 'items-end' : 'items-start'} flex flex-col`}>
                            {/* Media */}
                            {msg.media_url && (
                              <div className={`rounded-2xl overflow-hidden mb-1 max-w-xs ${isOut ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
                                {msg.type === 'image' ? (
                                  <img src={msg.media_url} alt={msg.caption || 'image'} className="max-w-full" />
                                ) : (
                                  <div className="bg-slate-200 rounded-xl p-3 flex items-center gap-2 text-sm text-slate-600">
                                    <Paperclip size={14}/> Attachment
                                    <a href={msg.media_url} target="_blank" rel="noreferrer" className="text-blue-500 ml-1"><ExternalLink size={12}/></a>
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Bubble */}
                            {msg.content && (
                              <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm
                                ${isOut
                                  ? 'bg-blue-600 text-white rounded-br-sm'
                                  : 'bg-white text-slate-800 border border-slate-100 rounded-bl-sm'}`}>
                                {msg.content}
                              </div>
                            )}
                            {msg.caption && <p className={`text-xs mt-0.5 ${isOut ? 'text-blue-200' : 'text-slate-400'}`}>{msg.caption}</p>}
                            <div className={`flex items-center gap-1 mt-0.5 ${isOut ? 'flex-row-reverse' : ''}`}>
                              <span className="text-[10px] text-slate-400">{fmtTime(msg.created_at)}</span>
                              {isOut && <MsgStatus status={msg.status} />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Input area */}
            <div className="bg-white border-t border-slate-100 p-3 flex-shrink-0">
              {/* Quick replies */}
              {showQR && (
                <div className="mb-2 flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="w-full text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1"><Zap size={11}/> Quick Replies</p>
                  {quickReplies.map(qr => (
                    <button key={qr.id} onClick={() => { setText(qr.body); setShowQR(false); inputRef.current?.focus(); }}
                      className="text-xs bg-white border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors font-medium shadow-sm">
                      {qr.title}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <button onClick={() => setShowQR(v => !v)}
                  className={`p-2 rounded-xl transition-colors flex-shrink-0 ${showQR ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:bg-slate-100'}`}
                  title="Quick Replies">
                  <Zap size={18}/>
                </button>
                <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0" title="Attach">
                  <Paperclip size={18}/>
                </button>
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Type a message…"
                    rows={1}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none max-h-28"
                    style={{ lineHeight: '1.5' }}
                  />
                </div>
                <button onClick={send} disabled={!text.trim() || sending}
                  className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 shadow-sm">
                  {sending ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18}/>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT: Contact Info Panel ── */}
      {selected && showInfo && (
        <div className="w-72 bg-white border-l border-slate-100 flex-shrink-0 overflow-y-auto hidden lg:flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Contact Info</p>
            <button onClick={() => setShowInfo(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={14}/></button>
          </div>

          {/* Contact avatar + name */}
          <div className="p-5 text-center border-b border-slate-50">
            <Avatar name={selected.contact_name || selected.contact_phone || '?'} size={60} />
            <p className="font-bold text-slate-800 mt-3 mb-0.5">{selected.contact_name || 'Unknown'}</p>
            <p className="text-sm text-slate-400">{selected.contact_phone || ''}</p>
            <div className="flex justify-center gap-2 mt-3">
              <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${channelColor(selected.channel_type)}`}>
                <ChannelIcon type={selected.channel_type} size={11} />
                {selected.channel_type}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusColor(selected.status)}`}>
                {selected.status}
              </span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="p-4 border-b border-slate-50 grid grid-cols-2 gap-2">
            <RouterLink to={`/leads?search=${encodeURIComponent(selected.contact_phone || selected.contact_name || '')}`}
              className="flex flex-col items-center gap-1.5 p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
              <Link size={16} className="text-blue-600"/>
              <span className="text-xs text-blue-700 font-medium">View Lead</span>
            </RouterLink>
            <RouterLink to="/leads"
              className="flex flex-col items-center gap-1.5 p-3 bg-green-50 rounded-xl hover:bg-green-100 transition-colors">
              <UserPlus size={16} className="text-green-600"/>
              <span className="text-xs text-green-700 font-medium">Add Lead</span>
            </RouterLink>
          </div>

          {/* Details */}
          <div className="p-4 space-y-3">
            <Section title="Channel">
              <InfoItem label="Name" value={selected.channel_name} />
              <InfoItem label="Type" value={selected.channel_type} capitalize />
            </Section>

            <Section title="Conversation">
              <InfoItem label="Status" value={selected.status} capitalize />
              <InfoItem label="Started" value={fmtFull(selected.created_at)} />
              <InfoItem label="Last message" value={fmtFull(selected.last_message_at)} />
            </Section>

            {/* Assign */}
            <Section title="Assign To">
              <AssignDropdown convId={selected.id} current={selected.assigned_to} />
            </Section>
          </div>
        </div>
      )}

      {/* New Conversation Modal */}
      {showNewConv && (
        <NewConvModal channels={channels} onClose={() => setShowNewConv(false)}
          onCreated={(conv) => { setShowNewConv(false); loadConvs(); setSelected(conv); }} />
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function InfoItem({ label, value, capitalize }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-xs text-slate-400 flex-shrink-0">{label}</span>
      <span className={`text-xs text-slate-700 font-medium text-right ${capitalize ? 'capitalize' : ''}`}>{value || '—'}</span>
    </div>
  );
}

function AssignDropdown({ convId, current }) {
  const [employees, setEmployees] = useState([]);
  const [val, setVal] = useState(current || '');
  useEffect(() => { api.employees().then(setEmployees).catch(() => {}); }, []);
  const assign = async (e) => {
    setVal(e.target.value);
    try { await api.updateConversation(convId, { assigned_to: e.target.value }); } catch {}
  };
  return (
    <select value={val} onChange={assign}
      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-700">
      <option value="">Unassigned</option>
      {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
    </select>
  );
}

function NewConvModal({ channels, onClose, onCreated }) {
  const [channelId, setChannelId] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!channelId || !phone.trim()) return;
    setSaving(true);
    try {
      const conv = await api.createConversation({ channel_id: channelId, phone: phone.trim(), name: name.trim() });
      onCreated(conv);
    } catch (e) {
      alert(e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">New Conversation</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={16}/></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Channel *</label>
            <select value={channelId} onChange={e => setChannelId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">Select channel…</option>
              {channels.filter(c => c.active).map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Phone Number *</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+8801XXXXXXXXX"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Name (optional)</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Contact name"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
          <button onClick={create} disabled={saving || !channelId || !phone.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-60">
            {saving ? <RefreshCw size={14} className="animate-spin"/> : <Plus size={14}/>}
            Start Conversation
          </button>
        </div>
      </div>
    </div>
  );
}
