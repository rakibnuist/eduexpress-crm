import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import { Link, useSearchParams } from 'react-router-dom';
import { canViewAllConversations } from '../lib/roles';
import {
  MessageSquare, Search, Send, User, Phone, ExternalLink,
  Check, CheckCheck, AlertCircle, Archive, CheckCircle, RefreshCw, Trash2,
  Paperclip, Smile, FileText, X, ChevronRight, Info, Hash, Calendar, Inbox,
  Star, Tag, Plus, ClipboardList, UserPlus, Loader2, Music, Clock,
  Filter, ArrowLeft, Bell, LayoutTemplate,
  ChevronDown, Menu as MenuIcon, Zap, Edit2
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { timeAgo, initials, formatLastMessageTime, toDate, getDhakaDateParts } from '../lib/format';

/* ── Country → flag emoji ── */
const COUNTRY_EMOJIS = {
  bangladesh: '🇧🇩', china: '🇨🇳', malta: '🇲🇹', hungary: '🇭🇺',
  greece: '🇬🇷', estonia: '🇪🇪', georgia: '🇬🇪', malaysia: '🇲🇾',
  thailand: '🇹🇭', cyprus: '🇨🇾', uk: '🇬🇧', usa: '🇺🇸',
  canada: '🇨🇦', australia: '🇦🇺', germany: '🇩🇪', france: '🇫🇷',
  india: '🇮🇳', pakistan: '🇵🇰', nepal: '🇳🇵', italy: '🇮🇹',
};
const getCountryEmoji = (dest) => {
  if (!dest) return '';
  return COUNTRY_EMOJIS[dest.toLowerCase().trim()] || '';
};


const getMediaUrl = (msg) => {
  if (!msg.media_url) return '';
  if (msg.media_url.startsWith('http') || msg.media_url.startsWith('/uploads')) return msg.media_url;
  return `/api/media/${msg.id}?v=2`;
};

const getNameGradient = (name) => {
  if (!name) return 'from-slate-400 to-slate-500';
  const s = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return [
    'from-blue-400 to-indigo-500', 'from-purple-400 to-pink-500', 'from-emerald-400 to-teal-500',
    'from-amber-400 to-orange-500', 'from-sky-400 to-blue-500', 'from-rose-400 to-red-500',
    'from-violet-400 to-purple-500'
  ][s % 7];
};

const CHANNEL_META = {
  whatsapp:  { label: 'WhatsApp',  color: '#25d366', bg: 'bg-emerald-500',  icon: 'W', text: 'text-emerald-600' },
  messenger: { label: 'Messenger', color: '#0084ff', bg: 'bg-blue-500',     icon: 'M', text: 'text-blue-600' },
  instagram: { label: 'Instagram', color: '#d62976', bg: 'bg-pink-500',     icon: 'I', text: 'text-pink-600' },
  tiktok:    { label: 'TikTok',    color: '#000000', bg: 'bg-slate-800',     icon: 'T', text: 'text-slate-800' },
};

const getChannelMeta = (type) => CHANNEL_META[type] || { label: type, color: '#64748b', bg: 'bg-slate-500', icon: '?', text: 'text-slate-500' };

const getSlaColor = (lastMessageAt) => {
  if (!lastMessageAt) return 'bg-slate-300';
  const minutes = (Date.now() - (toDate(lastMessageAt) || new Date()).getTime()) / 60000;
  if (minutes < 30) return 'bg-emerald-500';
  if (minutes < 120) return 'bg-amber-500';
  return 'bg-rose-500';
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'priority', label: 'Priority' },
  { key: 'assigned_me', label: 'Assigned to me' },
  { key: 'no_lead', label: 'No Lead' },
  { key: 'new_leads', label: 'New Leads' },
  { key: 'archived', label: 'Archived' },
];

