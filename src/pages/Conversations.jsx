import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import {
  MessageSquare, Search, Send, Clock, User, Phone, Mail, ExternalLink,
  Check, CheckCheck, AlertCircle, Sparkles, Filter, Archive, CheckCircle, RefreshCw, Trash2,
  Paperclip, Smile, Image, FileText, X, Lock, ChevronDown, Pin, MoreVertical, Eye
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
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread' | 'whatsapp' | 'messenger' | 'instagram'

  // Media upload and lightbox state
  const [lightboxImage, setLightboxImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null); // { name, type, mediaUrl, relativeUrl, previewUrl }
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Compose message state
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

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
      const res = await api.conversations(p);
      setConversations(res.conversations || []);
    } catch (err) {
      toast.error('Could not load conversations: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, channelFilter, search, toast]);

  // Load message thread
  const loadMessages = useCallback(async (conv) => {
    if (!conv) return;
    setLoadingMessages(true);
    try {
      const res = await api.messages(conv.id);
      setMessages(res || []);
      // Mark as read/clear unread count locally and on server
      if (conv.unread_count > 0) {
        await api.markConversationAsRead(conv.id);
        setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
      }
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
  }, [statusFilter, channelFilter, search]);

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
      // Also check if there were unread messages that we should clear
      if (conv.unread_count > 0) {
        await api.markConversationAsRead(conv.id);
        setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
      }
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
        // If it belongs to currently selected conversation, append it
        if (selectedConv && data.conversation_id === selectedConv.id) {
          setMessages(prev => {
            // Avoid duplicate appends
            if (prev.some(m => m.id === data.id || (data.wa_message_id && m.wa_message_id === data.wa_message_id))) {
              return prev;
            }
            return [...prev, data];
          });
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
    if (activeTab === 'whatsapp') return c.channel_type === 'whatsapp';
    if (activeTab === 'messenger') return c.channel_type === 'messenger';
    if (activeTab === 'instagram') return c.channel_type === 'instagram';
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-120px)] bg-slate-50 border border-slate-200/80 rounded-2xl overflow-hidden shadow-xl select-none animate-scale-in">
      
      {/* 1. Left Sidebar: Conversations List */}
      <div className="w-80 md:w-96 flex flex-col bg-white border-r border-slate-100 flex-shrink-0">
        
        {/* Sidebar Header */}
        <div className="h-16 px-4 bg-slate-50/50 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-500/20">
              {(user?.name || 'A').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Agent</p>
              <p className="text-xs font-bold text-slate-700 truncate max-w-[130px]">{user?.name || user?.email || 'Admin'}</p>
            </div>
          </div>
          
          <button 
            onClick={loadConversations} 
            className="p-2 hover:bg-slate-100 active:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-700 transition-colors cursor-pointer" 
            title="Reload list"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Search bar & Filter Pills */}
        <div className="p-3 border-b border-slate-100 bg-white flex flex-col gap-2.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/60 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/15 focus:border-blue-600 transition-all placeholder-slate-400"
            />
          </div>

          {/* Client-side Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: 'Unread' },
              { id: 'whatsapp', label: 'WhatsApp' },
              { id: 'messenger', label: 'Messenger' },
              { id: 'instagram', label: 'Instagram' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-[11px] px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* List of Conversations */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100/60 bg-white scrollbar-thin">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2.5 text-slate-400">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Loading inbox...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 p-6 text-center">
              <MessageSquare size={28} className="text-slate-200 mb-2" />
              <p className="font-bold text-slate-600 text-xs">No conversations found</p>
              <p className="text-[10px] mt-1 text-slate-400">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isSelected = selectedConv?.id === conv.id;
              const isWhatsApp = conv.channel_type === 'whatsapp';
              const isMessenger = conv.channel_type === 'messenger';
              const isInstagram = conv.channel_type === 'instagram';
              const lastTime = formatTime(conv.last_message_at);

              // Dynamic pastel gradient selection based on name hash for premium avatar presentation
              const getNameColor = (name) => {
                if (!name) return 'from-slate-400 to-slate-500';
                const charCodeSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const gradients = [
                  'from-blue-400 to-indigo-500',
                  'from-purple-400 to-pink-500',
                  'from-emerald-400 to-teal-500',
                  'from-amber-400 to-orange-500',
                  'from-sky-400 to-blue-500',
                  'from-rose-400 to-red-500',
                  'from-violet-400 to-purple-500'
                ];
                return gradients[charCodeSum % gradients.length];
              };

              const avatarGradient = getNameColor(conv.contact_name);

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={`w-full text-left px-4 py-3.5 flex gap-3.5 transition-all outline-none border-l-4 border-b border-slate-50
                    ${isSelected 
                      ? 'bg-slate-50 border-l-blue-600' 
                      : 'bg-white hover:bg-slate-50/50 border-l-transparent'}`}
                >
                  {/* Avatar & Channel Badge */}
                  <div className="relative flex-shrink-0 select-none">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm bg-gradient-to-br ${avatarGradient}`}>
                      {String(conv.contact_name || 'C').split(' ').filter(Boolean).map(s => s[0] || '').slice(0, 2).join('').toUpperCase()}
                    </div>
                    {/* Tiny Channel Badge */}
                    <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-lg flex items-center justify-center border border-white text-[9px] font-black text-white shadow-sm
                      ${isWhatsApp ? 'bg-[#25d366]' : isMessenger ? 'bg-[#0084ff]' : 'bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#962fbf]'}`} title={conv.channel_type}>
                      {isWhatsApp ? 'W' : isMessenger ? 'F' : 'I'}
                    </span>
                  </div>

                  {/* Snippet Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div className="flex justify-between items-baseline gap-1">
                      <p className={`text-xs truncate ${conv.unread_count > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                        {conv.contact_name || conv.contact_phone || 'Meta Contact'}
                      </p>
                      {lastTime && <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{lastTime}</span>}
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                      {/* Checkmarks inside sidebar list */}
                      {!conv.unread_count && conv.last_message_direction === 'out' && (
                        <span className="flex-shrink-0">
                          {conv.last_message_status === 'read' ? (
                            <CheckCheck size={12} className="text-sky-400" />
                          ) : conv.last_message_status === 'delivered' ? (
                            <CheckCheck size={12} className="text-slate-400" />
                          ) : conv.last_message_status === 'failed' ? (
                            <AlertCircle size={12} className="text-rose-500" />
                          ) : (
                            <Check size={12} className="text-slate-400" />
                          )}
                        </span>
                      )}
                      
                      <p className={`text-xs truncate flex-1 ${conv.unread_count > 0 ? 'font-bold text-slate-800' : 'text-slate-400 font-medium'}`}>
                        {conv.last_message || 'No messages yet'}
                      </p>
                    </div>

                    {/* Unread count & channel tag name */}
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded bg-slate-50 truncate max-w-[150px]" style={{ color: conv.channel_color || '#3b82f6' }}>
                        {conv.channel_name || conv.channel_type}
                      </span>
                      {conv.unread_count > 0 && (
                        <span className="bg-blue-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-full min-w-4 text-center shadow-sm shadow-blue-500/20">
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

      {/* 2. Main Pane: Chat Window */}
      <div className="flex-1 flex flex-col bg-[#f8fafc] min-w-0 relative">
        {selectedConv ? (
          <>
            {/* Chat Pane Header */}
            <div className="h-16 px-6 bg-white flex items-center justify-between border-b border-slate-100 shadow-sm z-10">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-sm
                  ${selectedConv.channel_type === 'whatsapp' ? 'bg-[#25d366]' : 'bg-[#0084ff]'}`}>
                  {String(selectedConv.contact_name || 'C').split(' ').filter(Boolean).map(s => s[0] || '').slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-800 text-xs truncate">
                    {selectedConv.contact_name || 'Meta Contact'}
                  </h3>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1.5 font-semibold mt-0.5">
                    {selectedConv.channel_type === 'whatsapp' ? (
                      <>
                        <Phone size={10} className="text-slate-400" /> {selectedConv.contact_phone}
                      </>
                    ) : (
                      <>
                        <Mail size={10} className="text-slate-400" /> Messenger
                      </>
                    )}
                    {selectedConv.lead_id ? (
                      <>
                        <span className="text-slate-300">•</span>
                        <Link to={`/leads/${selectedConv.lead_id}`} className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-0.5 font-bold bg-blue-50/80 px-1.5 py-0.5 rounded text-[9px]">
                          Lead ID: {selectedConv.lead_id} <ExternalLink size={9} />
                        </Link>
                      </>
                    ) : (
                      <>
                        <span className="text-slate-300">•</span>
                        <button
                          onClick={() => {
                            setLeadTab('new');
                            setShowLeadModal(true);
                          }}
                          className="text-amber-600 hover:text-amber-800 inline-flex items-center gap-0.5 font-bold bg-amber-50/80 px-1.5 py-0.5 rounded text-[9px] cursor-pointer"
                        >
                          Convert to Lead
                        </button>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Chat Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleToggleArchive(selectedConv)}
                  className="p-2 hover:bg-slate-50 active:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                  title={selectedConv.status === 'archived' ? 'Reopen Conversation' : 'Archive Conversation'}
                >
                  <Archive size={16} />
                </button>
                <button
                  onClick={() => handleDeleteConversation(selectedConv)}
                  className="p-2 hover:bg-slate-50 active:bg-rose-55 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                  title="Delete Conversation"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Chat Pane Messages Area with modern dotted radial wallpaper */}
            <div 
              className="flex-1 overflow-y-auto px-6 py-5 space-y-4 scrollbar-thin flex flex-col"
              style={{
                backgroundColor: '#f8fafc',
                backgroundImage: `radial-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1.2px)`,
                backgroundSize: '16px 16px'
              }}
            >
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center m-auto gap-2 text-slate-400">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-semibold text-slate-500">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center m-auto text-slate-400 text-xs bg-white/80 px-6 py-5 rounded-2xl shadow-sm border border-slate-100 text-center max-w-xs animate-scale-in">
                  <p className="font-bold text-slate-700">No messages in this chat</p>
                  <p className="text-[10px] text-slate-400 mt-1">Send a welcome message or quick template reply below to start the thread.</p>
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isInbound = m.direction === 'in' || m.direction === 'inbound';
                  const timeStr = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <div key={m.id || idx} className={`flex ${isInbound ? 'justify-start' : 'justify-end'} animate-fade-in`}>
                      {/* Premium bubble with border-radius layouts */}
                      <div 
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm border relative group flex flex-col gap-1
                          ${isInbound 
                            ? 'bg-white text-slate-800 rounded-tl-sm border-slate-100' 
                            : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-sm border-transparent'}`}
                      >
                        {/* Outbound sender attribution */}
                        {!isInbound && m.sent_by && (
                          <p className="text-[9px] text-sky-200/90 font-black tracking-wide uppercase self-start mb-0.5">
                            {m.sent_by}
                          </p>
                        )}

                        {/* 1. Image Render */}
                        {m.type === 'image' && m.media_url && (
                          <div className="mb-1.5 max-w-full overflow-hidden rounded-xl bg-slate-900/5 border border-slate-900/5">
                            <img
                              src={getMediaUrl(m)}
                              alt="Attachment Image"
                              className="max-w-full h-auto object-cover max-h-[260px] cursor-pointer hover:opacity-95 transition-opacity"
                              onClick={() => setLightboxImage(getMediaUrl(m))}
                            />
                            <div className="p-2 px-3 text-right bg-slate-50/85 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-[9px] font-semibold text-slate-400">Attached image</span>
                              <a
                                href={getMediaUrl(m)}
                                download={`image_${m.id}.jpg`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline inline-block"
                              >
                                Download
                              </a>
                            </div>
                          </div>
                        )}

                        {/* 2. Document Render */}
                        {m.type === 'document' && m.media_url && (
                          <div className={`mb-1.5 p-3 rounded-xl flex items-center gap-3 border max-w-sm
                            ${isInbound 
                              ? 'bg-slate-50 border-slate-100 text-slate-800' 
                              : 'bg-white/10 border-white/10 text-white'}`}>
                            <FileText className={isInbound ? 'text-slate-400' : 'text-sky-200'} size={22} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold truncate">
                                {m.content || 'Document Attachment'}
                              </p>
                              <a
                                href={getMediaUrl(m)}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className={`text-[10px] font-bold underline inline-block mt-0.5
                                  ${isInbound ? 'text-blue-600 hover:text-blue-800' : 'text-sky-200 hover:text-white'}`}
                              >
                                Download document
                              </a>
                            </div>
                          </div>
                        )}

                        {/* 3. Audio / Voice Render */}
                        {(m.type === 'audio' || m.type === 'voice') && (
                          <div className={`mb-1.5 p-2 rounded-xl flex items-center gap-3 border max-w-xs
                            ${isInbound ? 'bg-slate-50 border-slate-100' : 'bg-white/10 border-white/10'}`}>
                            <audio controls className="h-8 w-full max-w-[200px]" src={getMediaUrl(m)} />
                          </div>
                        )}

                        {/* 4. Video Render */}
                        {m.type === 'video' && (
                          <div className="mb-1.5 max-w-full overflow-hidden rounded-xl bg-slate-900/5 border border-slate-900/5 max-w-sm">
                            <video controls className="max-w-full h-auto object-cover max-h-[260px]" src={getMediaUrl(m)} />
                            <div className="p-2 px-3 text-right bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-[9px] font-semibold text-slate-400">Attached video</span>
                              <a
                                href={getMediaUrl(m)}
                                download={`video_${m.id}.mp4`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline inline-block"
                              >
                                Download
                              </a>
                            </div>
                          </div>
                        )}

                        {/* 5. Text Message content */}
                        {(m.type === 'text' || !m.type || 
                          (m.type !== 'image' && m.type !== 'document' && m.type !== 'audio' && m.type !== 'voice' && m.type !== 'video') || 
                          ((m.type === 'image' || m.type === 'video') && m.content && m.content !== m.media_url && m.content !== '[Image]' && m.content !== '[Video]')) && (
                          <p className="text-xs leading-relaxed whitespace-pre-wrap font-medium">{m.content}</p>
                        )}
                        
                        {/* Time & Delivery Receipt Status Ticks */}
                        <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] font-semibold self-end select-none
                          ${isInbound ? 'text-slate-400' : 'text-sky-200/80'}`}>
                          <span>{timeStr}</span>
                          {!isInbound && (
                            <span className="flex-shrink-0">
                              {m.status === 'read' ? (
                                <CheckCheck size={12} className="text-sky-300" title="Read" />
                              ) : m.status === 'delivered' ? (
                                <CheckCheck size={12} className="text-white/70" title="Delivered" />
                              ) : m.status === 'failed' ? (
                                <AlertCircle size={12} className="text-rose-400" title="Failed" />
                              ) : (
                                <Check size={12} className="text-white/70" title="Sent" />
                              )}
                            </span>
                          )}
                        </div>

                        {/* Hover Tooltip for failures */}
                        {m.status === 'failed' && m.error_msg && (
                          <div className="absolute right-0 -bottom-8 bg-slate-800 text-white text-[9px] px-2.5 py-1 rounded-lg shadow-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap border border-slate-700">
                            ⚠️ {m.error_msg}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick replies templates toolbar */}
            {quickReplies.length > 0 && (
              <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-xs whitespace-nowrap scrollbar-none select-none">
                <span className="text-slate-400 font-bold flex items-center gap-1.5 text-[10px] uppercase tracking-wide">
                  <Sparkles size={12} className="text-amber-500" /> Templates:
                </span>
                {quickReplies.slice(0, 5).map(reply => (
                  <button
                    key={reply.id}
                    onClick={() => setReplyText(reply.content)}
                    className="bg-white border border-slate-200/60 text-slate-600 px-3 py-1.5 rounded-lg hover:border-blue-500 hover:text-blue-600 transition-all font-semibold cursor-pointer text-[11px] shadow-sm active:scale-95 animate-fade-in"
                    title={reply.content}
                  >
                    {reply.title}
                  </button>
                ))}
              </div>
            )}

            {/* Inline selected attachment preview bar */}
            {selectedFile && (
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between animate-fade-in select-none">
                <div className="flex items-center gap-3">
                  {selectedFile.type === 'image' ? (
                    <div className="relative w-12 h-12 rounded-lg border border-slate-200 overflow-hidden flex-shrink-0 bg-white shadow-sm">
                      <img src={selectedFile.previewUrl} alt="Upload preview" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm border border-blue-100">
                      <FileText size={22} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate max-w-[200px] md:max-w-xs">{selectedFile.name}</p>
                    <p className="text-[10px] text-blue-600 font-semibold mt-0.5">Ready to attach file</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1.5 hover:bg-slate-200/80 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Remove attachment"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Uploading progress message */}
            {uploading && (
              <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center gap-2.5 text-slate-500 text-xs font-semibold select-none">
                <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-[11px] text-slate-400">Uploading media attachment...</span>
              </div>
            )}

            {/* Chat Pane Composer Area */}
            <form onSubmit={handleSend} className="p-3.5 bg-white border-t border-slate-100 flex gap-2.5 items-center">
              
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={handleFileChange}
              />

              {/* Attachment Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-slate-50 active:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                title="Attach Document or Image"
                disabled={sending || uploading}
              >
                <Paperclip size={18} />
              </button>

              {/* Emoji Button */}
              <button
                type="button"
                onClick={() => setReplyText(prev => prev + '😊')}
                className="p-2 hover:bg-slate-50 active:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                title="Insert Emoji"
                disabled={sending}
              >
                <Smile size={18} />
              </button>

              {/* Composer input textarea */}
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={selectedFile ? "Add a caption..." : "Type your message..."}
                rows={1}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1 bg-slate-50 border border-slate-200/50 rounded-xl px-4 py-2 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600/50 resize-none max-h-24 scrollbar-thin placeholder-slate-400 transition-all"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={sending || uploading || (!replyText.trim() && !selectedFile)}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white p-2.5 rounded-xl shadow-md shadow-blue-500/10 transition-all flex-shrink-0 cursor-pointer flex items-center justify-center active:scale-95"
              >
                <Send size={15} />
              </button>
            </form>
          </>
        ) : (
          /* Empty Splash State: Professional Dashboard Console */
          <div className="flex-1 flex flex-col bg-slate-50/50 select-none items-center justify-center p-8 text-center animate-fade-in">
            <div className="max-w-xl w-full flex flex-col items-center">
              
              {/* Premium Dashboard Metrics Panel */}
              <div className="w-full grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                
                {/* Metric 1: Connection status */}
                <div className="bg-white p-4.5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                    <CheckCircle size={20} className="text-emerald-500" />
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Webhooks Status</p>
                  <p className="text-xs font-bold text-slate-700 mt-1 flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Connected
                  </p>
                </div>

                {/* Metric 2: Channels */}
                <div className="bg-white p-4.5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                    <MessageSquare size={20} className="text-blue-500" />
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Channels</p>
                  <p className="text-xs font-bold text-slate-700 mt-1">3 Integrations</p>
                </div>

                {/* Metric 3: Encryption */}
                <div className="bg-white p-4.5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col items-center justify-center col-span-2 md:col-span-1">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                    <Lock size={18} className="text-indigo-500" />
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Data Security</p>
                  <p className="text-xs font-bold text-slate-700 mt-1">Meta API Secured</p>
                </div>

              </div>

              {/* Title & Help Tip */}
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center mb-4">
                <MessageSquare size={20} />
              </div>
              <h2 className="text-base font-bold text-slate-800">EduExpress Live Chat Console</h2>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed max-w-sm">
                Select a conversation from the left sidebar to start collaborating. Send text, templates, and media attachments to your leads in real-time.
              </p>
              
              <div className="flex items-center gap-1.5 mt-8 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-white px-4 py-2 rounded-full border border-slate-200/50 shadow-sm">
                <span>Core System Version 2.4.1</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setLightboxImage(null)}>
          <button 
            className="absolute top-4 right-4 text-white hover:text-slate-300 p-2 cursor-pointer transition-colors bg-white/10 hover:bg-white/20 rounded-lg" 
            onClick={() => setLightboxImage(null)}
          >
            <X size={20} />
          </button>
          <img src={lightboxImage} alt="Preview" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-scale-in" />
        </div>
      )}

      {/* Convert to Lead Modal */}
      {showLeadModal && selectedConv && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 animate-scale-in border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <User className="text-blue-600" size={18} /> Convert to Lead
              </h3>
              <button 
                onClick={() => { setShowLeadModal(false); setSelectedExistingLead(null); setLeadSearch(''); }} 
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-100/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setLeadTab('new')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${leadTab === 'new' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Create New Lead
              </button>
              <button
                type="button"
                onClick={() => setLeadTab('link')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${leadTab === 'link' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Link Existing Lead
              </button>
            </div>

            {leadTab === 'new' ? (
              <div className="flex flex-col gap-3.5 py-1">
                <p className="text-xs text-slate-500 leading-relaxed">
                  This will create a new CRM lead for <strong className="text-slate-700">{selectedConv.contact_name || 'this contact'}</strong> with source <strong className="text-slate-700">{selectedConv.channel_type}</strong>.
                </p>
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col gap-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400 font-medium">Name:</span> <span className="font-bold text-slate-700">{selectedConv.contact_name || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 font-medium">Phone:</span> <span className="font-bold text-slate-700">{selectedConv.contact_phone || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 font-medium">Channel Owner:</span> <span className="font-bold text-blue-700">{selectedConv.channel_consultant || 'Abdullah Al Rakib'}</span></div>
                </div>
                <p className="text-[11px] text-slate-400 font-semibold">
                  The lead will be auto-assigned to <strong className="text-slate-500">{selectedConv.channel_consultant || 'Abdullah Al Rakib'}</strong>.
                </p>

                <button
                  type="button"
                  onClick={async () => {
                    setConvertingLead(true);
                    try {
                      const res = await api.convertLead(selectedConv.id, {});
                      toast.success('Converted to lead successfully!');
                      setSelectedConv(prev => ({ ...prev, lead_id: res.lead_id }));
                      setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, lead_id: res.lead_id } : c));
                      setShowLeadModal(false);
                    } catch (err) {
                      toast.error('Failed to convert to lead: ' + err.message);
                    } finally {
                      setConvertingLead(false);
                    }
                  }}
                  disabled={convertingLead}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md shadow-blue-500/10 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50 text-xs active:scale-95"
                >
                  {convertingLead ? 'Creating Lead...' : 'Create Lead'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5 py-1">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Search and select an existing CRM lead to link this conversation to.
                </p>

                {/* Search field */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search by name, phone, or Lead ID..."
                    value={leadSearch}
                    onChange={e => { setLeadSearch(e.target.value); setSelectedExistingLead(null); }}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600/50 placeholder-slate-400"
                  />
                </div>

                {/* Search Results list */}
                {leadSearchResults.length > 0 && (
                  <div className="border border-slate-100 rounded-xl max-h-40 overflow-y-auto divide-y divide-slate-50 bg-white shadow-inner scrollbar-thin">
                    {leadSearchResults.map(lead => (
                      <button
                        type="button"
                        key={lead.id}
                        onClick={() => setSelectedExistingLead(lead)}
                        className={`w-full text-left px-3 py-2.5 flex items-center justify-between text-xs transition-colors cursor-pointer hover:bg-slate-50
                          ${selectedExistingLead?.id === lead.id ? 'bg-blue-50 text-blue-800 font-semibold border-l-4 border-l-blue-600' : 'text-slate-600'}`}
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">{lead.client_name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">ID: {lead.lead_id} | Phone: {lead.phone || 'N/A'}</p>
                        </div>
                        <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-semibold">{lead.assigned_consultant || 'Unassigned'}</span>
                      </button>
                    ))}
                  </div>
                )}

                {leadSearch.trim().length >= 2 && leadSearchResults.length === 0 && (
                  <p className="text-[11px] text-center text-slate-400 py-2">No matching leads found.</p>
                )}

                {/* Selected Lead details */}
                {selectedExistingLead && (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex flex-col gap-1 text-xs animate-fade-in">
                    <p className="font-bold text-blue-800">Selected Lead:</p>
                    <p className="text-slate-700"><strong>Name:</strong> {selectedExistingLead.client_name}</p>
                    <p className="text-slate-700"><strong>Lead ID:</strong> {selectedExistingLead.lead_id}</p>
                    <p className="text-slate-700"><strong>Assigned to:</strong> {selectedExistingLead.assigned_consultant || 'Will be assigned to ' + (selectedConv.channel_consultant || 'Abdullah Al Rakib')}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedExistingLead) return;
                    setConvertingLead(true);
                    try {
                      const res = await api.convertLead(selectedConv.id, { lead_id: selectedExistingLead.id });
                      toast.success('Linked to lead successfully!');
                      setSelectedConv(prev => ({ ...prev, lead_id: selectedExistingLead.id }));
                      setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, lead_id: selectedExistingLead.id } : c));
                      setShowLeadModal(false);
                      setSelectedExistingLead(null);
                      setLeadSearch('');
                    } catch (err) {
                      toast.error('Failed to link lead: ' + err.message);
                    } finally {
                      setConvertingLead(false);
                    }
                  }}
                  disabled={convertingLead || !selectedExistingLead}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md shadow-blue-500/10 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50 text-xs active:scale-95"
                >
                  {convertingLead ? 'Linking Lead...' : 'Link Selected Lead'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
