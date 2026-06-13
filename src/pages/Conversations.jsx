import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import {
  MessageSquare, Search, Send, User, Phone, Mail, ExternalLink,
  Check, CheckCheck, AlertCircle, Sparkles, Archive, CheckCircle, RefreshCw, Trash2,
  Paperclip, Smile, FileText, X, Lock, ChevronRight, Info, Hash, Calendar, Inbox
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

const getMediaUrl = (msg) => {
  if (!msg.media_url) return '';
  if (msg.media_url.startsWith('http') || msg.media_url.startsWith('/uploads')) {
    return msg.media_url;
  }
  return `/api/media/${msg.id}?v=2`;
};

export default function Conversations({ user }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'open' | 'archived' | 'all'
  const [channelFilter, setChannelFilter] = useState('all');
  const [selectedChannelId, setSelectedChannelId] = useState('all');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread' | 'open' | 'archived'

  // Media upload and lightbox state
  const [lightboxImage, setLightboxImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null); // { name, type, mediaUrl, relativeUrl, previewUrl }
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Compose message state
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // Contact info panel
  const [showContactPanel, setShowContactPanel] = useState(false);

  // Convert to lead modal states
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadSearchResults, setLeadSearchResults] = useState([]);
  const [selectedExistingLead, setSelectedExistingLead] = useState(null);
  const [convertingLead, setConvertingLead] = useState(false);
  const [leadTab, setLeadTab] = useState('new'); // 'new' | 'link'
  
  const [searchParams, setSearchParams] = useSearchParams();
  
  const toast = useToast();
  const confirm = useConfirm();
  const messagesEndRef = useRef(null);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const p = {
        status: statusFilter,
        search: search.trim() || undefined,
        limit: 100
      };
      if (channelFilter !== 'all') {
        p.channel_type = channelFilter;
      }
      if (selectedChannelId !== 'all') {
        p.channel_id = selectedChannelId;
      }
      const res = await api.conversations(p);
      setConversations(res.conversations || []);
    } catch (err) {
      toast.error('Could not load conversations: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, channelFilter, selectedChannelId, search, toast]);

  // Load message thread
  const loadMessages = useCallback(async (conv) => {
    if (!conv) return;
    setLoadingMessages(true);
    try {
      const res = await api.messages(conv.id);
      setMessages(res || []);
      // Mark as read/clear unread count locally and on server unconditionally
      await api.markConversationAsRead(conv.id);
      setConversations(prev => prev.map(c => c.id === conv.id && c.unread_count !== 0 ? { ...c, unread_count: 0 } : c));
      // Only create a new object if unread_count actually needs clearing —
      // always spreading (even with same values) would produce a new reference
      // and re-trigger this effect, causing an infinite loading loop.
      setSelectedConv(prev => {
        if (!prev || prev.id !== conv.id || prev.unread_count === 0) return prev;
        return { ...prev, unread_count: 0 };
      });
    } catch (err) {
      toast.error('Could not load messages: ' + err.message);
    } finally {
      setLoadingMessages(false);
    }
  }, [toast]);

  // Silent background refresh for conversations list (updates unread counts and last messages)
  const refreshConversationsSilently = useCallback(async () => {
    try {
      const p = {
        status: statusFilter,
        search: search.trim() || undefined,
        limit: 100
      };
      if (channelFilter !== 'all') {
        p.channel_type = channelFilter;
      }
      if (selectedChannelId !== 'all') {
        p.channel_id = selectedChannelId;
      }
      const res = await api.conversations(p);
      if (res && res.conversations) {
        setConversations(current => {
          if (JSON.stringify(current) !== JSON.stringify(res.conversations)) {
            return res.conversations;
          }
          return current;
        });
      }
    } catch (err) {
      console.warn('Silent conversations refresh failed:', err);
    }
  }, [statusFilter, channelFilter, selectedChannelId, search]);

  // Silent background refresh for message thread (polls for new incoming messages)
  const refreshMessagesSilently = useCallback(async (conv) => {
    if (!conv) return;
    try {
      const res = await api.messages(conv.id);
      if (res) {
        setMessages(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(res)) {
            return res;
          }
          return prev;
        });
      }
      // Unconditionally mark as read on backend if the user is looking at this conversation
      await api.markConversationAsRead(conv.id);
      setConversations(prev => prev.map(c => c.id === conv.id && c.unread_count !== 0 ? { ...c, unread_count: 0 } : c));
      setSelectedConv(prev => {
        if (!prev || prev.id !== conv.id || prev.unread_count === 0) return prev;
        return { ...prev, unread_count: 0 };
      });
    } catch (err) {
      console.warn('Silent messages refresh failed:', err);
    }
  }, []);

  // Background polling timer (every 10 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      refreshConversationsSilently();
      if (selectedConv) {
        refreshMessagesSilently(selectedConv);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [selectedConv, refreshConversationsSilently, refreshMessagesSilently]);

  // Initial load
  useEffect(() => {
    document.title = "Live Chat Inbox | EduExpress Core";
    api.quickReplies().then(setQuickReplies).catch(() => {});
    api.channels().then(setChannels).catch(() => {});
  }, []);

  // Reload list on filter/search change
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Handle query parameter ?id=... to auto-select or load a conversation
  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam && !loading) {
      const parsedId = parseInt(idParam);
      const found = conversations.find(c => c.id === parsedId);
      if (found) {
        setSelectedConv(found);
        searchParams.delete('id');
        setSearchParams(searchParams, { replace: true });
      } else {
        api.getConversation(parsedId)
          .then(conv => {
            if (conv) {
              setConversations(prev => {
                if (prev.some(c => c.id === conv.id)) return prev;
                return [conv, ...prev];
              });
              setSelectedConv(conv);
            }
            searchParams.delete('id');
            setSearchParams(searchParams, { replace: true });
          })
          .catch(err => {
            console.error('Failed to load conversation from query param:', err);
            toast.error('Could not find conversation: ' + err.message);
            searchParams.delete('id');
            setSearchParams(searchParams, { replace: true });
          });
      }
    }
  }, [loading, conversations, searchParams, setSearchParams, toast]);

  // Load messages when selected conversation changes
  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv);
    } else {
      setMessages([]);
    }
  }, [selectedConv, loadMessages]);

  // Debounced search for existing leads
  useEffect(() => {
    if (leadTab === 'link' && leadSearch.trim().length >= 2) {
      const delay = setTimeout(async () => {
        try {
          const res = await api.leads({ search: leadSearch.trim(), limit: 10 });
          setLeadSearchResults(res.leads || []);
        } catch (err) {
          console.error('Lead search error:', err);
        }
      }, 300);
      return () => clearTimeout(delay);
    } else {
      setLeadSearchResults([]);
    }
  }, [leadSearch, leadTab]);

  // Scroll to bottom of message thread
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // SSE real-time sync listener
  useEffect(() => {
    const es = new EventSource('/api/events');

    es.addEventListener('new_message', (e) => {
      try {
        const data = JSON.parse(e.data);
        // If it belongs to currently selected conversation, append it and mark as read immediately
        if (selectedConv && data.conversation_id === selectedConv.id) {
          setMessages(prev => {
            // Avoid duplicate appends
            if (prev.some(m => m.id === data.id || (data.wa_message_id && m.wa_message_id === data.wa_message_id))) {
              return prev;
            }
            return [...prev, data];
          });
          // Call markConversationAsRead on server immediately
          api.markConversationAsRead(selectedConv.id).catch(err => {
            console.error('Failed to mark incoming active message as read:', err);
          });
          // Ensure selectedConv itself has unread_count = 0
          setSelectedConv(prev => prev ? { ...prev, unread_count: 0 } : null);
        }

        // Update last message in the conversations list
        setConversations(prev => {
          const idx = prev.findIndex(c => c.id === data.conversation_id);
          if (idx === -1) {
            // Fetch single conversation details silently in the background
            api.getConversation(data.conversation_id)
              .then(conv => {
                if (conv) {
                  setConversations(current => {
                    if (current.some(c => c.id === conv.id)) {
                      return current.map(c => c.id === conv.id ? {
                        ...c,
                        last_message: data.content,
                        last_message_at: data.created_at,
                        unread_count: (selectedConv && selectedConv.id === c.id) ? 0 : (c.unread_count + (data.direction === 'in' ? 1 : 0))
                      } : c).sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
                    }
                    return [{
                      ...conv,
                      last_message: data.content,
                      last_message_at: data.created_at,
                      unread_count: (selectedConv && selectedConv.id === conv.id) ? 0 : (data.direction === 'in' ? 1 : 0)
                    }, ...current];
                  });
                }
              })
              .catch(err => {
                console.error('Failed to fetch new conversation detail:', err);
              });
            return prev;
          }
          const updated = [...prev];
          const c = updated[idx];
          updated[idx] = {
            ...c,
            last_message: data.content,
            last_message_at: data.created_at,
            unread_count: (selectedConv && selectedConv.id === c.id) ? 0 : (c.unread_count + (data.direction === 'in' ? 1 : 0))
          };
          // Re-sort list by last_message_at descending
          return updated.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
        });
      } catch (err) {
        console.error('Error handling new_message event:', err);
      }
    });

    es.addEventListener('message_status', (e) => {
      try {
        const data = JSON.parse(e.data);
        // Update message status in current thread
        if (selectedConv) {
          setMessages(prev => prev.map(m => m.wa_message_id === data.wa_message_id ? { ...m, status: data.status } : m));
        }
      } catch (err) {
        console.error('Error handling message_status event:', err);
      }
    });

    es.addEventListener('conversation_deleted', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (selectedConv && selectedConv.id === data.conversation_id) {
          setSelectedConv(null);
          toast.info('The active conversation was deleted.');
        }
        setConversations(prev => prev.filter(c => c.id !== data.conversation_id));
      } catch (err) {
        console.error('Error handling conversation_deleted event:', err);
      }
    });

    es.onerror = (err) => {
      console.error('SSE connection error:', err);
    };

    return () => {
      es.close();
    };
  }, [selectedConv, loadConversations, toast]);

  // Send message
  const handleSend = async (e) => {
    e?.preventDefault();
    if (!replyText.trim() && !selectedFile) return;
    if (!selectedConv) return;
    setSending(true);
    try {
      const sentBy = user?.name || user?.email || 'Admin';
      const payload = {
        content: replyText.trim(),
        sent_by: sentBy,
        type: 'text',
        media_url: null
      };

      if (selectedFile) {
        payload.type = selectedFile.type;
        payload.media_url = selectedFile.mediaUrl;
        if (!payload.content) {
          payload.content = selectedFile.name;
        }
      }

      const res = await api.sendMessage(selectedConv.id, payload);
      if (res?.message?.status === 'failed') {
        toast.error('Failed to send: ' + (res.message.error_msg || 'Unknown Meta API error'));
      } else {
        setReplyText('');
        setSelectedFile(null);
        if (res?.message) {
          // Instantly append to thread messages list to update UI
          setMessages(prev => {
            if (prev.some(m => m.id === res.message.id || (res.message.wa_message_id && m.wa_message_id === res.message.wa_message_id))) {
              return prev;
            }
            return [...prev, res.message];
          });
          // Instantly update conversation last_message in the sidebar
          setConversations(prev => {
            const idx = prev.findIndex(c => c.id === selectedConv.id);
            if (idx === -1) return prev;
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              last_message: res.message.content || (res.message.type === 'image' ? '📷 Image' : '📎 Document'),
              last_message_at: res.message.created_at || new Date().toISOString()
            };
            return updated.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
          });
        }
      }
    } catch (err) {
      toast.error('Failed to send message: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  // Handle file input selection and upload to server
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const dataUrl = event.target.result;
        const base64 = dataUrl.split(',')[1];
        
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            type: file.type,
            data: base64
          })
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        
        setSelectedFile({
          name: file.name,
          type: file.type.startsWith('image/') ? 'image' : 'document',
          mediaUrl: data.url,
          relativeUrl: data.relativeUrl,
          previewUrl: file.type.startsWith('image/') ? dataUrl : null
        });
        toast.success('File ready to attach');
      } catch (err) {
        toast.error('File upload failed: ' + err.message);
        setSelectedFile(null);
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  // Toggle Archive Conversation status
  const handleToggleArchive = async (conv) => {
    const nextStatus = conv.status === 'archived' ? 'open' : 'archived';
    const actionLabel = conv.status === 'archived' ? 'reopen' : 'archive';
    const ok = await confirm({
      title: `${actionLabel.toUpperCase()} conversation?`,
      body: `Are you sure you want to ${actionLabel} the conversation with ${conv.contact_name || 'this contact'}?`,
      confirmLabel: actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)
    });
    if (!ok) return;

    try {
      await api.updateConversation(conv.id, { status: nextStatus });
      toast.success(`Conversation ${nextStatus === 'archived' ? 'archived' : 'opened'}`);
      setSelectedConv(null);
      loadConversations();
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  // Delete Conversation
  const handleDeleteConversation = async (conv) => {
    const ok = await confirm({
      title: 'Delete Conversation?',
      body: `Are you sure you want to permanently delete the conversation with ${conv.contact_name || 'this contact'}? All message history will be lost.`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger'
    });
    if (!ok) return;

    try {
      await api.deleteConversation(conv.id);
      toast.success('Conversation deleted');
      setSelectedConv(null);
      loadConversations();
    } catch (err) {
      toast.error('Failed to delete conversation: ' + err.message);
    }
  };

  // Format date helper
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filteredConversations = conversations.filter(c => {
    if (activeTab === 'unread') return c.unread_count > 0;
    return true;
  });

  // Helper: group messages by date for date separators
  const groupMessagesByDate = (msgs) => {
    const groups = [];
    let lastDate = null;
    msgs.forEach((m, idx) => {
      const d = new Date(m.created_at);
      const dateStr = d.toDateString();
      if (dateStr !== lastDate) {
        const today = new Date();
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        let label;
        if (dateStr === today.toDateString()) label = 'Today';
        else if (dateStr === yesterday.toDateString()) label = 'Yesterday';
        else label = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        groups.push({ type: 'separator', label, key: `sep-${idx}` });
        lastDate = dateStr;
      }
      groups.push({ type: 'message', msg: m, key: m.id || idx });
    });
    return groups;
  };

  const getNameGradient = (name) => {
    if (!name) return 'from-slate-400 to-slate-500';
    const s = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return ['from-blue-400 to-indigo-500','from-purple-400 to-pink-500','from-emerald-400 to-teal-500',
            'from-amber-400 to-orange-500','from-sky-400 to-blue-500','from-rose-400 to-red-500',
            'from-violet-400 to-purple-500'][s % 7];
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <div className="flex h-[calc(100vh-120px)] bg-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xl select-none animate-scale-in">

      {/* ─── LEFT SIDEBAR ─── */}
      <div className="w-72 xl:w-80 flex flex-col bg-white border-r border-slate-100/80 flex-shrink-0">

        {/* Sidebar Header */}
        <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow shadow-blue-500/20 flex-shrink-0">
              <Inbox size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 leading-tight">Inbox</p>
              <p className="text-[10px] text-slate-400 font-medium">
                {totalUnread > 0 ? <span className="text-blue-600 font-bold">{totalUnread} unread</span> : 'All caught up'}
              </p>
            </div>
          </div>
          <button onClick={loadConversations} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={13} />
            <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 transition-all placeholder-slate-400" />
          </div>
        </div>

        {/* Channel filter */}
        {channels.length > 0 && (
          <div className="px-3 pb-2">
            <select value={selectedChannelId} onChange={e => setSelectedChannelId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/15 cursor-pointer">
              <option value="all">All Channels</option>
              {channels.map(c => <option key={c.id} value={c.id}>{c.name} · {c.type}</option>)}
            </select>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="px-3 pb-2 flex gap-1.5">
          {[{id:'all',label:'All'},{id:'unread',label:'Unread'},{id:'open',label:'Active'},{id:'archived',label:'Done'}].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setStatusFilter(tab.id === 'all' || tab.id === 'unread' ? 'all' : tab.id); }}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto bg-white scrollbar-thin">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-400">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-[11px] font-medium">Loading…</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-1 px-4 text-center">
              <MessageSquare size={22} className="text-slate-200 mb-1" />
              <p className="text-xs font-bold text-slate-500">No conversations</p>
              <p className="text-[10px] text-slate-400">Adjust filters or search</p>
            </div>
          ) : filteredConversations.map(conv => {
            const isSel = selectedConv?.id === conv.id;
            const isWA  = conv.channel_type === 'whatsapp';
            const isMG  = conv.channel_type === 'messenger';
            return (
              <button key={conv.id} onClick={() => { setSelectedConv(conv); setShowContactPanel(false); }}
                className={`w-full text-left px-3 py-3 flex gap-3 transition-all outline-none border-l-[3px]
                  ${isSel ? 'bg-blue-50/60 border-l-blue-600' : 'bg-white hover:bg-slate-50/70 border-l-transparent'}`}>
                <div className="relative flex-shrink-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-sm bg-gradient-to-br ${getNameGradient(conv.contact_name)}`}>
                    {String(conv.contact_name || 'C').split(' ').filter(Boolean).map(s => s[0]).slice(0,2).join('').toUpperCase()}
                  </div>
                  <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-md flex items-center justify-center border-[1.5px] border-white text-[8px] font-black text-white shadow-sm
                    ${isWA ? 'bg-[#25d366]' : isMG ? 'bg-[#0084ff]' : 'bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#962fbf]'}`}>
                    {isWA ? 'W' : isMG ? 'F' : 'I'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-1">
                    <p className={`text-xs truncate ${conv.unread_count > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                      {conv.contact_name || conv.contact_phone || 'Contact'}
                    </p>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0">{formatTime(conv.last_message_at)}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {conv.last_message_direction === 'out' && !conv.unread_count && (
                      conv.last_message_status === 'read' ? <CheckCheck size={11} className="text-sky-400 flex-shrink-0" /> :
                      conv.last_message_status === 'failed' ? <AlertCircle size={11} className="text-rose-500 flex-shrink-0" /> :
                      <CheckCheck size={11} className="text-slate-300 flex-shrink-0" />
                    )}
                    <p className={`text-[11px] truncate ${conv.unread_count > 0 ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
                      {conv.last_message || 'No messages yet'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] font-bold uppercase tracking-wide truncate" style={{ color: conv.channel_color || '#3b82f6' }}>
                      {conv.channel_name || conv.channel_type}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center shadow-sm">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── MAIN CHAT PANE ─── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f0f4f8]">
        {selectedConv ? (
          <>
            {/* Chat Header */}
            <div className="h-14 px-4 bg-white flex items-center justify-between border-b border-slate-100 shadow-sm z-10 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0 bg-gradient-to-br ${getNameGradient(selectedConv.contact_name)}`}>
                  {String(selectedConv.contact_name || 'C').split(' ').filter(Boolean).map(s => s[0]).slice(0,2).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-sm truncate">{selectedConv.contact_name || 'Meta Contact'}</h3>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white flex-shrink-0
                      ${selectedConv.channel_type === 'whatsapp' ? 'bg-[#25d366]' : selectedConv.channel_type === 'messenger' ? 'bg-[#0084ff]' : 'bg-gradient-to-r from-[#d62976] to-[#962fbf]'}`}>
                      {selectedConv.channel_type === 'whatsapp' ? 'WhatsApp' : selectedConv.channel_type === 'messenger' ? 'Messenger' : 'Instagram'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1.5 font-medium">
                    {selectedConv.contact_phone && <><Phone size={9} />{selectedConv.contact_phone}</>}
                    {selectedConv.lead_id ? (
                      <>
                        <span className="text-slate-300">·</span>
                        <Link to={`/leads/${selectedConv.lead_id}`} className="text-blue-600 hover:underline inline-flex items-center gap-0.5 font-semibold">
                          Lead #{selectedConv.lead_id} <ExternalLink size={9} />
                        </Link>
                      </>
                    ) : (
                      <>
                        <span className="text-slate-300">·</span>
                        <button onClick={() => { setLeadTab('new'); setShowLeadModal(true); }}
                          className="text-amber-600 hover:text-amber-700 font-semibold cursor-pointer">
                          + Convert to Lead
                        </button>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => setShowContactPanel(p => !p)} title="Contact info"
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${showContactPanel ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}>
                  <Info size={16} />
                </button>
                <button onClick={() => handleToggleArchive(selectedConv)} title={selectedConv.status === 'archived' ? 'Reopen' : 'Archive'}
                  className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer">
                  <Archive size={16} />
                </button>
                <button onClick={() => handleDeleteConversation(selectedConv)} title="Delete"
                  className="p-2 hover:bg-slate-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Messages Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin"
                  style={{ backgroundImage: `radial-gradient(rgba(148,163,184,0.10) 1px,transparent 1px)`, backgroundSize: '18px 18px' }}>
                  {loadingMessages ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-medium">Loading messages…</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full">
                      <div className="bg-white/90 border border-slate-100 rounded-2xl px-8 py-6 text-center shadow-sm max-w-xs">
                        <MessageSquare size={28} className="text-slate-300 mx-auto mb-3" />
                        <p className="font-bold text-slate-700 text-sm">No messages yet</p>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Use the templates below or type a message to start the conversation.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {groupMessagesByDate(messages).map(item => {
                        if (item.type === 'separator') return (
                          <div key={item.key} className="flex items-center gap-3 my-3">
                            <div className="flex-1 h-px bg-slate-200/70" />
                            <span className="text-[10px] font-bold text-slate-400 bg-white/80 border border-slate-200/60 px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                              {item.label}
                            </span>
                            <div className="flex-1 h-px bg-slate-200/70" />
                          </div>
                        );
                        const m = item.msg;
                        const isIn = m.direction === 'in' || m.direction === 'inbound';
                        const timeStr = new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
                        return (
                          <div key={item.key} className={`flex ${isIn ? 'justify-start' : 'justify-end'} mb-1`}>
                            <div className={`max-w-[68%] rounded-2xl px-4 py-2.5 shadow-sm border relative group flex flex-col gap-0.5
                              ${isIn ? 'bg-white text-slate-800 rounded-tl-md border-slate-100/80' : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-md border-transparent'}`}>
                              {!isIn && m.sent_by && (
                                <p className="text-[9px] text-sky-200/80 font-black tracking-wider uppercase mb-0.5">{m.sent_by}</p>
                              )}
                              {m.type === 'image' && m.media_url && (
                                <div className="mb-1 overflow-hidden rounded-xl">
                                  <img src={getMediaUrl(m)} alt="img" className="max-w-full max-h-56 object-cover cursor-pointer rounded-xl hover:opacity-90 transition-opacity" onClick={() => setLightboxImage(getMediaUrl(m))} />
                                  <div className="flex justify-between items-center pt-1.5">
                                    <span className="text-[9px] text-slate-400 font-medium">Image</span>
                                    <a href={getMediaUrl(m)} download={`img_${m.id}.jpg`} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 font-bold underline">Download</a>
                                  </div>
                                </div>
                              )}
                              {m.type === 'document' && m.media_url && (
                                <div className={`mb-1 p-3 rounded-xl flex items-center gap-2.5 border ${isIn ? 'bg-slate-50 border-slate-100' : 'bg-white/10 border-white/10'}`}>
                                  <FileText size={20} className={isIn ? 'text-slate-400' : 'text-sky-200'} />
                                  <div>
                                    <p className="text-xs font-bold truncate max-w-[180px]">{m.content || 'Document'}</p>
                                    <a href={getMediaUrl(m)} download target="_blank" rel="noreferrer" className={`text-[10px] font-bold underline ${isIn ? 'text-blue-600' : 'text-sky-200'}`}>Download</a>
                                  </div>
                                </div>
                              )}
                              {(m.type === 'audio' || m.type === 'voice') && (
                                <audio controls className="h-8 w-full max-w-[200px] mb-1" src={getMediaUrl(m)} />
                              )}
                              {m.type === 'video' && (
                                <video controls className="max-w-full max-h-56 rounded-xl mb-1" src={getMediaUrl(m)} />
                              )}
                              {(m.type === 'text' || !m.type ||
                                (!['image','document','audio','voice','video'].includes(m.type)) ||
                                (['image','video'].includes(m.type) && m.content && !['[Image]','[Video]'].includes(m.content) && m.content !== m.media_url)) && (
                                <p className="text-xs leading-relaxed whitespace-pre-wrap font-medium">{m.content}</p>
                              )}
                              <div className={`flex items-center justify-end gap-1 text-[9px] font-semibold ${isIn ? 'text-slate-400' : 'text-sky-200/70'}`}>
                                <span>{timeStr}</span>
                                {!isIn && (m.status === 'read' ? <CheckCheck size={11} className="text-sky-300" /> :
                                  m.status === 'delivered' ? <CheckCheck size={11} className="text-white/60" /> :
                                  m.status === 'failed' ? <AlertCircle size={11} className="text-rose-300" /> :
                                  <Check size={11} className="text-white/60" />)}
                              </div>
                              {m.status === 'failed' && m.error_msg && (
                                <div className="absolute right-0 -bottom-7 bg-slate-800 text-white text-[9px] px-2 py-1 rounded-lg shadow pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                                  ⚠ {m.error_msg}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* Quick Replies */}
                {quickReplies.length > 0 && (
                  <div className="px-4 py-2 bg-white/80 border-t border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-none">
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 whitespace-nowrap">
                      <Sparkles size={11} className="text-amber-500" /> Quick:
                    </span>
                    {quickReplies.slice(0, 6).map(r => (
                      <button key={r.id} onClick={() => setReplyText(r.content)} title={r.content}
                        className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200/80 px-3 py-1.5 rounded-lg hover:border-blue-500 hover:text-blue-600 whitespace-nowrap transition-all shadow-sm active:scale-95">
                        {r.title}
                      </button>
                    ))}
                  </div>
                )}

                {/* Attachment preview */}
                {selectedFile && (
                  <div className="px-4 py-2.5 bg-white border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {selectedFile.type === 'image'
                        ? <img src={selectedFile.previewUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                        : <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><FileText size={20} /></div>}
                      <div>
                        <p className="text-xs font-bold text-slate-700 truncate max-w-[220px]">{selectedFile.name}</p>
                        <p className="text-[10px] text-blue-500 font-semibold">Ready to send</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedFile(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"><X size={14} /></button>
                  </div>
                )}

                {uploading && (
                  <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-2 text-slate-400">
                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[11px] font-medium">Uploading…</span>
                  </div>
                )}

                {/* Composer */}
                <form onSubmit={handleSend} className="px-4 py-3 bg-white border-t border-slate-100 flex items-end gap-2">
                  <input type="file" ref={fileInputRef} className="hidden"
                    accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={handleFileChange} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={sending || uploading}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0">
                    <Paperclip size={17} />
                  </button>
                  <button type="button" onClick={() => setReplyText(p => p + '😊')} disabled={sending}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0">
                    <Smile size={17} />
                  </button>
                  <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                    placeholder={selectedFile ? 'Add a caption…' : 'Type a message… (Enter to send)'}
                    rows={1}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    className="flex-1 bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/60 resize-none max-h-28 scrollbar-thin placeholder-slate-400 transition-all" />
                  <button type="submit" disabled={sending || uploading || (!replyText.trim() && !selectedFile)}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white p-2.5 rounded-xl shadow-md shadow-blue-500/15 transition-all flex-shrink-0 flex items-center justify-center active:scale-95">
                    <Send size={15} />
                  </button>
                </form>
              </div>

              {/* ─── RIGHT CONTACT PANEL ─── */}
              {showContactPanel && (
                <div className="w-64 border-l border-slate-200/80 bg-white flex flex-col overflow-y-auto scrollbar-thin flex-shrink-0">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-700">Contact Details</p>
                    <button onClick={() => setShowContactPanel(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><X size={13} /></button>
                  </div>

                  {/* Avatar */}
                  <div className="px-4 pt-4 pb-3 flex flex-col items-center gap-2 border-b border-slate-100">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow bg-gradient-to-br ${getNameGradient(selectedConv.contact_name)}`}>
                      {String(selectedConv.contact_name || 'C').split(' ').filter(Boolean).map(s => s[0]).slice(0,2).join('').toUpperCase()}
                    </div>
                    <p className="text-sm font-bold text-slate-800 text-center">{selectedConv.contact_name || 'Unknown'}</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full text-white
                      ${selectedConv.status === 'open' ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                      {selectedConv.status === 'open' ? '● Open' : '● Archived'}
                    </span>
                  </div>

                  {/* Info rows */}
                  <div className="px-4 py-3 space-y-3">
                    {selectedConv.contact_phone && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5"><Phone size={12} className="text-slate-500" /></div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Phone</p>
                          <p className="text-xs font-bold text-slate-700 mt-0.5">{selectedConv.contact_phone}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5"><Hash size={12} className="text-slate-500" /></div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Channel</p>
                        <p className="text-xs font-bold text-slate-700 mt-0.5">{selectedConv.channel_name || selectedConv.channel_type}</p>
                        <p className="text-[10px] text-slate-400 capitalize">{selectedConv.channel_type}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5"><Calendar size={12} className="text-slate-500" /></div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Last message</p>
                        <p className="text-xs font-bold text-slate-700 mt-0.5">{selectedConv.last_message_at ? new Date(selectedConv.last_message_at).toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'}) : 'N/A'}</p>
                      </div>
                    </div>
                    {selectedConv.channel_consultant && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5"><User size={12} className="text-slate-500" /></div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Consultant</p>
                          <p className="text-xs font-bold text-slate-700 mt-0.5">{selectedConv.channel_consultant}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lead Actions */}
                  <div className="px-4 pb-4 flex flex-col gap-2 border-t border-slate-100 pt-3">
                    {selectedConv.lead_id ? (
                      <Link to={`/leads/${selectedConv.lead_id}`}
                        className="flex items-center justify-between bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors">
                        <span className="flex items-center gap-2"><ExternalLink size={13} /> View Lead Profile</span>
                        <ChevronRight size={13} />
                      </Link>
                    ) : (
                      <button onClick={() => { setLeadTab('new'); setShowLeadModal(true); }}
                        className="flex items-center justify-between bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors">
                        <span className="flex items-center gap-2"><User size={13} /> Convert to Lead</span>
                        <ChevronRight size={13} />
                      </button>
                    )}
                    <button onClick={() => handleToggleArchive(selectedConv)}
                      className="flex items-center justify-between bg-slate-50 hover:bg-slate-100 text-slate-600 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors">
                      <span className="flex items-center gap-2"><Archive size={13} /> {selectedConv.status === 'archived' ? 'Reopen' : 'Archive'}</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="max-w-sm w-full flex flex-col items-center">
              <div className="grid grid-cols-3 gap-3 w-full mb-8">
                {[
                  { icon: CheckCircle, label: 'Webhooks', sub: 'Connected', iconColor: 'text-emerald-500', bg: 'bg-emerald-50', pulse: true },
                  { icon: MessageSquare, label: 'Channels', sub: `${channels.length || 3} Active`, iconColor: 'text-blue-500', bg: 'bg-blue-50' },
                  { icon: Lock, label: 'Security', sub: 'Meta API', iconColor: 'text-indigo-500', bg: 'bg-indigo-50' },
                ].map(({ icon: Icon, label, sub, iconColor, bg, pulse }) => (
                  <div key={label} className="bg-white rounded-2xl border border-slate-200/60 p-4 flex flex-col items-center gap-2 shadow-sm">
                    <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                      <Icon size={18} className={iconColor} />
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
                    <p className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                      {pulse && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                      {sub}
                    </p>
                  </div>
                ))}
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center mb-4">
                <MessageSquare size={22} className="text-blue-600" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Live Chat Console</h2>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">Select a conversation from the inbox to start chatting. Real-time sync via Meta Webhooks.</p>
              <div className="mt-6 text-slate-400 text-[10px] font-semibold bg-white/80 px-4 py-1.5 rounded-full border border-slate-200/50 shadow-sm">
                EduExpress CRM · v2.4
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setLightboxImage(null)}>
          <button onClick={() => setLightboxImage(null)} className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-xl transition-colors"><X size={20} /></button>
          <img src={lightboxImage} alt="Preview" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
        </div>
      )}

      {/* Convert to Lead Modal */}
      {showLeadModal && selectedConv && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><User size={16} className="text-blue-600" /> Convert to Lead</h3>
              <button onClick={() => { setShowLeadModal(false); setSelectedExistingLead(null); setLeadSearch(''); }} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><X size={16} /></button>
            </div>
            <div className="flex bg-slate-100/80 p-1 rounded-xl">
              {[{id:'new',label:'Create New'},{id:'link',label:'Link Existing'}].map(t => (
                <button key={t.id} type="button" onClick={() => setLeadTab(t.id)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${leadTab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {leadTab === 'new' ? (
              <div className="flex flex-col gap-3.5">
                <p className="text-xs text-slate-500">Create a new CRM lead for <strong className="text-slate-700">{selectedConv.contact_name || 'this contact'}</strong> via {selectedConv.channel_type}.</p>
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col gap-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">Name</span> <span className="font-bold text-slate-700">{selectedConv.contact_name || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Phone</span> <span className="font-bold text-slate-700">{selectedConv.contact_phone || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Assigned to</span> <span className="font-bold text-blue-700">{selectedConv.channel_consultant || 'Abdullah Al Rakib'}</span></div>
                </div>
                <button type="button" disabled={convertingLead}
                  onClick={async () => { setConvertingLead(true); try { const res = await api.convertLead(selectedConv.id, {}); toast.success('Lead created!'); setSelectedConv(p => ({...p, lead_id: res.lead_id})); setConversations(p => p.map(c => c.id === selectedConv.id ? {...c, lead_id: res.lead_id} : c)); setShowLeadModal(false); } catch(e) { toast.error(e.message); } finally { setConvertingLead(false); } }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
                  {convertingLead ? 'Creating…' : 'Create Lead'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                <p className="text-xs text-slate-500">Link this conversation to an existing lead.</p>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={13} />
                  <input type="text" placeholder="Search name, phone…" value={leadSearch}
                    onChange={e => { setLeadSearch(e.target.value); setSelectedExistingLead(null); }}
                    className="w-full bg-slate-50 border border-slate-200/70 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 placeholder-slate-400" />
                </div>
                {leadSearchResults.length > 0 && (
                  <div className="border border-slate-100 rounded-xl max-h-36 overflow-y-auto divide-y divide-slate-50 bg-white scrollbar-thin">
                    {leadSearchResults.map(lead => (
                      <button type="button" key={lead.id} onClick={() => setSelectedExistingLead(lead)}
                        className={`w-full text-left px-3 py-2.5 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer
                          ${selectedExistingLead?.id === lead.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''}`}>
                        <div>
                          <p className="font-bold text-slate-800">{lead.client_name}</p>
                          <p className="text-[10px] text-slate-400">#{lead.lead_id} · {lead.phone || 'No phone'}</p>
                        </div>
                        <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-500">{lead.assigned_consultant || '—'}</span>
                      </button>
                    ))}
                  </div>
                )}
                {leadSearch.length >= 2 && !leadSearchResults.length && <p className="text-center text-xs text-slate-400 py-2">No leads found</p>}
                {selectedExistingLead && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs">
                    <p className="font-bold text-blue-700 mb-1">Selected: {selectedExistingLead.client_name}</p>
                    <p className="text-slate-600">Lead #{selectedExistingLead.lead_id} · {selectedExistingLead.assigned_consultant || 'Unassigned'}</p>
                  </div>
                )}
                <button type="button" disabled={convertingLead || !selectedExistingLead}
                  onClick={async () => { if (!selectedExistingLead) return; setConvertingLead(true); try { await api.convertLead(selectedConv.id, {lead_id: selectedExistingLead.id}); toast.success('Linked!'); setSelectedConv(p => ({...p, lead_id: selectedExistingLead.id})); setConversations(p => p.map(c => c.id === selectedConv.id ? {...c, lead_id: selectedExistingLead.id} : c)); setShowLeadModal(false); setSelectedExistingLead(null); setLeadSearch(''); } catch(e) { toast.error(e.message); } finally { setConvertingLead(false); } }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center disabled:opacity-50 transition-colors">
                  {convertingLead ? 'Linking…' : 'Link to Lead'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
