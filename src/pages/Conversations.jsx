import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import { Link } from 'react-router-dom';
import { canViewAllConversations } from '../lib/roles';
import {
  MessageSquare, Search, Send, User, Phone, ExternalLink,
  Check, CheckCheck, AlertCircle, Archive, CheckCircle, RefreshCw, Trash2,
  Paperclip, Smile, FileText, X, ChevronRight, Info, Hash, Calendar, Inbox,
  Star, Tag, Plus, ClipboardList, UserPlus, Loader2, Music, Clock,
  Filter, ArrowLeft, Bell, LayoutTemplate,
  ChevronDown, Menu as MenuIcon
} from 'lucide-react';
import { timeAgo, initials } from '../lib/format';

/* ── helpers ── */
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
  const minutes = (Date.now() - new Date(lastMessageAt).getTime()) / 60000;
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
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  /* state */
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [channels, setChannels] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [allTags, setAllTags] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [updatingConv, setUpdatingConv] = useState(false);

  const [search, setSearch] = useState('');
  const [channelTab, setChannelTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  const [replyText, setReplyText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');

  const [showContactPanel, setShowContactPanel] = useState(true);
  const [contactNotes, setContactNotes] = useState([]);
  const [contactTags, setContactTags] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [showTagPicker, setShowTagPicker] = useState(false);
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
    return window.innerWidth < 1024;
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
      case 'unread': list = list.filter(c => c.unread_count > 0); break;
      case 'priority': list = list.filter(c => c.is_priority); break;
      case 'assigned_me': list = list.filter(c => c.assigned_to_id === user?.id); break;
      case 'no_lead': list = list.filter(c => !c.lead_id); break;
      case 'new_leads': list = list.filter(c => c.lead_id && c.lead_status === 'New Lead'); break;
      case 'archived': list = list.filter(c => c.status === 'archived'); break;
      default: list = list.filter(c => c.status !== 'archived'); break;
    }
    // sort: priority first, then unread, then last message time
    list.sort((a, b) => {
      if (a.is_priority !== b.is_priority) return b.is_priority ? 1 : -1;
      if ((a.unread_count || 0) !== (b.unread_count || 0)) return (b.unread_count || 0) - (a.unread_count || 0);
      return new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0);
    });
    return list;
  }, [conversations, channelTab, search, statusFilter, user?.id, isFullAccess, channels, isMyWhatsApp]);

  /* ── load helpers ── */
  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const p = { status: 'all', limit: 200, search: search.trim() || undefined };
      const res = await api.conversations(p);
      setConversations(res.conversations || []);
    } catch (err) {
      toast.error('Could not load conversations: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

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
    api.employees().then(setEmployees).catch(() => {});
  }, []);
  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (selectedConv) { loadMessages(selectedConv); loadContactDetails(selectedConv); }
    else { setMessages([]); setContactNotes([]); setContactTags([]); }
  }, [selectedConv, loadMessages, loadContactDetails]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    const timer = setInterval(() => { silentRefresh(); if (selectedConv) silentRefreshMessages(selectedConv); }, 10000);
    return () => clearInterval(timer);
  }, [selectedConv, silentRefresh, silentRefreshMessages]);

  useEffect(() => {
    const es = new EventSource('/api/events');
    es.addEventListener('new_message', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (selectedConv && data.conversation_id === selectedConv.id) {
          setMessages(prev => {
            if (prev.some(m => m.id === data.id || (data.wa_message_id && m.wa_message_id === data.wa_message_id))) return prev;
            return [...prev, data];
          });
          api.markConversationAsRead(selectedConv.id).catch(() => {});
          setSelectedConv(prev => prev ? { ...prev, unread_count: 0 } : null);
        }
        setConversations(prev => {
          const idx = prev.findIndex(c => c.id === data.conversation_id);
          if (idx === -1) {
            api.getConversation(data.conversation_id).then(conv => {
              if (conv) setConversations(cur => cur.some(c => c.id === conv.id) ? cur : [conv, ...cur]);
            }).catch(() => {});
            return prev;
          }
          const updated = [...prev];
          updated[idx] = { ...updated[idx], last_message: data.content, last_message_at: data.created_at, unread_count: (selectedConv && selectedConv.id === updated[idx].id) ? 0 : (updated[idx].unread_count + (data.direction === 'in' ? 1 : 0)) };
          return updated.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
        });
        if (!selectedConv || selectedConv.id !== data.conversation_id) {
          const meta = getChannelMeta(data.channel_type || 'whatsapp');
          toast.info(`New ${meta.label} message`, { duration: 3000 });
        }
      } catch (err) { console.error('SSE new_message error:', err); }
    });
    es.addEventListener('message_status', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (selectedConv) setMessages(prev => prev.map(m => m.wa_message_id === data.wa_message_id ? { ...m, status: data.status } : m));
      } catch (err) { console.error('SSE message_status error:', err); }
    });
    es.addEventListener('conversation_deleted', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (selectedConv && selectedConv.id === data.conversation_id) { setSelectedConv(null); toast.info('Conversation was deleted'); }
        setConversations(prev => prev.filter(c => c.id !== data.conversation_id));
      } catch (err) { console.error('SSE conversation_deleted error:', err); }
    });
    es.onerror = (err) => { console.error('SSE error:', err); };
    return () => { es.close(); };
  }, [selectedConv, toast]);

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
            return updated.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
          });
        }
      }
    } catch (err) { toast.error('Failed to send: ' + err.message); }
    finally { setSending(false); }
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

  const handleConvertLead = async () => {
    if (!selectedConv) return;
    setConvertingLead(true);
    try {
      if (leadTab === 'new') { const res = await api.convertLead(selectedConv.id, {}); toast.success('Lead created'); setSelectedConv(p => ({ ...p, lead_id: res.lead_id })); setConversations(p => p.map(c => c.id === selectedConv.id ? { ...c, lead_id: res.lead_id } : c)); }
      else if (selectedExistingLead) { await api.convertLead(selectedConv.id, { lead_id: selectedExistingLead.id }); toast.success('Linked to lead'); setSelectedConv(p => ({ ...p, lead_id: selectedExistingLead.id })); setConversations(p => p.map(c => c.id === selectedConv.id ? { ...c, lead_id: selectedExistingLead.id } : c)); setSelectedExistingLead(null); setLeadSearch(''); }
      setShowLeadModal(false);
    } catch (e) { toast.error(e.message); } finally { setConvertingLead(false); }
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
      const d = new Date(m.created_at);
      const dateStr = d.toDateString();
      if (dateStr !== lastDate) {
        const today = new Date(); const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        let label = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        if (dateStr === today.toDateString()) label = 'Today';
        else if (dateStr === yesterday.toDateString()) label = 'Yesterday';
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
    const all = channels.filter(c => c.type === 'whatsapp');
    if (isFullAccess) return all;
    if (isConsultant) return all.filter(c => isMyWhatsApp(c));
    return [];
  }, [channels, isFullAccess, isConsultant, isMyWhatsApp]);

  const otherChannels = useMemo(() => {
    return channels.filter(c => c.type !== 'whatsapp' && c.active !== 0);
  }, [channels]);

  const groupedChannels = useMemo(() => {
    const groups = [];
    const byType = {};
    otherChannels.forEach(c => {
      if (!byType[c.type]) byType[c.type] = [];
      byType[c.type].push(c);
    });
    Object.entries(byType).forEach(([type, list]) => {
      groups.push({ type, label: getChannelMeta(type).label, channels: list });
    });
    return groups;
  }, [otherChannels]);

  /* ── render ── */
  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-white overflow-hidden">
      {/* ════════════════════════════════════════════════════════════
          TOP HEADER BAR
      ════════════════════════════════════════════════════════════ */}
      <div className="h-14 border-b border-slate-200 bg-white flex items-center px-3 gap-3 flex-shrink-0 z-20">
        {/* Mobile menu toggle + title */}
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => setSidebarCollapsed(c => !c)} className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <MenuIcon size={18} />
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
            <Inbox size={14} />
          </div>
          <div className="min-w-0 hidden sm:block">
            <p className="text-sm font-bold text-slate-800 leading-tight">Chat Inbox</p>
            <p className="text-[10px] text-slate-400 font-medium">
              {totalUnread > 0 ? <span className="text-blue-600 font-bold">{totalUnread} unread</span> : 'All caught up'}
            </p>
          </div>
        </div>

        {/* Channel quick tabs (visible when no sidebar) */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0">
          {[
            { key: 'all', label: 'All', icon: Inbox, color: '#64748b' },
            { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: '#25d366' },
            { key: 'messenger', label: 'Messenger', icon: MessageSquare, color: '#0084ff' },
            { key: 'instagram', label: 'Instagram', icon: Star, color: '#d62976' },
            { key: 'tiktok', label: 'TikTok', icon: Music, color: '#000000' },
          ].map(tab => {
            const count = unreadCounts[tab.key] || 0;
            const isActive = channelTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setChannelTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 border ${isActive ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
                <tab.icon size={13} style={tab.key === 'all' ? {} : { color: isActive ? tab.color : undefined }} />
                {tab.label}
                {count > 0 && <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Search + Filter + Refresh */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-48 bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 transition-all placeholder-slate-400" />
          </div>
          <div className="relative">
            <button onClick={() => setFilterDropdownOpen(o => !o)} className={`p-2 rounded-lg transition-colors ${filterDropdownOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}>
              <Filter size={15} />
            </button>
            {filterDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFilterDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 min-w-[180px] py-1">
                  {FILTERS.map(f => (
                    <button key={f.key} onClick={() => { setStatusFilter(f.key); setFilterDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${statusFilter === f.key ? 'font-bold text-blue-700 bg-blue-50/50' : 'text-slate-600'}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={loadConversations} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors" title="Refresh">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          MAIN BODY: Sidebar + Conversation List + Chat + Contact Panel
      ════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── CHANNEL SIDEBAR ── */}
        <div className={`${sidebarCollapsed ? 'w-16' : 'w-56'} bg-slate-50 border-r border-slate-200 flex-shrink-0 flex flex-col transition-all duration-200 z-10`}>
          {/* Sidebar header */}
          <div className="h-11 flex items-center justify-between px-3 border-b border-slate-200/80 flex-shrink-0">
            {!sidebarCollapsed && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Channels</p>}
            <button onClick={() => setSidebarCollapsed(c => !c)} className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-600 transition-colors">
              {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {/* All Messages */}
            <button onClick={() => setChannelTab('all')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold transition-all outline-none border-l-[3px] ${channelTab === 'all' ? 'bg-blue-50/80 border-l-blue-600 text-blue-700' : 'border-l-transparent text-slate-600 hover:bg-slate-100'}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${channelTab === 'all' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                <Inbox size={14} />
              </div>
              {!sidebarCollapsed && (
                <span className="flex-1 text-left truncate">All Messages</span>
              )}
              {!sidebarCollapsed && unreadCounts.all > 0 && (
                <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{unreadCounts.all}</span>
              )}
              {sidebarCollapsed && unreadCounts.all > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500" />
              )}
            </button>

            {/* WhatsApp Section */}
            {whatsappChannels.length > 0 && (
              <div className="mt-1">
                <button onClick={() => toggleGroup('whatsapp')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:bg-slate-100 transition-colors">
                  {sidebarCollapsed ? (
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <MessageSquare size={14} />
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-left">WhatsApp</span>
                      {expandedGroups.whatsapp ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </>
                  )}
                </button>
                {(expandedGroups.whatsapp || sidebarCollapsed) && (
                  <div className="space-y-0.5">
                    {whatsappChannels.map(ch => {
                      const isActive = channelTab === `channel_${ch.id}`;
                      const unread = unreadCounts.byId?.[ch.id] || 0;
                      return (
                        <button key={ch.id} onClick={() => setChannelTab(`channel_${ch.id}`)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-all outline-none border-l-[3px] relative ${isActive ? 'bg-blue-50/80 border-l-blue-600 text-blue-700' : 'border-l-transparent text-slate-600 hover:bg-slate-100'}`}>
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black text-white flex-shrink-0 ${ch.color ? '' : 'bg-emerald-500'}`}
                            style={ch.color ? { backgroundColor: ch.color } : {}}>
                            W
                          </div>
                          {!sidebarCollapsed && (
                            <>
                              <span className="flex-1 text-left truncate">{ch.name || ch.consultant || 'WhatsApp'}</span>
                              {unread > 0 && (
                                <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{unread}</span>
                              )}
                            </>
                          )}
                          {sidebarCollapsed && unread > 0 && (
                            <span className="absolute top-0.5 right-1 w-2 h-2 rounded-full bg-blue-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Other channel types (Messenger, Instagram, TikTok, etc.) */}
            {groupedChannels.map(group => (
              <div key={group.type} className="mt-1">
                <button onClick={() => toggleGroup(group.type)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:bg-slate-100 transition-colors">
                  {sidebarCollapsed ? (
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: getChannelMeta(group.type).color + '15', color: getChannelMeta(group.type).color }}>
                      <ChannelIcon type={group.type} size={14} />
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-left">{group.label}</span>
                      {expandedGroups[group.type] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </>
                  )}
                </button>
                {(expandedGroups[group.type] || sidebarCollapsed) && (
                  <div className="space-y-0.5">
                    {group.channels.map(ch => {
                      const isActive = channelTab === `channel_${ch.id}` || channelTab === group.type;
                      const unread = unreadCounts.byId?.[ch.id] || 0;
                      return (
                        <button key={ch.id} onClick={() => setChannelTab(`channel_${ch.id}`)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-all outline-none border-l-[3px] relative ${isActive ? 'bg-blue-50/80 border-l-blue-600 text-blue-700' : 'border-l-transparent text-slate-600 hover:bg-slate-100'}`}>
                          <div className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black text-white flex-shrink-0"
                            style={{ backgroundColor: ch.color || getChannelMeta(group.type).color }}>
                            {getChannelMeta(group.type).icon}
                          </div>
                          {!sidebarCollapsed && (
                            <>
                              <span className="flex-1 text-left truncate">{ch.name || group.label}</span>
                              {unread > 0 && (
                                <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{unread}</span>
                              )}
                            </>
                          )}
                          {sidebarCollapsed && unread > 0 && (
                            <span className="absolute top-0.5 right-1 w-2 h-2 rounded-full bg-blue-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── CONVERSATION LIST ── */}
        <div className={`${selectedConv ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-88 flex-col bg-white border-r border-slate-200 flex-shrink-0`}>
          {/* Mobile search */}
          <div className="p-2 md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input type="text" placeholder="Search conversations…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 transition-all placeholder-slate-400" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-400">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-medium">Loading conversations…</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-1 px-4 text-center">
                <MessageSquare size={22} className="text-slate-200 mb-1" />
                <p className="text-xs font-bold text-slate-500">No conversations</p>
                <p className="text-[10px] text-slate-400">Adjust filters or search</p>
              </div>
            ) : (
              filteredConversations.map(conv => {
                const isSel = selectedConv?.id === conv.id;
                const meta = getChannelMeta(conv.channel_type);
                const sla = getSlaColor(conv.last_message_at);
                return (
                  <button key={conv.id} onClick={() => { setSelectedConv(conv); setShowMobileDrawer(false); }}
                    className={`w-full text-left px-3 py-3 flex gap-3 transition-all outline-none border-l-[3px] ${isSel ? 'bg-blue-50/60 border-l-blue-600' : 'bg-white hover:bg-slate-50/70 border-l-transparent'}`}>
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-sm bg-gradient-to-br ${getNameGradient(conv.contact_name)}`}>
                        {initials(conv.contact_name || 'C')}
                      </div>
                      <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-md flex items-center justify-center border-[1.5px] border-white text-[8px] font-black text-white shadow-sm ${meta.bg}`}>
                        {meta.icon}
                      </span>
                      {conv.is_priority && (
                        <span className="absolute -top-1 -right-1 text-amber-500"><Star size={10} fill="currentColor" /></span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <p className={`text-xs truncate ${conv.unread_count > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                            {conv.contact_name || conv.contact_phone || 'Contact'}
                          </p>
                          {conv.assigned_to && (
                            <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 truncate max-w-[80px]">
                              {initials(conv.assigned_to)}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0">{timeAgo(conv.last_message_at)}</span>
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
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[9px] font-bold uppercase tracking-wide truncate" style={{ color: conv.channel_color || meta.color }}>
                            {conv.channel_name || meta.label}
                          </span>
                          {(conv.tags || []).slice(0, 2).map(tag => (
                            <span key={tag.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0" style={{ backgroundColor: tag.color || '#64748b' }}>
                              {tag.name}
                            </span>
                          ))}
                          {(conv.tags || []).length > 2 && (
                            <span className="text-[9px] text-slate-400 font-medium">+{(conv.tags || []).length - 2}</span>
                          )}
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sla}`} title="SLA indicator" />
                        </div>
                        {conv.unread_count > 0 && (
                          <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center shadow-sm">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── CHAT THREAD ── */}
        <div className={`${selectedConv ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 bg-[#f0f4f8]`}>
          {selectedConv ? (
            <>
              {/* Chat Header */}
              <div className="h-14 px-4 bg-white flex items-center justify-between border-b border-slate-100 shadow-sm z-10 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setSelectedConv(null)} className="md:hidden p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                    <ArrowLeft size={18} />
                  </button>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0 bg-gradient-to-br ${getNameGradient(selectedConv.contact_name)}`}>
                    {initials(selectedConv.contact_name || 'C')}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-sm truncate">{selectedConv.contact_name || 'Contact'}</h3>
                      {selectedConv.is_priority && <Star size={13} className="text-amber-500 flex-shrink-0" fill="currentColor" />}
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white flex-shrink-0 ${getChannelMeta(selectedConv.channel_type).bg}`}>
                        {getChannelMeta(selectedConv.channel_type).label}
                      </span>
                      {selectedConv.assigned_to && (
                        <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 truncate max-w-[100px]">
                          <User size={9} className="inline mr-0.5" />{selectedConv.assigned_to}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1.5 font-medium">
                      {selectedConv.contact_phone && <><Phone size={9} />{selectedConv.contact_phone}</>}
                      {selectedConv.lead_id ? (
                        <><span className="text-slate-300">·</span><Link to={`/leads/${selectedConv.lead_id}`} className="text-blue-600 hover:underline inline-flex items-center gap-0.5 font-semibold">Lead #{selectedConv.lead_id} <ExternalLink size={9} /></Link></>
                      ) : (
                        <><span className="text-slate-300">·</span><button onClick={() => { setLeadTab('new'); setShowLeadModal(true); }} className="text-amber-600 hover:text-amber-700 font-semibold cursor-pointer">+ Convert to Lead</button></>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={handleTogglePriority} title={selectedConv.is_priority ? 'Remove priority' : 'Mark as priority'}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${selectedConv.is_priority ? 'bg-amber-50 text-amber-500' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}>
                    <Star size={16} />
                  </button>
                  <button onClick={() => setShowContactPanel(p => !p)} title="Contact info"
                    className={`hidden lg:flex p-2 rounded-lg transition-colors cursor-pointer ${showContactPanel ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}>
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
                  <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 scrollbar-thin"
                    style={{ backgroundImage: `radial-gradient(rgba(148,163,184,0.08) 1px,transparent 1px)`, backgroundSize: '20px 20px' }}>
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
                          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Use templates or type a message to start the conversation.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {groupMessagesByDate(messages).map(item => {
                          if (item.type === 'separator') return (
                            <div key={item.key} className="flex items-center gap-3 my-3">
                              <div className="flex-1 h-px bg-slate-200/70" />
                              <span className="text-[10px] font-bold text-slate-400 bg-white/80 border border-slate-200/60 px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">{item.label}</span>
                              <div className="flex-1 h-px bg-slate-200/70" />
                            </div>
                          );
                          const m = item.msg;
                          const isIn = m.direction === 'in' || m.direction === 'inbound';
                          const timeStr = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          return (
                            <div key={item.key} className={`flex ${isIn ? 'justify-start' : 'justify-end'} mb-1`}>
                              <div className={`max-w-[75%] lg:max-w-[65%] rounded-2xl px-4 py-2.5 shadow-sm border relative group flex flex-col gap-0.5
                                ${m.is_internal_note ? 'bg-amber-50 text-amber-900 rounded-tl-md border-amber-200 border-dashed' :
                                  isIn ? 'bg-white text-slate-800 rounded-tl-md border-slate-100/80' : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-md border-transparent'}`}>
                                {!isIn && m.sent_by && !m.is_internal_note && (
                                  <p className="text-[9px] text-sky-200/80 font-black tracking-wider uppercase mb-0.5">{m.sent_by}</p>
                                )}
                                {m.is_internal_note && (
                                  <p className="text-[9px] text-amber-600/80 font-black tracking-wider uppercase mb-0.5 flex items-center gap-1"><ClipboardList size={9} /> Internal Note</p>
                                )}
                                {m.type === 'image' && m.media_url && (
                                  <div className="mb-1 overflow-hidden rounded-xl">
                                    <img src={getMediaUrl(m)} alt="" className="max-w-full max-h-56 object-cover cursor-pointer rounded-xl hover:opacity-90 transition-opacity" onClick={() => setLightboxImage(getMediaUrl(m))} />
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
                                {(m.type === 'text' || !m.type || (!['image','document','audio','voice','video'].includes(m.type)) || (['image','video'].includes(m.type) && m.content && !['[Image]','[Video]'].includes(m.content) && m.content !== m.media_url)) && (
                                  <p className="text-xs leading-relaxed whitespace-pre-wrap font-medium">{m.content}</p>
                                )}
                                <div className={`flex items-center justify-end gap-1 text-[9px] font-semibold ${isIn ? 'text-slate-400' : 'text-sky-200/70'}`}>
                                  <span>{timeStr}</span>
                                  {m.source && !m.is_internal_note && (<span className="text-[8px] bg-slate-100/50 px-1 rounded">{m.source}</span>)}
                                  {!isIn && !m.is_internal_note && (m.status === 'read' ? <CheckCheck size={11} className="text-sky-300" /> : m.status === 'delivered' ? <CheckCheck size={11} className="text-white/60" /> : m.status === 'failed' ? <AlertCircle size={11} className="text-rose-300" /> : <Check size={11} className="text-white/60" />)}
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

                  {/* Templates */}
                  {templates.length > 0 && (
                    <div className="px-4 py-2 bg-white/80 border-t border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-none">
                      <button onClick={() => setShowTemplatePicker(o => !o)} className="text-[10px] font-bold text-slate-400 flex items-center gap-1 whitespace-nowrap hover:text-blue-600 transition-colors">
                        <LayoutTemplate size={11} /> Templates
                      </button>
                      {showTemplatePicker && (
                        <div className="relative flex items-center gap-2">
                          <input type="text" placeholder="Search templates…" value={templateSearch} onChange={e => setTemplateSearch(e.target.value)}
                            className="w-32 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500/20" />
                          {templates.filter(t => (t.name || '').toLowerCase().includes(templateSearch.toLowerCase())).slice(0, 5).map(t => (
                            <button key={t.id} onClick={() => handleSelectTemplate(t)} title={t.content}
                              className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200/80 px-3 py-1.5 rounded-lg hover:border-blue-500 hover:text-blue-600 whitespace-nowrap transition-all shadow-sm active:scale-95">
                              {t.name}
                            </button>
                          ))}
                        </div>
                      )}
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
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0" aria-label="Attach file">
                      <Paperclip size={17} />
                    </button>
                    <button type="button" onClick={() => setReplyText(p => p + '😊')} disabled={sending}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0" aria-label="Add emoji">
                      <Smile size={17} />
                    </button>
                    <textarea ref={textareaRef} value={replyText} onChange={e => setReplyText(e.target.value)}
                      placeholder={selectedFile ? 'Add a caption…' : 'Type a message…'}
                      rows={1}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      className="flex-1 bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/60 resize-none max-h-28 scrollbar-thin placeholder-slate-400 transition-all" />
                    <button type="submit" disabled={sending || uploading || (!replyText.trim() && !selectedFile)}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white p-2.5 rounded-xl shadow-md shadow-blue-500/15 transition-all flex-shrink-0 flex items-center justify-center active:scale-95" aria-label="Send message">
                      <Send size={15} />
                    </button>
                  </form>
                </div>

                {/* Right Panel — Contact Info */}
                {showContactPanel && (
                  <div className="hidden lg:flex w-72 border-l border-slate-200/80 bg-white flex-col overflow-y-auto scrollbar-thin flex-shrink-0">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-700">Contact Details</p>
                      <button onClick={() => setShowContactPanel(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><X size={13} /></button>
                    </div>
                    <div className="px-4 pt-4 pb-3 flex flex-col items-center gap-2 border-b border-slate-100">
                      <div className="relative">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow bg-gradient-to-br ${getNameGradient(selectedConv.contact_name)}`}>
                          {initials(selectedConv.contact_name || 'C')}
                        </div>
                        <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-md flex items-center justify-center border-[2px] border-white text-[9px] font-black text-white shadow-sm ${getChannelMeta(selectedConv.channel_type).bg}`}>
                          {getChannelMeta(selectedConv.channel_type).icon}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 text-center">{selectedConv.contact_name || 'Unknown'}</p>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full text-white ${selectedConv.status === 'open' ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                          {selectedConv.status === 'open' ? '● Open' : '● Archived'}
                        </span>
                        {selectedConv.is_priority && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                            <Star size={9} fill="currentColor" /> Priority
                          </span>
                        )}
                      </div>
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
                          <p className="text-xs font-bold text-slate-700 mt-0.5">{selectedConv.channel_name || getChannelMeta(selectedConv.channel_type).label}</p>
                          <p className="text-[10px] text-slate-400 capitalize">{selectedConv.channel_type}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5"><Calendar size={12} className="text-slate-500" /></div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Last message</p>
                          <p className="text-xs font-bold text-slate-700 mt-0.5">{selectedConv.last_message_at ? new Date(selectedConv.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</p>
                        </div>
                      </div>
                      {selectedConv.assigned_to && (
                        <div className="flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5"><UserPlus size={12} className="text-blue-500" /></div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Assigned To</p>
                            <p className="text-xs font-bold text-slate-700 mt-0.5">{selectedConv.assigned_to}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Lead Status */}
                    <div className="px-4 py-3 border-t border-slate-100">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Lead Status</p>
                      {selectedConv.lead_id ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">{selectedConv.lead_status || 'Lead'}</span>
                            <Link to={`/leads/${selectedConv.lead_id}`} className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-0.5">
                              View <ExternalLink size={10} />
                            </Link>
                          </div>
                          {(selectedConv.lead_employee_name || selectedConv.lead_assigned_consultant) && (
                            <p className="text-[10px] text-slate-500">
                              Consultant: <span className="font-semibold text-slate-700">{selectedConv.lead_employee_name || selectedConv.lead_assigned_consultant}</span>
                              {selectedConv.lead_destination && <> · Destination: <span className="font-semibold text-slate-700">{selectedConv.lead_destination}</span></>}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 inline-block">New Prospect</span>
                          <button onClick={() => { setLeadTab('new'); setShowLeadModal(true); }}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-2 rounded-xl transition-colors shadow-sm">
                            Convert to Lead
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Tags */}
                    <div className="px-4 py-3 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Tags</p>
                        <button onClick={() => setShowTagPicker(p => !p)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"><Plus size={12} /></button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {contactTags.length === 0 && (<p className="text-[10px] text-slate-400 italic">No tags</p>)}
                        {contactTags.map(tag => (
                          <span key={tag.id} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full text-white" style={{ backgroundColor: tag.color || '#64748b' }}>
                            {tag.name}
                            <button onClick={() => handleRemoveTag(tag.id)} className="hover:bg-white/20 rounded-full p-0.5 transition-colors"><X size={9} /></button>
                          </span>
                        ))}
                      </div>
                      {showTagPicker && (
                        <div className="mt-2 bg-slate-50 rounded-xl border border-slate-200 p-2 max-h-32 overflow-y-auto">
                          <p className="text-[10px] text-slate-400 font-medium mb-1">Click to add:</p>
                          <div className="flex flex-wrap gap-1">
                            {allTags.filter(t => !contactTags.some(ct => String(ct.id) === String(t.id))).map(tag => (
                              <button key={tag.id} onClick={() => handleAddTag(tag.id)}
                                className="text-[10px] font-bold px-2 py-1 rounded-full text-white hover:opacity-80 transition-opacity" style={{ backgroundColor: tag.color || '#64748b' }}>
                                {tag.name}
                              </button>
                            ))}
                            {allTags.filter(t => !contactTags.some(ct => String(ct.id) === String(t.id))).length === 0 && (
                              <p className="text-[10px] text-slate-400">All tags applied</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Internal Notes */}
                    <div className="px-4 py-3 border-t border-slate-100">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Internal Notes</p>
                      <div className="space-y-2 max-h-40 overflow-y-auto mb-2">
                        {contactNotes.length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic">No notes yet</p>
                        ) : contactNotes.map(note => (
                          <div key={note.id} className="bg-amber-50/60 border border-amber-100/60 rounded-xl p-2.5">
                            <p className="text-[11px] text-slate-700 leading-relaxed">{note.text}</p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="text-[9px] text-amber-600 font-bold">{note.author || 'Team'}</span>
                              <span className="text-[9px] text-slate-400">·</span>
                              <span className="text-[9px] text-slate-400">{new Date(note.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-end gap-2">
                        <textarea value={newNote} onChange={e => setNewNote(e.target.value)} rows={2}
                          placeholder="Add a note…"
                          className="flex-1 bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/60 resize-none placeholder-slate-400 transition-all" />
                        <button onClick={handleAddNote} disabled={addingNote || !newNote.trim()}
                          className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white p-2 rounded-xl shadow-sm transition-all flex-shrink-0">
                          {addingNote ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        </button>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="px-4 pb-4 flex flex-col gap-2 border-t border-slate-100 pt-3">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Quick Actions</p>
                      <button onClick={handleAssignToMe} disabled={updatingConv}
                        className="flex items-center justify-between bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50">
                        <span className="flex items-center gap-2"><UserPlus size={13} /> Assign to Me</span><ChevronRight size={13} />
                      </button>
                      <button onClick={handleTogglePriority} disabled={updatingConv}
                        className="flex items-center justify-between bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50">
                        <span className="flex items-center gap-2"><Star size={13} /> {selectedConv.is_priority ? 'Remove Priority' : 'Mark as Priority'}</span><ChevronRight size={13} />
                      </button>
                      <button onClick={() => handleToggleArchive(selectedConv)}
                        className="flex items-center justify-between bg-slate-50 hover:bg-slate-100 text-slate-600 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors">
                        <span className="flex items-center gap-2"><Archive size={13} /> {selectedConv.status === 'archived' ? 'Reopen' : 'Archive'}</span><ChevronRight size={13} />
                      </button>
                      {!selectedConv.lead_id && (
                        <button onClick={() => { setLeadTab('new'); setShowLeadModal(true); }}
                          className="flex items-center justify-between bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors">
                          <span className="flex items-center gap-2"><UserPlus size={13} /> Move to Lead</span><ChevronRight size={13} />
                        </button>
                      )}
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
                    { icon: Bell, label: 'Real-time', sub: 'SSE + Polling', iconColor: 'text-indigo-500', bg: 'bg-indigo-50' },
                  ].map(({ icon: Icon, label, sub, iconColor, bg, pulse }) => (
                    <div key={label} className="bg-white rounded-2xl border border-slate-200/60 p-4 flex flex-col items-center gap-2 shadow-sm">
                      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                        <Icon size={18} className={iconColor} />
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
                      <p className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                        {pulse && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}{sub}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center mb-4">
                  <Inbox size={22} className="text-blue-600" />
                </div>
                <h2 className="text-base font-bold text-slate-800">Unified Inbox</h2>
                <p className="text-slate-400 text-xs mt-2 leading-relaxed">Select a conversation to start chatting. All channels in one place.</p>
                <div className="mt-6 text-slate-400 text-[10px] font-semibold bg-white/80 px-4 py-1.5 rounded-full border border-slate-200/50 shadow-sm">
                  EduExpress CRM · Unified Inbox v4.0
                </div>
              </div>
            </div>
          )}
        </div>
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
              {[{ id: 'new', label: 'Create New' }, { id: 'link', label: 'Link Existing' }].map(t => (
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
                </div>
                <button type="button" disabled={convertingLead} onClick={handleConvertLead}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
                  {convertingLead ? 'Creating…' : 'Create Lead'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                <p className="text-xs text-slate-500">Link this conversation to an existing lead.</p>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={13} />
                  <input type="text" placeholder="Search name, phone…" value={leadSearch} onChange={e => { setLeadSearch(e.target.value); setSelectedExistingLead(null); }}
                    className="w-full bg-slate-50 border border-slate-200/70 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 placeholder-slate-400" />
                </div>
                {leadSearchResults.length > 0 && (
                  <div className="border border-slate-100 rounded-xl max-h-36 overflow-y-auto divide-y divide-slate-50 bg-white scrollbar-thin">
                    {leadSearchResults.map(lead => (
                      <button type="button" key={lead.id} onClick={() => setSelectedExistingLead(lead)}
                        className={`w-full text-left px-3 py-2.5 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${selectedExistingLead?.id === lead.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''}`}>
                        <div>
                          <p className="font-bold text-slate-800">{lead.client_name}</p>
                          <p className="text-[10px] text-slate-400">#{lead.lead_id} · {lead.phone || 'No phone'}</p>
                        </div>
                        <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-500">{lead.employee_name || lead.assigned_consultant || '—'}</span>
                      </button>
                    ))}
                  </div>
                )}
                {leadSearch.length >= 2 && !leadSearchResults.length && <p className="text-center text-xs text-slate-400 py-2">No leads found</p>}
                {selectedExistingLead && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs">
                    <p className="font-bold text-blue-700 mb-1">Selected: {selectedExistingLead.client_name}</p>
                    <p className="text-slate-600">Lead #{selectedExistingLead.lead_id} · {selectedExistingLead.employee_name || selectedExistingLead.assigned_consultant || 'Unassigned'}</p>
                  </div>
                )}
                <button type="button" disabled={convertingLead || !selectedExistingLead} onClick={handleConvertLead}
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