/* ── component ── */
export default function Conversations({ user }) {
  const toast = useToast();
  const confirm = useConfirm();
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  /* state */
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [channels, setChannels] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [showQuickReplyPicker, setShowQuickReplyPicker] = useState(false);
  const [quickReplySearch, setQuickReplySearch] = useState('');
  const [showQuickReplyModal, setShowQuickReplyModal] = useState(false);
  const [quickReplyForm, setQuickReplyForm] = useState({ id: null, title: '', content: '', category: '' });
  const [savingQuickReply, setSavingQuickReply] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState({ id: null, name: '', content: '', category: 'general', language: 'en', variables: [] });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [allTags, setAllTags] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [updatingConv, setUpdatingConv] = useState(false);

  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [channelTab, setChannelTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  const [replyText, setReplyText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [showContactPanel, setShowContactPanel] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 1280;
  });
  const [contactNotes, setContactNotes] = useState([]);
  const [contactTags, setContactTags] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newLeadDestination, setNewLeadDestination] = useState('Bangladesh');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadDegree, setNewLeadDegree] = useState('');
  const [newLeadName, setNewLeadName] = useState('');

  const selectedConvRef = useRef(null);
  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);
  const [addingNote, setAddingNote] = useState(false);

  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadTab, setLeadTab] = useState('new');
  const [leadSearch, setLeadSearch] = useState('');
  const [leadSearchResults, setLeadSearchResults] = useState([]);
  const [selectedExistingLead, setSelectedExistingLead] = useState(null);
  const [convertingLead, setConvertingLead] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1280;
  });
  const [expandedGroups, setExpandedGroups] = useState(() => {
    return { whatsapp: true, messenger: true, instagram: true, tiktok: true };
  });

  /* ── role helpers ── */
  const isFullAccess = useMemo(() => canViewAllConversations(user), [user]);
  const isConsultant = useMemo(() => user?.roles?.includes('consultant'), [user]);

  const isMyWhatsApp = useCallback((channel) => {
    if (!channel || channel.type !== 'whatsapp') return false;
    const myName = (user?.consultant_name || user?.name || '').trim().toLowerCase();
    const chanConsultant = (channel.consultant || '').trim().toLowerCase();
    const chanName = (channel.name || '').trim().toLowerCase();
    if (!myName) return false;
    return chanConsultant === myName || chanName.includes(myName) || myName.includes(chanConsultant);
  }, [user]);

  /* ── derived ── */
  const channelCounts = useMemo(() => {
    const counts = { all: conversations.length, whatsapp: 0, messenger: 0, instagram: 0, tiktok: 0 };
    const channelCountsById = {};
    conversations.forEach(c => {
      const t = c.channel_type;
      if (counts[t] !== undefined) counts[t]++;
      if (c.channel_id) {
        channelCountsById[c.channel_id] = (channelCountsById[c.channel_id] || 0) + 1;
      }
    });
    return { ...counts, byId: channelCountsById };
  }, [conversations]);

  const unreadCounts = useMemo(() => {
    const counts = { all: 0, whatsapp: 0, messenger: 0, instagram: 0, tiktok: 0 };
    const byId = {};
    conversations.forEach(c => {
      counts.all += c.unread_count || 0;
      const t = c.channel_type;
      if (counts[t] !== undefined) counts[t] += c.unread_count || 0;
      if (c.channel_id) {
        byId[c.channel_id] = (byId[c.channel_id] || 0) + (c.unread_count || 0);
      }
    });
    return { ...counts, byId };
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    let list = [...conversations];

    // Role-based channel filtering
    if (!isFullAccess) {
      list = list.filter(c => {
        // All non-whatsapp channels are public
        if (c.channel_type !== 'whatsapp' && c.channel_type !== 'waba') return true;
        // WhatsApp: only own account
        const chan = channels.find(ch => ch.id === c.channel_id);
        return isMyWhatsApp(chan);
      });
    }

    // Channel tab filtering
    if (channelTab !== 'all') {
      if (channelTab.startsWith('channel_')) {
        const cid = parseInt(channelTab.replace('channel_', ''));
        list = list.filter(c => c.channel_id === cid);
      } else {
        list = list.filter(c => c.channel_type === channelTab);
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.contact_name || '').toLowerCase().includes(q) ||
        (c.contact_phone || '').toLowerCase().includes(q) ||
        (c.last_message || '').toLowerCase().includes(q)
      );
    }
    switch (statusFilter) {
      case 'unread': list = list.filter(c => Number(c.unread_count || 0) > 0); break;
      case 'priority': list = list.filter(c => c.is_priority); break;
      case 'assigned_me': 
        list = list.filter(c => {
          const myName = (user?.consultant_name || user?.name || '').trim().toLowerCase();
          const assignedName = (c.assigned_to || '').trim().toLowerCase();
          return myName && assignedName === myName;
        }); 
        break;
      case 'no_lead': list = list.filter(c => !c.lead_id); break;
      case 'new_leads': list = list.filter(c => c.lead_id && c.lead_status === 'New Lead'); break;
      case 'archived': list = list.filter(c => c.status === 'archived'); break;
      default: list = list.filter(c => c.status !== 'archived'); break;
    }
    // sort: priority first, then unread, then last message time
    list.sort((a, b) => {
      return (toDate(b.last_message_at) || new Date(0)) - (toDate(a.last_message_at) || new Date(0));
    });
    return list;
  }, [conversations, channelTab, search, statusFilter, user?.id, isFullAccess, channels, isMyWhatsApp]);

  const loadMessages = useCallback(async (conv) => {
    if (!conv) return;
    setLoadingMessages(true);
    try {
      const res = await api.messages(conv.id);
      setMessages(res || []);
      await api.markConversationAsRead(conv.id);
      setConversations(prev => prev.map(c => c.id === conv.id && c.unread_count ? { ...c, unread_count: 0 } : c));
      setSelectedConv(prev => prev && prev.id === conv.id && prev.unread_count ? { ...prev, unread_count: 0 } : prev);
    } catch (err) {
      toast.error('Could not load messages: ' + err.message);
    } finally {
      setLoadingMessages(false);
    }
  }, [toast]);

  /* ── load helpers ── */
  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const p = { status: 'all', limit: 200, search: search.trim() || undefined };
      const res = await api.conversations(p);
      setConversations(res.conversations || []);
      
      const curr = selectedConvRef.current;
      if (curr) {
        loadMessages(curr);
      }
    } catch (err) {
      toast.error('Could not load conversations: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [search, toast, loadMessages]);

  const refreshConversationsBackground = useCallback(async () => {
    try {
      const p = { status: 'all', limit: 200, search: search.trim() || undefined };
      const res = await api.conversations(p);
      if (res?.conversations) {
        setConversations(prev => {
          if (JSON.stringify(prev) === JSON.stringify(res.conversations)) return prev;
          return res.conversations;
        });
      }
      const curr = selectedConvRef.current;
      if (curr) {
        const msgs = await api.messages(curr.id);
        if (msgs) {
          setMessages(prev => {
            if (JSON.stringify(prev) === JSON.stringify(msgs)) return prev;
            return msgs;
          });
        }
      }
    } catch (err) {
      console.warn('Background refresh error:', err);
    }
  }, [search]);

  const refreshBgRef = useRef(refreshConversationsBackground);
  useEffect(() => {
    refreshBgRef.current = refreshConversationsBackground;
  }, [refreshConversationsBackground]);

  const handleRefresh = useCallback(async () => {
    const curr = selectedConvRef.current;
    if (curr && curr.channel_id) {
      toast.info('Syncing with Meta in background…');
      api.syncChannel(curr.channel_id).catch(err => {
        console.warn('Sync failed:', err.message);
      });
    }
    await loadConversations();
  }, [loadConversations, toast]);

  const silentRefresh = useCallback(async () => {
    try {
      const p = { status: 'all', limit: 200, search: search.trim() || undefined };
      const res = await api.conversations(p);
      if (res?.conversations) {
        setConversations(prev => {
          const map = new Map(prev.map(c => [c.id, c]));
          let changed = false;
          res.conversations.forEach(c => {
            const existing = map.get(c.id);
            if (!existing || JSON.stringify(existing) !== JSON.stringify(c)) { changed = true; map.set(c.id, c); }
          });
          if (!changed && prev.length === res.conversations.length) return prev;
          return Array.from(map.values());
        });
      }
    } catch (err) { console.warn('Silent refresh failed:', err); }
  }, [search]);

  const silentRefreshMessages = useCallback(async (conv) => {
    if (!conv) return;
    try {
      const res = await api.messages(conv.id);
      if (res) {
        setMessages(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(res)) return res;
          return prev;
        });
      }
      await api.markConversationAsRead(conv.id);
      setConversations(prev => prev.map(c => c.id === conv.id && c.unread_count ? { ...c, unread_count: 0 } : c));
      setSelectedConv(prev => prev && prev.id === conv.id && prev.unread_count ? { ...prev, unread_count: 0 } : prev);
    } catch (err) { console.warn('Silent message refresh failed:', err); }
  }, []);

  const loadContactDetails = useCallback(async (conv) => {
    if (!conv) return;
    try {
      const [notesRes, tagsRes] = await Promise.all([
        api.conversationNotes(conv.id),
        api.tags().catch(() => ({ tags: [] }))
      ]);
      setContactNotes(notesRes.notes || []);
      setContactTags(conv.tags || []);
      setAllTags(tagsRes.tags || []);
    } catch (err) { console.warn('Failed to load contact details:', err); }
  }, []);

  /* ── effects ── */
  useEffect(() => { document.title = 'Chat Inbox | EduExpress Core'; }, []);
  useEffect(() => {
    api.channels().then(setChannels).catch(() => {});
    api.templates().then(setTemplates).catch(() => {});
    api.quickReplies().then(setQuickReplies).catch(() => {});
    api.employees().then(setEmployees).catch(() => {});
  }, []);
  useEffect(() => { loadConversations(); }, [loadConversations]);
  const selectedConvIdRef = useRef(null);
  useEffect(() => {
    if (selectedConv?.id) {
      if (selectedConvIdRef.current !== selectedConv.id) {
        selectedConvIdRef.current = selectedConv.id;
        loadMessages(selectedConv);
        loadContactDetails(selectedConv);
      }
    } else {
      selectedConvIdRef.current = null;
      setMessages([]);
      setContactNotes([]);
      setContactTags([]);
    }
  }, [selectedConv, loadMessages, loadContactDetails]);
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      }
    };
    
    scrollToBottom();
    const t = setTimeout(scrollToBottom, 100);
    const t2 = setTimeout(scrollToBottom, 300);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [messages]);
  // Polling loop removed in favor of Server-Sent Events (SSE)
  // useEffect(() => {
  //   const timer = setInterval(() => { silentRefresh(); if (selectedConv) silentRefreshMessages(selectedConv); }, 10000);
  //   return () => clearInterval(timer);
  // }, [selectedConv, silentRefresh, silentRefreshMessages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 112)}px`;
    }
  }, [replyText]);

  // ── Auto-reconnect SSE + Polling fallback ──────────────────────────────
  useEffect(() => {
    let es = null;
    let reconnectTimer = null;
    let pollTimer = null;
    let retryDelay = 2000;
    let sseFailCount = 0;
    let sseConnected = false;
    const MAX_DELAY = 30000;
    const POLL_INTERVAL = 5000;
    const SSE_FAIL_THRESHOLD = 2;

    const isSseDisabled = sessionStorage.getItem('disable_sse') === 'true';

    function handleNewMessageData(data) {
      try {
        const currConv = selectedConvRef.current;
        // Use loose equality (==) to prevent integer vs string mismatch bugs
        if (currConv && data.conversation_id == currConv.id) {
          setMessages(prev => {
            if (prev.some(m => m.id == data.id || (data.wa_message_id && m.wa_message_id == data.wa_message_id))) return prev;
            return [...prev, data];
          });
          api.markConversationAsRead(currConv.id).catch(() => {});
          setSelectedConv(prev => prev ? { ...prev, unread_count: 0 } : null);
        }
        setConversations(prev => {
          const idx = prev.findIndex(c => c.id == data.conversation_id);
          if (idx === -1) {
            api.getConversation(data.conversation_id).then(conv => {
              if (conv) setConversations(cur => cur.some(c => c.id == conv.id) ? cur : [conv, ...cur]);
            }).catch(() => {});
            return prev;
          }
          const currConv2 = selectedConvRef.current;
          const updated = [...prev];
          const isIncoming = data.direction === 'in' || data.direction === 'inbound';
          updated[idx] = { 
            ...updated[idx], 
            last_message: data.content || updated[idx].last_message, 
            last_message_at: data.created_at || updated[idx].last_message_at, 
            last_message_direction: isIncoming ? 'in' : 'out', 
            unread_count: (currConv2 && currConv2.id == updated[idx].id) ? 0 : (updated[idx].unread_count + (isIncoming ? 1 : 0)) 
          };
          return updated.sort((a, b) => (toDate(b.last_message_at) || 0) - (toDate(a.last_message_at) || 0));
        });
      } catch (err) {
        console.error("Error handling new message:", err);
      }
    }

    let activeLongPoll = true;

    async function startLongPolling() {
      console.log('[sync] Running CDN-friendly long-polling loop…');
      while (activeLongPoll) {
        try {
          const res = await api.pollMessages();
          if (!activeLongPoll) break;
          if (res && res.events) {
            res.events.forEach(event => {
              if (event && event.type === 'new_message') {
                handleNewMessageData(event);
              } else if (event && event.type === 'message_status') {
                const data = event;
                if (selectedConvRef.current) setMessages(prev => prev.map(m => m.wa_message_id == data.wa_message_id ? { ...m, status: data.status } : m));
              } else if (event && event.type === 'message_deleted') {
                const data = event;
                if (selectedConvRef.current && selectedConvRef.current.id == data.conversation_id) {
                  setMessages(prev => prev.filter(m => m.id != data.message_id));
                }
              } else if (event && event.type === 'conversation_deleted') {
                const data = event;
                if (selectedConvRef.current && selectedConvRef.current.id == data.conversation_id) { setSelectedConv(null); toast.info('Conversation was deleted'); }
                setConversations(prev => prev.filter(c => c.id !== data.conversation_id));
              } else if (event && event.type === 'sync_done') {
                refreshBgRef.current();
              }
            });
          }
        } catch (err) {
          if (!activeLongPoll) break;
          console.warn('[sync] Long poll cycle failed, retrying in 5s:', err.message);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    // Polling fallback — refresh conversations and current messages
    function startPolling() {
      if (pollTimer) return;
      console.log('[sync] SSE unavailable, falling back to polling every', POLL_INTERVAL, 'ms');
      pollTimer = setInterval(async () => {
        try {
          const p = { status: 'all', limit: 200 };
          const res = await api.conversations(p);
          if (res?.conversations) {
            setConversations(prev => {
              if (JSON.stringify(prev.map(c=>c.id+':'+c.unread_count+':'+c.last_message_at)) !== JSON.stringify(res.conversations.map(c=>c.id+':'+c.unread_count+':'+c.last_message_at))) return res.conversations;
              return prev;
            });
          }
          const currConv = selectedConvRef.current;
          if (currConv) {
            const msgs = await api.messages(currConv.id);
            if (msgs) {
              setMessages(prev => {
                if (prev.length !== msgs.length || (prev.length > 0 && prev[prev.length-1].id !== msgs[msgs.length-1]?.id)) return msgs;
                return prev;
              });
            }
          }
        } catch (err) { /* silent */ }
      }, POLL_INTERVAL);
    }

    function stopPolling() {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    function connect() {
      if (isSseDisabled) {
        startLongPolling();
        return;
      }
      if (es) { try { es.close(); } catch {} }
      try {
        es = new EventSource('/api/events', { withCredentials: true });
      } catch { 
        sessionStorage.setItem('disable_sse', 'true');
        startLongPolling(); 
        return; 
      }

      es.addEventListener('connected', () => { retryDelay = 2000; sseFailCount = 0; sseConnected = true; stopPolling(); });

      es.addEventListener('new_message', (e) => {
        try { handleNewMessageData(JSON.parse(e.data)); } catch (err) { console.error('SSE new_message error:', err); }
      });

      es.addEventListener('message_status', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (selectedConvRef.current) setMessages(prev => prev.map(m => m.wa_message_id == data.wa_message_id ? { ...m, status: data.status } : m));
        } catch (err) { console.error('SSE message_status error:', err); }
      });

      es.addEventListener('message_deleted', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (selectedConvRef.current && selectedConvRef.current.id == data.conversation_id) {
            setMessages(prev => prev.filter(m => m.id != data.message_id));
          }
        } catch (err) { console.error('SSE message_deleted error:', err); }
      });

      es.addEventListener('conversation_deleted', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (selectedConvRef.current && selectedConvRef.current.id == data.conversation_id) { setSelectedConv(null); toast.info('Conversation was deleted'); }
          setConversations(prev => prev.filter(c => c.id !== data.conversation_id));
        } catch (err) { console.error('SSE conversation_deleted error:', err); }
      });

      es.addEventListener('sync_done', () => {
        refreshBgRef.current();
      });

      es.onerror = () => {
        try { es.close(); } catch {}
        es = null;
        sseConnected = false;
        sseFailCount++;
        if (sseFailCount >= SSE_FAIL_THRESHOLD) {
          sessionStorage.setItem('disable_sse', 'true');
          startLongPolling();
        }
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 1.5, MAX_DELAY);
          connect();
        }, retryDelay);
      };
    }

    connect();
    // Also start long polling immediately as a safety net if SSE is not connected yet and is not disabled
    const initialPollDelay = setTimeout(() => { if (!sseConnected && !isSseDisabled) startLongPolling(); }, 3000);
    return () => {
      activeLongPoll = false;
      clearTimeout(initialPollDelay);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stopPolling();
      if (es) try { es.close(); } catch {}
    };
  }, [toast]);

  useEffect(() => {
    if (leadTab === 'link' && leadSearch.trim().length >= 2) {
      const delay = setTimeout(async () => {
        try { const res = await api.leads({ search: leadSearch.trim(), limit: 10 }); setLeadSearchResults(res.leads || []); }
        catch (err) { console.error('Lead search error:', err); }
      }, 300);
      return () => clearTimeout(delay);
    } else { setLeadSearchResults([]); }
  }, [leadSearch, leadTab]);

  /* ── actions ── */
  const handleSelectConv = async (c) => {
    setSelectedConv(c);
    setMessages([]);
    if (window.innerWidth < 1024) setShowMobileDrawer(false);
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!replyText.trim() && !selectedFile) return;
    if (!selectedConv) return;
    setSending(true);
    try {
      const payload = { content: replyText.trim(), sent_by: user?.name || 'Admin', type: 'text', media_url: null };
      if (selectedFile) { payload.type = selectedFile.type; payload.media_url = selectedFile.mediaUrl; if (!payload.content) payload.content = selectedFile.name; }
      const res = await api.sendMessage(selectedConv.id, payload);
      if (res?.message?.status === 'failed') { toast.error('Failed to send: ' + (res.message.error_msg || 'Unknown error')); }
      else {
        setReplyText(''); setSelectedFile(null); setShowTemplatePicker(false);
        if (res?.message) {
          setMessages(prev => prev.some(m => m.id === res.message.id || (res.message.wa_message_id && m.wa_message_id === res.message.wa_message_id)) ? prev : [...prev, res.message]);
          setConversations(prev => {
            const idx = prev.findIndex(c => c.id === selectedConv.id);
            if (idx === -1) return prev;
            const updated = [...prev];
            updated[idx] = { ...updated[idx], last_message: res.message.content || (res.message.type === 'image' ? '📷 Image' : '📎 Document'), last_message_at: res.message.created_at || new Date().toISOString() };
            return updated.sort((a, b) => (toDate(b.last_message_at) || 0) - (toDate(a.last_message_at) || 0));
          });
        }
      }
    } catch (err) { toast.error('Failed to send: ' + err.message); }
    finally { setSending(false); }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    try {
      await api.deleteMessage(msgId);
      setMessages(prev => prev.filter(m => m.id !== msgId));
      toast.success('Message deleted');
    } catch (err) {
      toast.error('Failed to delete message: ' + err.message);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const dataUrl = event.target.result;
        const base64 = dataUrl.split(',')[1];
        const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: file.name, type: file.type, data: base64 }) });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        setSelectedFile({ name: file.name, type: file.type.startsWith('image/') ? 'image' : 'document', mediaUrl: data.url, previewUrl: file.type.startsWith('image/') ? dataUrl : null });
        toast.success('File ready to attach');
      } catch (err) { toast.error('Upload failed: ' + err.message); setSelectedFile(null); }
      finally { setUploading(false); e.target.value = ''; }
    };
    reader.readAsDataURL(file);
  };

  const handleToggleArchive = async (conv) => {
    const nextStatus = conv.status === 'archived' ? 'open' : 'archived';
    const actionLabel = conv.status === 'archived' ? 'reopen' : 'archive';
    const ok = await confirm({ title: `${actionLabel.toUpperCase()} conversation?`, body: `Are you sure you want to ${actionLabel} the conversation with ${conv.contact_name || 'this contact'}?`, confirmLabel: actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1) });
    if (!ok) return;
    try { await api.updateConversation(conv.id, { status: nextStatus }); toast.success(`Conversation ${nextStatus === 'archived' ? 'archived' : 'reopened'}`); setSelectedConv(null); loadConversations(); }
    catch (err) { toast.error('Failed: ' + err.message); }
  };

  const handleDeleteConversation = async (conv) => {
    const ok = await confirm({ title: 'Delete Conversation?', body: `Permanently delete the conversation with ${conv.contact_name || 'this contact'}? All message history will be lost.`, confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    try { await api.deleteConversation(conv.id); toast.success('Conversation deleted'); setSelectedConv(null); loadConversations(); }
    catch (err) { toast.error('Failed: ' + err.message); }
  };

  const handleAssignToMe = async () => {
    if (!selectedConv) return;
    setUpdatingConv(true);
    try { await api.assignConversation(selectedConv.id, { user_id: user.id }); toast.success('Assigned to you'); const updated = { ...selectedConv, assigned_to: user.name, assigned_to_id: user.id }; setSelectedConv(updated); setConversations(prev => prev.map(c => c.id === selectedConv.id ? updated : c)); }
    catch (err) { toast.error('Failed: ' + err.message); } finally { setUpdatingConv(false); }
  };

  const handleTogglePriority = async () => {
    if (!selectedConv) return;
    setUpdatingConv(true);
    const nextPriority = !selectedConv.is_priority;
    try { await api.updateConversation(selectedConv.id, { is_priority: nextPriority }); toast.success(nextPriority ? 'Marked as priority' : 'Priority removed'); const updated = { ...selectedConv, is_priority: nextPriority }; setSelectedConv(updated); setConversations(prev => prev.map(c => c.id === selectedConv.id ? updated : c)); }
    catch (err) { toast.error('Failed: ' + err.message); } finally { setUpdatingConv(false); }
  };

  const handleMarkAsUnread = async (e, conv) => {
    if (e) e.stopPropagation();
    try {
      await api.markConversationAsUnread(conv.id);
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 1 } : c));
      if (selectedConv?.id === conv.id) setSelectedConv(prev => prev ? { ...prev, unread_count: 1 } : null);
      toast.success('Marked as unread');
    } catch (err) { toast.error('Failed: ' + err.message); }
  };

  const handleMarkAsRead = async (e, conv) => {
    if (e) e.stopPropagation();
    try {
      await api.markConversationAsRead(conv.id);
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
      if (selectedConv?.id === conv.id) setSelectedConv(prev => prev ? { ...prev, unread_count: 0 } : null);
      toast.success('Marked as read');
    } catch (err) { toast.error('Failed: ' + err.message); }
  };

  const handleToggleArchiveItem = async (e, conv) => {
    e.stopPropagation();
    const nextStatus = conv.status === 'archived' ? 'open' : 'archived';
    try {
      await api.updateConversation(conv.id, { status: nextStatus });
      toast.success(`Conversation ${nextStatus === 'archived' ? 'archived' : 'reopened'}`);
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, status: nextStatus } : c));
      if (selectedConv?.id === conv.id && nextStatus === 'archived') {
        setSelectedConv(null);
      }
    } catch (err) { toast.error('Failed: ' + err.message); }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedConv) return;
    setAddingNote(true);
    try { await api.addConversationNote(selectedConv.id, { text: newNote.trim() }); toast.success('Note added'); setNewNote(''); const res = await api.conversationNotes(selectedConv.id); setContactNotes(res.notes || []); }
    catch (err) { toast.error('Failed: ' + err.message); } finally { setAddingNote(false); }
  };

  const handleAddTag = async (tagId) => {
    if (!selectedConv) return;
    try { await api.addConversationTag(selectedConv.id, { tag_id: tagId }); const tag = allTags.find(t => String(t.id) === String(tagId)); if (tag) { setContactTags(prev => [...prev, tag]); setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, tags: [...(c.tags || []), tag] } : c)); } toast.success('Tag added'); setShowTagPicker(false); }
    catch (err) { toast.error('Failed: ' + err.message); }
  };

  const handleRemoveTag = async (tagId) => {
    if (!selectedConv) return;
    try { await api.removeConversationTag(selectedConv.id, tagId); setContactTags(prev => prev.filter(t => String(t.id) !== String(tagId))); setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, tags: (c.tags || []).filter(t => String(t.id) !== String(tagId)) } : c)); toast.success('Tag removed'); }
    catch (err) { toast.error('Failed: ' + err.message); }
  };

  const handleOpenLeadModal = () => {
    setLeadTab('new');
    if (selectedConv?.channel_name?.toLowerCase().includes('china')) {
      setNewLeadDestination('China');
    } else {
      setNewLeadDestination('Bangladesh');
    }
    setNewLeadName(selectedConv?.contact_name || '');
    setNewLeadPhone(selectedConv?.contact_phone || '');
    setNewLeadDegree('');
    setShowLeadModal(true);
  };

  const handleConvertLead = async () => {
    if (!selectedConv) return;
    setConvertingLead(true);
    try {
      if (leadTab === 'new') { const res = await api.convertLead(selectedConv.id, { destination: newLeadDestination, phone: newLeadPhone, degree: newLeadDegree, client_name: newLeadName }); toast.success('Lead created'); setSelectedConv(p => ({ ...p, lead_id: res.lead_id })); setConversations(p => p.map(c => c.id === selectedConv.id ? { ...c, lead_id: res.lead_id } : c)); }
      else if (selectedExistingLead) { await api.convertLead(selectedConv.id, { lead_id: selectedExistingLead.id }); toast.success('Linked to lead'); setSelectedConv(p => ({ ...p, lead_id: selectedExistingLead.id })); setConversations(p => p.map(c => c.id === selectedConv.id ? { ...c, lead_id: selectedExistingLead.id } : c)); setSelectedExistingLead(null); setLeadSearch(''); }
      setShowLeadModal(false);
    } catch (e) { toast.error(e.message); } finally { setConvertingLead(false); }
  };

  const handleSelectQuickReply = (qr) => {
    setReplyText(prev => prev + (prev ? '\n' : '') + qr.content);
    setShowQuickReplyPicker(false);
    setTimeout(() => textareaRef.current?.focus(), 10);
  };

  const handleSaveQuickReply = async (e) => {
    e.preventDefault();
    setSavingQuickReply(true);
    try {
      if (quickReplyForm.id) {
        await api.updateQuickReply(quickReplyForm.id, quickReplyForm);
        toast.success('Quick reply updated!');
      } else {
        await api.createQuickReply(quickReplyForm);
        toast.success('Quick reply added!');
      }
      const all = await api.quickReplies();
      setQuickReplies(all);
      setQuickReplyForm({ id: null, title: '', content: '', category: '' });
    } catch (err) {
      toast.error('Failed to save quick reply: ' + err.message);
    } finally {
      setSavingQuickReply(false);
    }
  };

  const handleDeleteQuickReply = async (id) => {
    if (!window.confirm('Delete this quick reply?')) return;
    try {
      await api.deleteQuickReply(id);
      setQuickReplies(prev => prev.filter(q => q.id !== id));
      toast.success('Quick reply deleted');
    } catch (err) {
      toast.error('Failed to delete quick reply: ' + err.message);
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setSavingTemplate(true);
    try {
      if (templateForm.id) {
        const res = await api.updateTemplate(templateForm.id, templateForm);
        setTemplates(prev => prev.map(t => t.id === templateForm.id ? res : t));
        toast.success('Template updated');
      } else {
        const res = await api.createTemplate(templateForm);
        setTemplates(prev => [...prev, res]);
        toast.success('Template added');
      }
      setTemplateForm({ id: null, name: '', content: '', category: 'general', language: 'en', variables: [] });
    } catch (err) {
      toast.error('Failed to save template: ' + err.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await api.deleteTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast.success('Template deleted');
    } catch (err) {
      toast.error('Failed to delete template: ' + err.message);
    }
  };

  const handleMarkNegative = async () => {
    if (!selectedConv?.lead_id) {
      // No lead yet — create one first then mark negative? For now just show a toast.
      toast.error('Please convert to a Lead first before marking as Negative.');
      return;
    }
    if (!window.confirm('Mark this lead as Negative / Not Interested?')) return;
    try {
      await api.updateLead(selectedConv.lead_id, { stage: 'Negative', status: 'negative' });
      toast.success('Marked as Negative / Not Interested');
    } catch (err) {
      toast.error('Failed: ' + err.message);
    }
  };

  const handleSelectTemplate = (t) => {

    setReplyText(t.content || '');
    setShowTemplatePicker(false);
    setTimeout(() => { textareaRef.current?.focus(); }, 0);
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  /* ── render helpers ── */
  const groupMessagesByDate = (msgs) => {
    const groups = [];
    let lastDate = null;
    msgs.forEach((m, idx) => {
      const d = toDate(m.created_at);
      if (!d) return;
      const dateStr = d.toLocaleDateString('en-US', { timeZone: 'Asia/Dhaka' });
      if (dateStr !== lastDate) {
        const now = new Date();
        const dParts = getDhakaDateParts(d);
        const nowParts = getDhakaDateParts(now);
        
        const today = new Date(nowParts.year, nowParts.month, nowParts.day);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const msgDate = new Date(dParts.year, dParts.month, dParts.day);
        
        let label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Dhaka' });
        if (msgDate.getTime() === today.getTime()) label = 'Today';
        else if (msgDate.getTime() === yesterday.getTime()) label = 'Yesterday';
        groups.push({ type: 'separator', label, key: `sep-${idx}` });
        lastDate = dateStr;
      }
      groups.push({ type: 'message', msg: m, key: m.id || idx });
    });
    return groups;
  };

  const ChannelIcon = ({ type, size = 16 }) => {
    const meta = getChannelMeta(type);
    if (type === 'tiktok') return <Music size={size} style={{ color: meta.color }} />;
    if (type === 'instagram') return <Star size={size} style={{ color: meta.color }} />;
    if (type === 'messenger') return <MessageSquare size={size} style={{ color: meta.color }} />;
    return <MessageSquare size={size} style={{ color: meta.color }} />;
  };

  const toggleGroup = (type) => {
    setExpandedGroups(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const activeChannelMeta = selectedConv ? getChannelMeta(selectedConv.channel_type) : null;

  /* ── sidebar channel sections ── */
  const whatsappChannels = useMemo(() => {
    const all = channels.filter(c => c.type === 'whatsapp' && c.active !== 0);
    if (isFullAccess) return all;
    if (isConsultant) return all.filter(c => isMyWhatsApp(c));
    return [];
  }, [channels, isFullAccess, isConsultant, isMyWhatsApp]);

  const otherChannels = useMemo(() => {
    return channels.filter(c => c.type !== 'whatsapp' && c.active !== 0);
  }, [channels]);

  // All individual channels for sidebar listing
  const allIndividualChannels = useMemo(() => {
    return [...whatsappChannels, ...otherChannels];
  }, [whatsappChannels, otherChannels]);

  /* ── render ── */
  return (
    <div className="h-[calc(100vh-64px)] flex bg-white overflow-hidden" style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>

      {/* ═══ LEFT: Channel Sidebar ═══ */}
      <div className={`${selectedConv ? 'hidden xl:flex' : 'flex'} ${sidebarCollapsed ? 'w-14' : 'w-52'} bg-white border-r border-[#e4e6eb] flex-col flex-shrink-0 transition-all duration-200 z-10`}>
        <div className="flex items-center justify-between px-3 py-3 flex-shrink-0">
          {!sidebarCollapsed && <span className="text-[13px] font-bold text-[#1c1e21]">Inbox</span>}
          <button onClick={() => setSidebarCollapsed(c => !c)} className="p-1.5 hover:bg-[#f0f2f5] rounded-lg text-[#606770] transition-colors ml-auto">
            <MenuIcon size={15} />
          </button>
        </div>

        {/* Channel nav items */}
        <div className="flex-1 overflow-y-auto px-1.5 space-y-0.5">
          {[
            { key: 'all', label: 'All messages', icon: Inbox },
            { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: '#25d366' },
            { key: 'messenger', label: 'Messenger', icon: MessageSquare, color: '#0084ff' },
            { key: 'instagram', label: 'Instagram', icon: Star, color: '#d62976' },
            { key: 'tiktok', label: 'TikTok', icon: Music, color: '#000' },
          ].map(item => {
            const isActive = channelTab === item.key;
            const unread = item.key === 'all' ? unreadCounts.all : (unreadCounts[item.key] || 0);
            return (
              <button key={item.key} onClick={() => setChannelTab(item.key)} title={item.label}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all ${isActive ? 'bg-[#e7f3ff] text-[#1877f2] font-semibold' : 'text-[#1c1e21] hover:bg-[#f0f2f5]'}`}>
                <item.icon size={17} style={item.color ? { color: isActive ? item.color : '#606770' } : {}} className={isActive && !item.color ? 'text-[#1877f2]' : ''} />
                {!sidebarCollapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
                {!sidebarCollapsed && unread > 0 && (
                  <span className="bg-[#1877f2] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{unread}</span>
                )}
                {sidebarCollapsed && unread > 0 && (
                  <span className="absolute right-1 top-1 w-2 h-2 rounded-full bg-[#1877f2]" />
                )}
              </button>
            );
          })}

          {/* Individual channel sub-items (WhatsApp + Pages) */}
          {!sidebarCollapsed && allIndividualChannels.length > 0 && (
            <div className="mt-1 pt-1 border-t border-[#e4e6eb]">
              {allIndividualChannels.map(ch => {
                const isActive = channelTab === `channel_${ch.id}`;
                const unread = unreadCounts.byId?.[ch.id] || 0;
                const chMeta = getChannelMeta(ch.type);
                return (
                  <button key={ch.id} onClick={() => setChannelTab(`channel_${ch.id}`)} title={ch.name}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] transition-all ${isActive ? 'bg-[#e7f3ff] text-[#1877f2] font-semibold' : 'text-[#606770] hover:bg-[#f0f2f5]'}`}>
                    <div className="relative flex-shrink-0">
                      {ch.avatar_url
                        ? <img src={ch.avatar_url} alt={ch.name} className="w-[28px] h-[28px] rounded-full object-cover" />
                        : <div className={`w-[28px] h-[28px] rounded-full flex items-center justify-center text-white font-bold text-[10px] ${chMeta.bg}`}>{chMeta.icon}</div>
                      }
                    </div>
                    <span className="flex-1 text-left truncate">{ch.name}</span>
                    {unread > 0 && <span className="bg-[#1877f2] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{unread}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ MIDDLE: Contact List + Chat ═══ */}
      <div className="flex-1 flex overflow-hidden">

        {/* Contact List */}
        <div className={`${selectedConv ? 'hidden xl:flex' : 'flex'} w-full xl:w-[340px] flex-col border-r border-[#e4e6eb] bg-white flex-shrink-0`}>

          {/* List Header */}
          <div className="px-4 pt-4 pb-2 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[18px] font-bold text-[#1c1e21]">
                {channelTab === 'all' ? 'All messages' 
                 : channelTab.startsWith('channel_') ? (allIndividualChannels.find(c => String(c.id) === channelTab.replace('channel_', ''))?.name || 'Channel')
                 : getChannelMeta(channelTab).label || channelTab}
                {totalUnread > 0 && <span className="ml-2 text-[13px] font-semibold text-[#1877f2]">{totalUnread}</span>}
              </h2>
              <button onClick={handleRefresh} title="Refresh" className="p-1.5 hover:bg-[#f0f2f5] rounded-full text-[#606770] transition-colors">
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8d91]" size={14} />
              <input type="text" placeholder="Search Inbox" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#f0f2f5] border-0 rounded-full pl-9 pr-4 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1877f2]/20 placeholder-[#8a8d91]" />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              {FILTERS.slice(0, 4).map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all ${statusFilter === f.key ? 'bg-[#e7f3ff] text-[#1877f2]' : 'text-[#606770] hover:bg-[#f0f2f5]'}`}>
                  {f.label}
                </button>
              ))}
              <div className="relative">
                <button onClick={() => setFilterDropdownOpen(o => !o)} className={`p-1.5 rounded-full transition-all text-[#606770] hover:bg-[#f0f2f5]`}>
                  <Filter size={14} />
                </button>
                {filterDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setFilterDropdownOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 bg-white border border-[#e4e6eb] rounded-xl shadow-xl z-20 min-w-[160px] py-1">
                      {FILTERS.slice(4).map(f => (
                        <button key={f.key} onClick={() => { setStatusFilter(f.key); setFilterDropdownOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${statusFilter === f.key ? 'font-bold text-[#1877f2] bg-[#e7f3ff]' : 'text-[#1c1e21] hover:bg-[#f0f2f5]'}`}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-[#8a8d91]">
                <div className="w-5 h-5 border-2 border-[#1877f2] border-t-transparent rounded-full animate-spin" />
                <p className="text-[12px]">Loading…</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-1 px-4 text-center">
                <MessageSquare size={24} className="text-[#e4e6eb] mb-1" />
                <p className="text-[13px] font-semibold text-[#606770]">No conversations</p>
                <p className="text-[11px] text-[#8a8d91]">Adjust filters or search</p>
              </div>
            ) : (
              filteredConversations.map(conv => {
                const isSel = selectedConv?.id === conv.id;
                const meta = getChannelMeta(conv.channel_type);
                const isUnread = Number(conv.unread_count || 0) > 0;
                const countryFlag = getCountryEmoji(conv.lead_destination);
                return (
                  <button key={conv.id} onClick={() => handleSelectConv(conv)}
                    className={`group w-full px-4 py-3 flex items-start gap-3 text-left transition-colors relative ${
                      isSel ? 'bg-[#e7f3ff]'
                      : isUnread ? 'bg-[#e3f0ff] hover:bg-[#d8ebff] shadow-[inset_0_0_0_1px_rgba(24,119,242,0.1)]' // Stronger highlight for unread
                      : 'hover:bg-[#f0f2f5]'
                    }`}>

                    {/* Unread indicator bar */}
                    {isUnread && <div className="absolute left-0 top-1 bottom-1 w-[4px] bg-[#1877f2] rounded-r-full shadow-sm" />}

                    {/* Avatar */}
                    <div className="relative flex-shrink-0 mt-0.5">
                      {conv.contact_avatar
                        ? <img src={conv.contact_avatar} alt={conv.contact_name || 'C'} className="w-[46px] h-[46px] rounded-full object-cover" />
                        : <div className={`w-[46px] h-[46px] rounded-full flex items-center justify-center text-white font-bold text-[15px] bg-gradient-to-br ${getNameGradient(conv.contact_name)}`}>{initials(conv.contact_name || 'C')}</div>
                      }
                      {/* Channel icon badge */}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-white text-[8px] font-black text-white ${meta.bg}`}>
                        {meta.icon}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className={`text-[14.5px] truncate leading-tight ${isUnread ? 'font-bold text-black' : 'font-semibold text-[#1c1e21]'}`}>
                          {conv.contact_name || conv.contact_phone || 'Contact'}
                          {countryFlag && <span className="ml-1 text-[13px]">{countryFlag}</span>}
                        </span>
                        <span className={`text-[11.5px] whitespace-nowrap flex-shrink-0 ${isUnread ? 'font-bold text-[#1877f2]' : 'text-[#8a8d91]'}`}>{formatLastMessageTime(conv.last_message_at)}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {conv.last_message_direction === 'out' && (
                          conv.last_message_status === 'read'
                            ? <CheckCheck size={11} className="text-[#1877f2] flex-shrink-0" />
                            : conv.last_message_status === 'failed'
                              ? <AlertCircle size={11} className="text-rose-500 flex-shrink-0" />
                              : <CheckCheck size={11} className="text-[#8a8d91] flex-shrink-0" />
                        )}
                        <p className={`text-[12.5px] truncate flex-1 ${isUnread ? 'font-bold text-[#050505]' : 'font-normal text-[#65676b]'}`}>
                          {conv.last_message || 'No messages yet'}
                        </p>
                        {isUnread && (
                          <span className="w-[18px] h-[18px] rounded-full bg-[#1877f2] text-white text-[9.5px] font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      {/* Tags row */}
                      {((conv.tags || []).length > 0 || conv.assigned_to) && (
                        <div className="flex items-center gap-1 mt-1">
                          {conv.assigned_to && (
                            <span className="text-[10px] text-[#1877f2] bg-[#e7f3ff] px-1.5 py-0.5 rounded font-semibold">{conv.assigned_to.split(' ')[0]}</span>
                          )}
                          {(conv.tags || []).slice(0, 2).map(tag => (
                            <span key={tag.id} className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: tag.color || '#64748b' }}>{tag.name}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Hover actions */}
                    <div className="absolute right-3 top-3 flex gap-0.5 opacity-0 group-hover:opacity-100 bg-white border border-[#e4e6eb] rounded-lg shadow-sm px-0.5 py-0.5 transition-opacity">
                      {isUnread
                        ? <button onClick={e => handleMarkAsRead(e, conv)} title="Mark read" className="p-1 hover:bg-[#f0f2f5] rounded text-[#8a8d91] hover:text-[#1877f2] transition-colors"><CheckCircle size={13} /></button>
                        : <button onClick={e => handleMarkAsUnread(e, conv)} title="Mark unread" className="p-1 hover:bg-[#f0f2f5] rounded text-[#8a8d91] hover:text-[#1877f2] transition-colors"><MessageSquare size={13} /></button>}
                      <button onClick={e => handleToggleArchiveItem(e, conv)} title={conv.status === 'archived' ? 'Reopen' : 'Archive'} className="p-1 hover:bg-[#f0f2f5] rounded text-[#8a8d91] hover:text-[#606770] transition-colors"><Archive size={13} /></button>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ═══ CHAT THREAD ═══ */}
        <div className={`${selectedConv ? 'flex' : 'hidden xl:flex'} flex-1 flex-col bg-[#f0f2f5] min-w-0`}>
          {selectedConv ? (
            <>
              {/* Chat Header — Meta style */}
              <div className="bg-white border-b border-[#e4e6eb] px-4 h-[60px] flex items-center justify-between flex-shrink-0 z-10">
                {/* Left: back + avatar + name */}
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setSelectedConv(null)} className="xl:hidden p-1.5 hover:bg-[#f0f2f5] rounded-full text-[#606770] transition-colors mr-1">
                    <ArrowLeft size={18} />
                  </button>
                  <div className="relative flex-shrink-0">
                    {selectedConv.contact_avatar
                      ? <img src={selectedConv.contact_avatar} alt={selectedConv.contact_name || 'C'} className="w-[38px] h-[38px] rounded-full object-cover" />
                      : <div className={`w-[38px] h-[38px] rounded-full flex items-center justify-center text-white font-bold text-[13px] bg-gradient-to-br ${getNameGradient(selectedConv.contact_name)}`}>{initials(selectedConv.contact_name || 'C')}</div>
                    }
                    <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-[1.5px] border-white text-[7px] font-black text-white ${getChannelMeta(selectedConv.channel_type).bg}`}>
                      {getChannelMeta(selectedConv.channel_type).icon}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-[14px] font-bold text-[#1c1e21] truncate">{selectedConv.contact_name || 'Contact'}</h3>
                      {selectedConv.lead_destination && <span className="text-[13px]" title={selectedConv.lead_destination}>{getCountryEmoji(selectedConv.lead_destination)}</span>}
                      {selectedConv.is_priority && <Star size={12} className="text-amber-500 flex-shrink-0" fill="currentColor" />}
                      {/* Read/Unread badge */}
                      {selectedConv.unread_count > 0
                        ? <span className="text-[10px] bg-[#1877f2] text-white px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">{selectedConv.unread_count} unread</span>
                        : <span className="text-[10px] text-[#1877f2] font-semibold flex-shrink-0">✓ Read</span>
                      }
                    </div>
                    <p className="text-[11px] text-[#8a8d91] flex items-center gap-1.5">
                      {selectedConv.contact_phone && <><Phone size={9} />{selectedConv.contact_phone}</>}
                      {selectedConv.lead_id
                        ? <><span className="text-[#e4e6eb]">·</span><Link to={`/leads/${selectedConv.lead_id}`} className="text-[#1877f2] hover:underline font-semibold inline-flex items-center gap-0.5">Lead #{selectedConv.lead_id} <ExternalLink size={9} /></Link></>
                        : <><span className="text-[#e4e6eb]">·</span><button onClick={handleOpenLeadModal} className="text-amber-600 hover:text-amber-700 font-semibold">+ Convert to Lead</button></>
                      }
                    </p>
                  </div>
                </div>

                {/* Right: action buttons — Meta style icon bar */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {/* Add to Lead / Lead button */}
                  {!selectedConv.lead_id ? (
                    <button onClick={handleOpenLeadModal}
                      className="bg-[#1877f2] hover:bg-[#166fe5] text-white font-semibold text-[12px] px-3 py-1.5 rounded-full flex items-center gap-1 transition-all mr-1">
                      <User size={12} /><span>Add to Lead</span>
                    </button>
                  ) : (
                    <Link to={`/leads/${selectedConv.lead_id}`}
                      className="bg-[#e7f3ff] hover:bg-[#d4e9ff] text-[#1877f2] font-semibold text-[12px] px-3 py-1.5 rounded-full flex items-center gap-1 transition-all mr-1">
                      <User size={12} /><span>Lead #{selectedConv.lead_id}</span>
                    </Link>
                  )}

                  {/* Negative button */}
                  <button onClick={handleMarkNegative} title="Negative / Not Interested"
                    className="bg-[#fff0f0] hover:bg-[#ffe0e0] text-rose-600 font-semibold text-[12px] px-2.5 py-1.5 rounded-full flex items-center gap-1 border border-rose-200 transition-all mr-1">
                    <X size={11} /><span className="hidden sm:inline">Negative</span>
                  </button>

                  {/* Read/Unread toggle */}
                  {selectedConv.unread_count > 0
                    ? <button onClick={e => handleMarkAsRead(e, selectedConv)} title="Mark as Read" className="p-2 hover:bg-[#f0f2f5] rounded-full text-[#1877f2] transition-colors"><CheckCircle size={16} /></button>
                    : <button onClick={e => handleMarkAsUnread(e, selectedConv)} title="Mark as Unread" className="p-2 hover:bg-[#f0f2f5] rounded-full text-[#8a8d91] transition-colors"><MessageSquare size={16} /></button>
                  }
                  <button onClick={handleTogglePriority} title={selectedConv.is_priority ? 'Remove priority' : 'Priority'}
                    className={`p-2 rounded-full transition-colors ${selectedConv.is_priority ? 'text-amber-500' : 'text-[#8a8d91] hover:bg-[#f0f2f5]'}`}><Star size={16} /></button>
                  <button onClick={() => setShowContactPanel(p => !p)} title="Contact Info"
                    className={`hidden xl:flex p-2 rounded-full transition-colors ${showContactPanel ? 'text-[#1877f2] bg-[#e7f3ff]' : 'text-[#8a8d91] hover:bg-[#f0f2f5]'}`}><Info size={16} /></button>
                  <button onClick={() => handleToggleArchive(selectedConv)} title={selectedConv.status === 'archived' ? 'Reopen' : 'Archive'}
                    className="p-2 hover:bg-[#f0f2f5] text-[#8a8d91] hover:text-[#606770] rounded-full transition-colors"><Archive size={16} /></button>
                  <button onClick={() => handleDeleteConversation(selectedConv)} title="Delete"
                    className="p-2 hover:bg-[#f0f2f5] text-[#8a8d91] hover:text-rose-600 rounded-full transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>

              {/* Chat body */}
              <div className="flex-1 flex overflow-hidden">
                {/* Messages */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 lg:px-8 py-4 scrollbar-thin" style={{ background: '#f0f2f5' }}>
                    {loadingMessages ? (
                      <div className="flex flex-col items-center justify-center h-full gap-2 text-[#8a8d91]">
                        <div className="w-5 h-5 border-2 border-[#1877f2] border-t-transparent rounded-full animate-spin" />
                        <p className="text-[12px]">Loading messages…</p>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full">
                        <div className="bg-white rounded-2xl px-8 py-6 text-center shadow-sm max-w-xs">
                          <MessageSquare size={28} className="text-[#e4e6eb] mx-auto mb-3" />
                          <p className="font-bold text-[#1c1e21] text-[14px]">No messages yet</p>
                          <p className="text-[12px] text-[#8a8d91] mt-1">Send the first message to start the conversation.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {groupMessagesByDate(messages).map(item => {
                          if (item.type === 'separator') return (
                            <div key={item.label} className="flex items-center gap-3 my-3">
                              <div className="flex-1 h-px bg-[#e4e6eb]" />
                              <span className="text-[11px] text-[#8a8d91] font-semibold bg-[#f0f2f5] px-2">{item.label}</span>
                              <div className="flex-1 h-px bg-[#e4e6eb]" />
                            </div>
                          );
                          const msg = item.msg;
                          const isOut = msg.direction === 'out' || msg.direction === 'outbound';
                          const mediaUrl = getMediaUrl(msg);
                          return (
                            <div key={msg.id || item.key} className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-0.5 group`}>
                              {!isOut && (
                                selectedConv.contact_avatar
                                  ? <img src={selectedConv.contact_avatar} alt={selectedConv.contact_name || 'C'} className="w-7 h-7 rounded-full object-cover flex-shrink-0 self-end mb-1 mr-1.5" />
                                  : <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0 self-end mb-1 mr-1.5 bg-gradient-to-br ${getNameGradient(selectedConv.contact_name)}`}>{initials(selectedConv.contact_name || 'C')}</div>
                              )}
                              
                              {isOut && (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center mr-2">
                                  <button onClick={() => handleDeleteMessage(msg.id)} className="p-1.5 text-[#8a8d91] hover:text-red-500 hover:bg-red-50 rounded-full" title="Delete Message">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}

                              <div className={`max-w-[65%] ${isOut ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                                {/* Media */}
                                {mediaUrl && msg.type === 'image' && (
                                  <button onClick={() => setLightboxImage(mediaUrl)} className="rounded-2xl overflow-hidden border border-[#e4e6eb] hover:opacity-90 transition-opacity shadow-sm">
                                    <img src={mediaUrl} alt={msg.caption || 'Image'} className="max-w-[240px] max-h-[200px] object-cover block" />
                                  </button>
                                )}
                                {mediaUrl && msg.type === 'audio' && (
                                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl text-xs ${isOut ? 'bg-[#1877f2] text-white' : 'bg-white text-[#1c1e21]'}`}>
                                    <Music size={14} /><audio controls src={mediaUrl} className="max-w-[180px] h-6" style={{ accentColor: isOut ? '#fff' : '#1877f2' }} />
                                  </div>
                                )}
                                {mediaUrl && (msg.type === 'document' || msg.type === 'file') && (
                                  <a href={mediaUrl} target="_blank" rel="noreferrer"
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl text-xs font-semibold shadow-sm border ${isOut ? 'bg-[#1877f2] text-white border-[#1877f2]' : 'bg-white text-[#1877f2] border-[#e4e6eb]'}`}>
                                    <FileText size={14} />{msg.content || 'Document'}<ExternalLink size={10} />
                                  </a>
                                )}
                                {/* Text bubble */}
                                {msg.content && (
                                  <div className={`px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed ${
                                    isOut
                                      ? 'bg-[#1877f2] text-white rounded-br-sm shadow-md'
                                      : 'bg-white text-[#050505] rounded-bl-sm shadow-[0_1px_4px_rgba(0,0,0,0.15)] border border-[#d8dadf]'
                                  }`} style={{wordBreak:'break-word', whiteSpace:'pre-wrap'}}>
                                    {msg.content}
                                  </div>
                                )}
                                {/* Meta: time + status */}
                                <div className={`flex items-center gap-1 px-1 ${isOut ? 'justify-end' : ''}`}>
                                  <span className="text-[10px] text-[#8a8d91]">
                                    {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                  </span>
                                  {isOut && (
                                    msg.status === 'read' ? <CheckCheck size={11} className="text-[#1877f2]" />
                                    : msg.status === 'failed' ? <AlertCircle size={11} className="text-rose-400" />
                                    : <CheckCheck size={11} className="text-[#8a8d91]" />
                                  )}
                                </div>
                              </div>

                              {!isOut && (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center ml-2">
                                  <button onClick={() => handleDeleteMessage(msg.id)} className="p-1.5 text-[#8a8d91] hover:text-red-500 hover:bg-red-50 rounded-full" title="Delete Message">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  {/* Suggested/Quick replies bar */}
                  {(showQuickReplyPicker || quickReplies.length > 0) && (
                    <div className="px-4 py-2 bg-white border-t border-[#e4e6eb] flex items-center gap-2 overflow-x-auto scrollbar-none flex-shrink-0">
                      <span className="text-[11px] font-bold text-[#606770] whitespace-nowrap flex items-center gap-1">
                        <Zap size={11} className="text-amber-500" /> Quick:
                      </span>
                      {quickReplies.filter(q => (q.title || '').toLowerCase().includes(quickReplySearch.toLowerCase())).slice(0, 6).map(q => (
                        <button key={q.id} onClick={() => handleSelectQuickReply(q)} title={q.content}
                          className="text-[12px] font-medium text-[#1877f2] bg-[#e7f3ff] hover:bg-[#d4e9ff] px-3 py-1 rounded-full whitespace-nowrap transition-colors">
                          {q.title}
                        </button>
                      ))}
                      <button onClick={() => setShowQuickReplyModal(true)}
                        className="text-[11px] font-semibold text-[#8a8d91] hover:text-[#606770] px-2 py-1 rounded-full hover:bg-[#f0f2f5] transition-colors whitespace-nowrap">
                        Manage
                      </button>
                    </div>
                  )}

                  {/* Attachment preview */}
                  {selectedFile && (
                    <div className="px-4 py-2 bg-white border-t border-[#e4e6eb] flex items-center justify-between flex-shrink-0">
                      <div className="flex items-center gap-2.5">
                        {selectedFile.type === 'image'
                          ? <img src={selectedFile.previewUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-[#e4e6eb]" />
                          : <div className="w-10 h-10 rounded-lg bg-[#e7f3ff] text-[#1877f2] flex items-center justify-center"><FileText size={20} /></div>}
                        <div>
                          <p className="text-[12px] font-bold text-[#1c1e21] truncate max-w-[220px]">{selectedFile.name}</p>
                          <p className="text-[11px] text-[#1877f2] font-semibold">Ready to send</p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedFile(null)} className="p-1.5 hover:bg-[#f0f2f5] rounded-full text-[#8a8d91] transition-colors"><X size={14} /></button>
                    </div>
                  )}
                  {uploading && (
                    <div className="px-4 py-2 bg-white border-t border-[#e4e6eb] flex items-center gap-2 text-[#8a8d91] flex-shrink-0">
                      <div className="w-3 h-3 border-2 border-[#1877f2] border-t-transparent rounded-full animate-spin" />
                      <span className="text-[12px]">Uploading…</span>
                    </div>
                  )}

                  {/* Composer — Meta style */}
                  <form onSubmit={handleSend} className="bg-white border-t border-[#e4e6eb] px-3 py-2.5 flex items-end gap-2 flex-shrink-0">
                    <input type="file" ref={fileInputRef} className="hidden"
                      accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      onChange={handleFileChange} />

                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={sending || uploading}
                      className="p-2 text-[#8a8d91] hover:text-[#1877f2] hover:bg-[#e7f3ff] rounded-full transition-colors flex-shrink-0">
                      <Paperclip size={18} />
                    </button>

                    <div className="relative flex-shrink-0">
                      <button type="button" onClick={() => setShowEmojiPicker(p => !p)} disabled={sending}
                        className="p-2 text-[#8a8d91] hover:text-amber-500 hover:bg-amber-50 rounded-full transition-colors flex items-center justify-center">
                        <Smile size={18} />
                      </button>
                      {showEmojiPicker && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                          <div className="absolute bottom-full left-0 mb-2 z-50 shadow-2xl rounded-2xl overflow-hidden border border-[#e4e6eb]">
                            <EmojiPicker onEmojiClick={(emojiData) => { setReplyText(p => p + emojiData.emoji); setShowEmojiPicker(false); textareaRef.current?.focus(); }} width={300} height={350} searchDisabled={false} skinTonesDisabled />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Quick replies toggle */}
                    <button type="button" onClick={() => setShowQuickReplyPicker(o => !o)}
                      className={`p-2 rounded-full transition-colors flex-shrink-0 ${showQuickReplyPicker ? 'text-amber-500 bg-amber-50' : 'text-[#8a8d91] hover:text-amber-500 hover:bg-amber-50'}`}>
                      <Zap size={17} />
                    </button>

                    {/* Templates toggle */}
                    <button type="button" onClick={() => setShowTemplatePicker(o => !o)}
                      className={`p-2 rounded-full transition-colors flex-shrink-0 ${showTemplatePicker ? 'text-[#1877f2] bg-[#e7f3ff]' : 'text-[#8a8d91] hover:text-[#1877f2] hover:bg-[#e7f3ff]'}`}>
                      <LayoutTemplate size={17} />
                    </button>

                    {/* Text input */}
                    <div className="flex-1 bg-[#f0f2f5] rounded-2xl px-4 py-2">
                      <textarea ref={textareaRef} value={replyText} onChange={e => setReplyText(e.target.value)}
                        placeholder={`Reply in ${getChannelMeta(selectedConv.channel_type).label}…`}
                        rows={1}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        className="w-full bg-transparent text-[13.5px] text-[#1c1e21] placeholder-[#8a8d91] resize-none focus:outline-none max-h-28 scrollbar-thin" />
                    </div>

                    {/* Send */}
                    <button type="submit" disabled={sending || uploading || (!replyText.trim() && !selectedFile)}
                      className="bg-[#1877f2] hover:bg-[#166fe5] disabled:opacity-40 text-white p-2.5 rounded-full shadow-sm transition-all flex-shrink-0 flex items-center justify-center active:scale-95">
                      {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    </button>
                  </form>
                </div>

                {/* Right Panel — Contact Info */}
                {showContactPanel && (
                  <div className="hidden xl:flex w-[300px] border-l border-[#e4e6eb] bg-white flex-col overflow-y-auto scrollbar-thin flex-shrink-0">
                    <div className="p-4 border-b border-[#e4e6eb] flex items-center justify-between">
                      <p className="text-[14px] font-bold text-[#1c1e21]">About</p>
                      <button onClick={() => setShowContactPanel(false)} className="p-1 hover:bg-[#f0f2f5] rounded-full text-[#8a8d91] transition-colors"><X size={14} /></button>
                    </div>
                    <div className="p-4 border-b border-[#e4e6eb] flex flex-col items-center gap-3">
                      <div className="relative">
                        <div className={`w-[64px] h-[64px] rounded-full flex items-center justify-center text-white font-extrabold text-xl bg-gradient-to-br ${getNameGradient(selectedConv.contact_name)}`}>
                          {initials(selectedConv.contact_name || 'C')}
                        </div>
                        <span className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white text-[10px] font-black text-white ${getChannelMeta(selectedConv.channel_type).bg}`}>
                          {getChannelMeta(selectedConv.channel_type).icon}
                        </span>
                      </div>
                      <div className="text-center">
                        <p className="text-[15px] font-bold text-[#1c1e21]">{selectedConv.contact_name || 'Unknown Contact'}</p>
                        <div className="flex items-center gap-1.5 mt-1 justify-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${selectedConv.status === 'open' ? 'bg-emerald-500' : 'bg-[#8a8d91]'}`}>
                            {selectedConv.status === 'open' ? 'Open' : 'Archived'}
                          </span>
                          {selectedConv.is_priority && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-0.5">
                              <Star size={9} fill="currentColor" /> Priority
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Info rows */}
                    <div className="p-4 space-y-3 border-b border-[#e4e6eb]">
                      <p className="text-[11px] font-bold text-[#8a8d91] uppercase tracking-wider">Contact Info</p>
                      {[
                        { icon: Hash, label: 'Channel', val: selectedConv.channel_name || getChannelMeta(selectedConv.channel_type).label },
                        { icon: Phone, label: 'Phone', val: selectedConv.contact_phone },
                        { icon: Calendar, label: 'Last Active', val: selectedConv.last_message_at ? timeAgo(selectedConv.last_message_at) : '—' },
                        { icon: User, label: 'Assigned', val: selectedConv.assigned_to || '—' },
                      ].map(row => row.val && (
                        <div key={row.label} className="flex items-start gap-2.5">
                          <row.icon size={14} className="text-[#8a8d91] flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-[#8a8d91]">{row.label}</p>
                            <p className="text-[12px] font-semibold text-[#1c1e21]">{row.val}</p>
                          </div>
                        </div>
                      ))}
                      {selectedConv.lead_destination && (
                        <div className="flex items-start gap-2.5">
                          <span className="text-[16px] mt-0.5">{getCountryEmoji(selectedConv.lead_destination)}</span>
                          <div>
                            <p className="text-[10px] text-[#8a8d91]">Destination</p>
                            <p className="text-[12px] font-semibold text-[#1c1e21]">{selectedConv.lead_destination}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Lead status */}
                    {selectedConv.lead_id && (
                      <div className="p-4 border-b border-[#e4e6eb]">
                        <p className="text-[11px] font-bold text-[#8a8d91] uppercase tracking-wider mb-2">Lead Status</p>
                        <Link to={`/leads/${selectedConv.lead_id}`} className="flex items-center gap-2 p-2.5 bg-[#e7f3ff] hover:bg-[#d4e9ff] rounded-xl transition-colors">
                          <ClipboardList size={14} className="text-[#1877f2]" />
                          <span className="text-[12px] font-bold text-[#1877f2]">Lead #{selectedConv.lead_id}</span>
                          <ExternalLink size={11} className="text-[#1877f2] ml-auto" />
                        </Link>
                        {selectedConv.lead_status && (
                          <p className="text-[11px] text-[#8a8d91] mt-1.5 px-1">Status: <span className="font-semibold text-[#606770]">{selectedConv.lead_status}</span></p>
                        )}
                      </div>
                    )}

                    {/* Tags */}
                    <div className="p-4 border-b border-[#e4e6eb]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-bold text-[#8a8d91] uppercase tracking-wider">Tags</p>
                        <button onClick={() => setShowTagPicker(p => !p)} className="p-1 hover:bg-[#f0f2f5] rounded-full text-[#8a8d91] transition-colors"><Plus size={13} /></button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {contactTags.length === 0 && <p className="text-[12px] text-[#8a8d91]">No tags</p>}
                        {contactTags.map(tag => (
                          <span key={tag.id} className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: tag.color || '#64748b' }}>{tag.name}</span>
                        ))}
                      </div>
                      {showTagPicker && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {allTags.filter(t => !contactTags.some(ct => ct.id === t.id)).map(tag => (
                            <button key={tag.id} onClick={() => handleAddTag(tag.id)}
                              className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white opacity-60 hover:opacity-100 transition-opacity"
                              style={{ backgroundColor: tag.color || '#64748b' }}>{tag.name}</button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <div className="p-4">
                      <p className="text-[11px] font-bold text-[#8a8d91] uppercase tracking-wider mb-2">Notes</p>
                      <div className="space-y-2 mb-3">
                        {contactNotes.map(note => (
                          <div key={note.id} className="bg-[#f0f2f5] rounded-xl px-3 py-2">
                            <p className="text-[12px] text-[#1c1e21]">{note.text}</p>
                            <p className="text-[10px] text-[#8a8d91] mt-0.5">{timeAgo(note.created_at)}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note…"
                          onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }}
                          className="flex-1 bg-[#f0f2f5] rounded-full px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1877f2]/20 placeholder-[#8a8d91]" />
                        <button onClick={handleAddNote} disabled={addingNote || !newNote.trim()}
                          className="bg-[#1877f2] hover:bg-[#166fe5] disabled:opacity-40 text-white p-1.5 rounded-full transition-colors">
                          {addingNote ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* No conversation selected */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-[#8a8d91] bg-[#f0f2f5]">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm">
                <MessageSquare size={28} className="text-[#1877f2]" />
              </div>
              <div className="text-center">
                <p className="font-bold text-[15px] text-[#1c1e21]">Select a conversation</p>
                <p className="text-[13px] text-[#8a8d91] mt-1">Choose from the list to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ Lightbox ══ */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
          <button className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors" onClick={() => setLightboxImage(null)}><X size={20} /></button>
          <img src={lightboxImage} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* ══ Convert to Lead Modal ══ */}
      {showLeadModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setShowLeadModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#e4e6eb] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e4e6eb]">
              <h3 className="font-bold text-[15px] text-[#1c1e21]">Convert to Lead</h3>
              <button onClick={() => setShowLeadModal(false)} className="p-1.5 hover:bg-[#f0f2f5] rounded-full text-[#8a8d91] transition-colors"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2 mb-2">
                <button onClick={() => setLeadTab('new')} className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${leadTab === 'new' ? 'bg-[#1877f2] text-white' : 'bg-[#f0f2f5] text-[#606770]'}`}>Create New</button>
                <button onClick={() => setLeadTab('link')} className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${leadTab === 'link' ? 'bg-[#1877f2] text-white' : 'bg-[#f0f2f5] text-[#606770]'}`}>Link Existing</button>
              </div>
              {leadTab === 'new' ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[12px] font-semibold text-[#606770] mb-1 block">Client Name</label>
                    <input type="text" value={newLeadName} onChange={e => setNewLeadName(e.target.value)} placeholder="Full Name" className="w-full bg-[#f0f2f5] border-0 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1877f2]/20" />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-[#606770] mb-1 block">Phone Number</label>
                    <input type="text" value={newLeadPhone} onChange={e => setNewLeadPhone(e.target.value)} placeholder="+880..." className="w-full bg-[#f0f2f5] border-0 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1877f2]/20" />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[12px] font-semibold text-[#606770] mb-1 block">Destination</label>
                      <select value={newLeadDestination} onChange={e => setNewLeadDestination(e.target.value)}
                        className="w-full bg-[#f0f2f5] border-0 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1877f2]/20">
                        {['Bangladesh','China','Malta','Hungary','Greece','Estonia','Georgia','Malaysia','Thailand','Cyprus','UK','USA','Canada','Australia','Germany','France','India','Pakistan','Nepal','Italy'].map(d => (
                          <option key={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-[12px] font-semibold text-[#606770] mb-1 block">Degree</label>
                      <select value={newLeadDegree} onChange={e => setNewLeadDegree(e.target.value)}
                        className="w-full bg-[#f0f2f5] border-0 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1877f2]/20">
                        <option value="">Unknown</option>
                        {['Bachelors','Masters','PhD','Diploma','Language','MBBS'].map(d => (
                          <option key={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button disabled={convertingLead} onClick={handleConvertLead}
                    className="w-full bg-[#1877f2] hover:bg-[#166fe5] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-[13px] flex items-center justify-center gap-2 transition-colors">
                    {convertingLead ? <><Loader2 size={15} className="animate-spin" /> Creating…</> : <><UserPlus size={14} /> Create Lead</>}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-[#8a8d91]" size={13} />
                    <input type="text" placeholder="Search leads…" value={leadSearch} onChange={e => { setLeadSearch(e.target.value); setSelectedExistingLead(null); }}
                      className="w-full bg-[#f0f2f5] border-0 rounded-xl pl-9 pr-4 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1877f2]/20 placeholder-[#8a8d91]" />
                  </div>
                  {leadSearchResults.length > 0 && (
                    <div className="border border-[#e4e6eb] rounded-xl max-h-36 overflow-y-auto divide-y divide-[#f0f2f5]">
                      {leadSearchResults.map(lead => (
                        <button key={lead.id} onClick={() => setSelectedExistingLead(lead)}
                          className={`w-full text-left px-3 py-2.5 text-[13px] flex items-center justify-between hover:bg-[#f0f2f5] transition-colors ${selectedExistingLead?.id === lead.id ? 'bg-[#e7f3ff] border-l-2 border-[#1877f2]' : ''}`}>
                          <div>
                            <p className="font-bold text-[#1c1e21]">{lead.client_name}</p>
                            <p className="text-[11px] text-[#8a8d91]">#{lead.lead_id} · {lead.phone || 'No phone'}</p>
                          </div>
                          <span className="text-[10px] bg-[#f0f2f5] px-2 py-0.5 rounded font-semibold text-[#606770]">{lead.employee_name || lead.assigned_consultant || '—'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {leadSearch.length >= 2 && !leadSearchResults.length && <p className="text-center text-[12px] text-[#8a8d91] py-2">No leads found</p>}
                  <button disabled={convertingLead || !selectedExistingLead} onClick={handleConvertLead}
                    className="w-full bg-[#1877f2] hover:bg-[#166fe5] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-[13px] flex items-center justify-center transition-colors">
                    {convertingLead ? 'Linking…' : 'Link to Lead'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Quick Reply Manager Modal ══ */}
      {showQuickReplyModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setShowQuickReplyModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-[#e4e6eb] overflow-hidden max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e4e6eb] flex-shrink-0">
              <h3 className="font-bold text-[15px] text-[#1c1e21]">Quick Replies</h3>
              <button onClick={() => { setShowQuickReplyModal(false); setQuickReplyForm({ id: null, title: '', content: '', category: '' }); }} className="p-1.5 hover:bg-[#f0f2f5] rounded-full text-[#8a8d91]"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <form onSubmit={handleSaveQuickReply} className="bg-[#f0f2f5] rounded-xl p-4 space-y-3">
                <p className="text-[12px] font-bold text-[#606770]">{quickReplyForm.id ? 'Edit' : 'New'} Quick Reply</p>
                <input value={quickReplyForm.title} onChange={e => setQuickReplyForm(f => ({ ...f, title: e.target.value }))} placeholder="Title / shortcut…" required
                  className="w-full bg-white border border-[#e4e6eb] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1877f2]/20" />
                <textarea value={quickReplyForm.content} onChange={e => setQuickReplyForm(f => ({ ...f, content: e.target.value }))} placeholder="Reply content…" rows={3} required
                  className="w-full bg-white border border-[#e4e6eb] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1877f2]/20 resize-none" />
                <div className="flex gap-2">
                  <button type="submit" disabled={savingQuickReply}
                    className="flex-1 bg-[#1877f2] hover:bg-[#166fe5] disabled:opacity-50 text-white font-bold py-2 rounded-lg text-[13px] transition-colors">
                    {savingQuickReply ? 'Saving…' : quickReplyForm.id ? 'Update' : 'Add Reply'}
                  </button>
                  {quickReplyForm.id && <button type="button" onClick={() => setQuickReplyForm({ id: null, title: '', content: '', category: '' })} className="px-4 py-2 bg-[#f0f2f5] hover:bg-[#e4e6eb] text-[#606770] font-semibold rounded-lg text-[13px] transition-colors">Cancel</button>}
                </div>
              </form>
              <div className="space-y-2">
                {quickReplies.map(qr => (
                  <div key={qr.id} className="flex items-start gap-3 p-3 bg-[#f0f2f5] rounded-xl">
                    <Zap size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#1c1e21]">{qr.title}</p>
                      <p className="text-[12px] text-[#606770] truncate">{qr.content}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => setQuickReplyForm({ id: qr.id, title: qr.title, content: qr.content, category: qr.category || '' })} className="p-1.5 hover:bg-white rounded-lg text-[#8a8d91] transition-colors"><Edit2 size={13} /></button>
                      <button onClick={() => handleDeleteQuickReply(qr.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-[#8a8d91] hover:text-rose-500 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Template Manager Modal ══ */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setShowTemplateModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-[#e4e6eb] overflow-hidden max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e4e6eb] flex-shrink-0">
              <h3 className="font-bold text-[15px] text-[#1c1e21]">Message Templates</h3>
              <button onClick={() => { setShowTemplateModal(false); setTemplateForm({ id: null, name: '', content: '', category: 'general', language: 'en', variables: [] }); }} className="p-1.5 hover:bg-[#f0f2f5] rounded-full text-[#8a8d91]"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <form onSubmit={handleSaveTemplate} className="bg-[#f0f2f5] rounded-xl p-4 space-y-3">
                <p className="text-[12px] font-bold text-[#606770]">{templateForm.id ? 'Edit' : 'New'} Template</p>
                <input value={templateForm.name} onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))} placeholder="Template name…" required
                  className="w-full bg-white border border-[#e4e6eb] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1877f2]/20" />
                <textarea value={templateForm.content} onChange={e => setTemplateForm(f => ({ ...f, content: e.target.value }))} placeholder="Template content…" rows={4} required
                  className="w-full bg-white border border-[#e4e6eb] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1877f2]/20 resize-none" />
                <div className="flex gap-2">
                  <button type="submit" disabled={savingTemplate}
                    className="flex-1 bg-[#1877f2] hover:bg-[#166fe5] disabled:opacity-50 text-white font-bold py-2 rounded-lg text-[13px] transition-colors">
                    {savingTemplate ? 'Saving…' : templateForm.id ? 'Update' : 'Add Template'}
                  </button>
                  {templateForm.id && <button type="button" onClick={() => setTemplateForm({ id: null, name: '', content: '', category: 'general', language: 'en', variables: [] })} className="px-4 py-2 bg-[#f0f2f5] hover:bg-[#e4e6eb] text-[#606770] font-semibold rounded-lg text-[13px] transition-colors">Cancel</button>}
                </div>
              </form>
              <div className="space-y-2">
                {templates.map(t => (
                  <div key={t.id} className="flex items-start gap-3 p-3 bg-[#f0f2f5] rounded-xl">
                    <LayoutTemplate size={14} className="text-[#1877f2] flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#1c1e21]">{t.name}</p>
                      <p className="text-[12px] text-[#606770] truncate">{t.content}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => setTemplateForm({ id: t.id, name: t.name, content: t.content, category: t.category || 'general', language: t.language || 'en', variables: t.variables || [] })} className="p-1.5 hover:bg-white rounded-lg text-[#8a8d91] transition-colors"><Edit2 size={13} /></button>
                      <button onClick={() => handleDeleteTemplate(t.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-[#8a8d91] hover:text-rose-500 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

