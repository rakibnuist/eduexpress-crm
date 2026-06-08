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
        await api.updateConversation(conv.id, { status: 'open' }); // updates unread_count=0
        setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
      }
    } catch (err) {
      toast.error('Could not load messages: ' + err.message);
    } finally {
      setLoadingMessages(false);
    }
  }, [toast]);

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

  return (
    <div className="flex h-[calc(100vh-120px)] bg-[#f0f2f5] border border-[#e9edef] rounded-3xl overflow-hidden shadow-lg select-none">
      
      {/* 1. Left Sidebar: Conversations List */}
      <div className="w-80 md:w-96 flex flex-col bg-white border-r border-[#e9edef] flex-shrink-0">
        
        {/* Sidebar Header (WhatsApp Web style) */}
        <div className="h-16 px-4 bg-[#f0f2f5] flex items-center justify-between border-b border-[#e9edef]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
              {(user?.name || 'A').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Logged in</p>
              <p className="text-xs font-bold text-slate-700 truncate max-w-[130px]">{user?.name || user?.email || 'Admin'}</p>
            </div>
          </div>
          
          <button 
            onClick={loadConversations} 
            className="p-2 hover:bg-[#e1e3e6] rounded-full text-slate-600 transition-all cursor-pointer" 
            title="Reload list"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Search bar & Filter Pills */}
        <div className="p-2 border-b border-[#e9edef] bg-white flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search or start a new chat"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#f0f2f5] border border-transparent rounded-lg pl-10 pr-4 py-1.5 text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-transparent transition-all placeholder-slate-500"
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
                className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all cursor-pointer whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-[#f0f2f5] text-slate-600 hover:bg-[#e1e3e6]'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* List of Conversations */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#f0f2f5] bg-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold">Loading conversations...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm p-6 text-center">
              <MessageSquare size={32} className="text-slate-200 mb-2" />
              <p className="font-semibold text-slate-500">No chats found</p>
              <p className="text-[11px] mt-1 text-slate-400">Try modifying search or filtering tabs.</p>
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isSelected = selectedConv?.id === conv.id;
              const isWhatsApp = conv.channel_type === 'whatsapp';
              const isMessenger = conv.channel_type === 'messenger';
              const isInstagram = conv.channel_type === 'instagram';
              const lastTime = formatTime(conv.last_message_at);

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={`w-full text-left px-4 py-3 flex gap-3 transition-all outline-none border-b border-[#f0f2f5]
                    ${isSelected ? 'bg-[#f0f2f5]' : 'bg-white hover:bg-slate-50'}`}
                >
                  {/* Avatar & Channel Badge */}
                  <div className="relative flex-shrink-0 select-none">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm
                      ${isWhatsApp ? 'bg-[#25d366]' : isMessenger ? 'bg-[#0084ff]' : 'bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#962fbf]'}`}>
                      {(conv.contact_name || 'C').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    {/* Tiny Channel Badge */}
                    <span className={`absolute -bottom-1 -right-1 w-5.5 h-5.5 rounded-full flex items-center justify-center border-2 border-white text-[9px] font-black text-white shadow-sm
                      ${isWhatsApp ? 'bg-[#25d366]' : isMessenger ? 'bg-[#0084ff]' : 'bg-[#d62976]'}`} title={conv.channel_type}>
                      {isWhatsApp ? 'W' : isMessenger ? 'F' : 'I'}
                    </span>
                  </div>

                  {/* Snippet Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div className="flex justify-between items-baseline gap-1">
                      <p className={`text-sm truncate ${conv.unread_count > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                        {conv.contact_name || conv.contact_phone || 'Meta Contact'}
                      </p>
                      {lastTime && <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{lastTime}</span>}
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0">
                      {/* Checkmarks inside sidebar list */}
                      {!conv.unread_count && conv.last_message_direction === 'out' && (
                        <span className="flex-shrink-0">
                          {conv.last_message_status === 'read' ? (
                            <CheckCheck size={13} className="text-[#53bdeb]" />
                          ) : conv.last_message_status === 'delivered' ? (
                            <CheckCheck size={13} className="text-slate-400" />
                          ) : conv.last_message_status === 'failed' ? (
                            <AlertCircle size={13} className="text-rose-500" />
                          ) : (
                            <Check size={13} className="text-slate-400" />
                          )}
                        </span>
                      )}
                      
                      <p className={`text-xs truncate flex-1 ${conv.unread_count > 0 ? 'font-bold text-slate-800' : 'text-slate-400 font-medium'}`}>
                        {conv.last_message || 'No messages yet'}
                      </p>
                    </div>

                    {/* Unread count & channel tag name */}
                    <div className="flex justify-between items-center mt-0.5">
                      <span className="text-[10px] font-bold tracking-wide uppercase truncate max-w-[150px] opacity-75" style={{ color: conv.channel_color || '#008069' }}>
                        {conv.channel_name || conv.channel_type}
                      </span>
                      {conv.unread_count > 0 && (
                        <span className="bg-[#25d366] text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full min-w-5 text-center shadow-sm">
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
      <div className="flex-1 flex flex-col bg-[#efeae2] min-w-0 relative">
        {selectedConv ? (
          <>
            {/* Chat Pane Header (WhatsApp style) */}
            <div className="h-16 px-6 bg-[#f0f2f5] flex items-center justify-between border-b border-[#e9edef] shadow-sm z-10">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm
                  ${selectedConv.channel_type === 'whatsapp' ? 'bg-[#25d366]' : 'bg-[#0084ff]'}`}>
                  {(selectedConv.contact_name || 'C').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-800 text-sm truncate">
                    {selectedConv.contact_name || 'Meta Contact'}
                  </h3>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                    {selectedConv.channel_type === 'whatsapp' ? (
                      <>
                        <Phone size={11} className="text-slate-400" /> {selectedConv.contact_phone}
                      </>
                    ) : (
                      <>
                        <Mail size={11} className="text-slate-400" /> Facebook Messenger
                      </>
                    )}
                    {selectedConv.lead_id ? (
                      <>
                        <span>·</span>
                        <Link to={`/leads/${selectedConv.lead_id}`} className="text-emerald-600 hover:text-emerald-800 hover:underline inline-flex items-center gap-0.5 font-bold">
                          View Lead ID <ExternalLink size={10} />
                        </Link>
                      </>
                    ) : (
                      <>
                        <span>·</span>
                        <button
                          onClick={() => {
                            setLeadTab('new');
                            setShowLeadModal(true);
                          }}
                          className="text-amber-600 hover:text-amber-800 hover:underline inline-flex items-center gap-0.5 font-bold cursor-pointer"
                        >
                          Convert/Link to Lead
                        </button>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Chat Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleArchive(selectedConv)}
                  className="p-2 hover:bg-[#e1e3e6] text-slate-500 hover:text-slate-700 rounded-full transition-all cursor-pointer"
                  title={selectedConv.status === 'archived' ? 'Reopen Conversation' : 'Archive Conversation'}
                >
                  <Archive size={18} />
                </button>
                <button
                  onClick={() => handleDeleteConversation(selectedConv)}
                  className="p-2 hover:bg-[#e1e3e6] text-slate-500 hover:text-rose-600 rounded-full transition-all cursor-pointer"
                  title="Delete Conversation"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* Chat Pane Messages Area with Custom SVG Doodle repeating wallpaper */}
            <div 
              className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-thin flex flex-col"
              style={{
                backgroundColor: '#efeae2',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='%23e5ddd5' fill-opacity='0.6'%3E%3Cpath fill-rule='evenodd' d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zM11 61c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm74-4c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zM40 20c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 40c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zM20 40c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm40 0c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z'/%3E%3C/g%3E%3C/svg%3E")`
              }}
            >
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center m-auto gap-2 text-slate-400 text-sm">
                  <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-semibold">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center m-auto text-slate-400 text-sm bg-white/70 px-6 py-4 rounded-xl shadow-sm border border-slate-200/50 text-center max-w-sm">
                  <p className="font-bold text-slate-600">No messages in this chat yet</p>
                  <p className="text-xs text-slate-400 mt-1">Send a template or welcome message below to start the conversation.</p>
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isInbound = m.direction === 'in' || m.direction === 'inbound';
                  const timeStr = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <div key={m.id || idx} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                      {/* Bubble with shadow and WhatsApp bubble colors */}
                      <div 
                        className={`max-w-[75%] rounded-lg px-3.5 py-2 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] relative group flex flex-col gap-1
                          ${isInbound 
                            ? 'bg-white text-slate-800 rounded-tl-none border-l-4 border-l-slate-300' 
                            : 'bg-[#d9fdd3] text-slate-800 rounded-tr-none border-r-4 border-r-emerald-500'}`}
                      >
                        {/* Outbound sender attribution */}
                        {!isInbound && m.sent_by && (
                          <p className="text-[9px] text-emerald-700/80 font-black tracking-wide uppercase">
                            {m.sent_by}
                          </p>
                        )}

                        {/* 1. Image Render */}
                        {m.type === 'image' && m.media_url && (
                          <div className="mb-1 max-w-full overflow-hidden rounded-md bg-black/5 border border-black/5">
                            <img
                              src={m.media_url}
                              alt="Attachment Image"
                              className="max-w-full h-auto object-cover max-h-[300px] cursor-pointer hover:brightness-95 transition-all"
                              onClick={() => setLightboxImage(m.media_url)}
                            />
                          </div>
                        )}

                        {/* 2. Document Render */}
                        {m.type === 'document' && m.media_url && (
                          <div className={`mb-1 p-3 rounded-lg flex items-center gap-3 border ${isInbound ? 'bg-slate-50 border-slate-200' : 'bg-emerald-700/10 border-emerald-600/20'} max-w-sm`}>
                            <FileText className={isInbound ? 'text-slate-500' : 'text-emerald-700'} size={24} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-bold truncate ${isInbound ? 'text-slate-800' : 'text-slate-800'}`}>
                                {m.content || 'Document Attachment'}
                              </p>
                              <a
                                href={m.media_url}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className={`text-[10px] font-black underline ${isInbound ? 'text-emerald-600 hover:text-emerald-800' : 'text-emerald-700 hover:text-emerald-800'} inline-block mt-0.5`}
                              >
                                Download document
                              </a>
                            </div>
                          </div>
                        )}

                        {/* 3. Text Message content (Only if text type or image description) */}
                        {(m.type === 'text' || !m.type || (m.type !== 'image' && m.type !== 'document') || (m.type === 'image' && m.content && m.content !== m.media_url)) && (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{m.content}</p>
                        )}
                        
                        {/* Time & Delivery Receipt Status Ticks */}
                        <div className="flex items-center justify-end gap-1 mt-0.5 text-[9px] text-slate-400 font-bold self-end select-none">
                          <span>{timeStr}</span>
                          {!isInbound && (
                            <span className="flex-shrink-0">
                              {m.status === 'read' ? (
                                <CheckCheck size={13} className="text-[#53bdeb]" title="Read (Blue tick)" />
                              ) : m.status === 'delivered' ? (
                                <CheckCheck size={13} className="text-slate-400" title="Delivered" />
                              ) : m.status === 'failed' ? (
                                <AlertCircle size={13} className="text-rose-500" title="Failed to send" />
                              ) : (
                                <Check size={13} className="text-slate-400" title="Sent" />
                              )}
                            </span>
                          )}
                        </div>

                        {/* Hover Tooltip for failures */}
                        {m.status === 'failed' && m.error_msg && (
                          <div className="absolute right-0 -bottom-7 bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap border border-slate-700">
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
              <div className="px-6 py-2 bg-[#f0f2f5] border-t border-[#e9edef] flex items-center gap-2 overflow-x-auto text-xs whitespace-nowrap scrollbar-none select-none">
                <span className="text-slate-400 font-bold flex items-center gap-1">
                  <Sparkles size={13} className="text-yellow-500" /> Templates:
                </span>
                {quickReplies.slice(0, 5).map(reply => (
                  <button
                    key={reply.id}
                    onClick={() => setReplyText(reply.content)}
                    className="bg-white border border-[#e9edef] text-slate-600 px-3 py-1 rounded-lg hover:border-emerald-500 hover:text-emerald-600 transition-all font-semibold cursor-pointer text-xs shadow-sm"
                    title={reply.content}
                  >
                    {reply.title}
                  </button>
                ))}
              </div>
            )}

            {/* Inline selected attachment preview bar */}
            {selectedFile && (
              <div className="px-6 py-3 bg-[#f0f2f5] border-t border-[#e9edef] flex items-center justify-between animate-fade-in select-none">
                <div className="flex items-center gap-3">
                  {selectedFile.type === 'image' ? (
                    <div className="relative w-12 h-12 rounded border border-slate-200 overflow-hidden flex-shrink-0 bg-white shadow-sm">
                      <img src={selectedFile.previewUrl} alt="Upload preview" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <FileText size={24} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate max-w-[200px] md:max-w-xs">{selectedFile.name}</p>
                    <p className="text-[10px] text-emerald-600 font-bold">Ready to send attachment</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1.5 hover:bg-[#e1e3e6] rounded-full text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                  title="Remove attachment"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Uploading progress message */}
            {uploading && (
              <div className="px-6 py-2.5 bg-[#f0f2f5] border-t border-[#e9edef] flex items-center gap-2.5 text-slate-500 text-xs font-semibold select-none">
                <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <span>Uploading media attachment to server...</span>
              </div>
            )}

            {/* Chat Pane Composer Area */}
            <form onSubmit={handleSend} className="p-3.5 bg-[#f0f2f5] border-t border-[#e9edef] flex gap-3 items-center">
              
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={handleFileChange}
              />

              {/* Attachment Paperclip button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-[#e1e3e6] text-slate-500 hover:text-slate-700 rounded-full transition-all cursor-pointer flex-shrink-0"
                title="Attach Document or Image"
                disabled={sending || uploading}
              >
                <Paperclip size={20} />
              </button>

              {/* Smiley/Emoji button (inserts inline smiley) */}
              <button
                type="button"
                onClick={() => setReplyText(prev => prev + '😊')}
                className="p-2 hover:bg-[#e1e3e6] text-slate-500 hover:text-slate-700 rounded-full transition-all cursor-pointer flex-shrink-0"
                title="Insert Emoji"
                disabled={sending}
              >
                <Smile size={20} />
              </button>

              {/* Composer input textarea */}
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={selectedFile ? "Add a caption..." : "Type a message..."}
                rows={1}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1 bg-white border-transparent rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-transparent resize-none max-h-24 scrollbar-thin placeholder-slate-400"
              />

              {/* Send button (WhatsApp styled emerald circle) */}
              <button
                type="submit"
                disabled={sending || uploading || (!replyText.trim() && !selectedFile)}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white p-3 rounded-full shadow-md transition-all flex-shrink-0 cursor-pointer flex items-center justify-center"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          /* Empty Splash State (WhatsApp Web style) */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#f8f9fa] border-b-4 border-b-[#008069] select-none">
            <div className="max-w-md flex flex-col items-center">
              
              {/* WhatsApp Web style illustration */}
              <div className="w-64 h-48 mb-8 flex items-center justify-center relative">
                <svg viewBox="0 0 348 245" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full opacity-85">
                  <path d="M294.5 158.5C310.24 158.5 323 145.74 323 130C323 114.26 310.24 101.5 294.5 101.5C278.76 101.5 266 114.26 266 130C266 145.74 278.76 158.5 294.5 158.5Z" fill="#E1F3EC" />
                  <path d="M53.5 111.5C69.24 111.5 82 98.74 82 83C82 67.26 69.24 54.5 53.5 54.5C37.76 54.5 25 67.26 25 83C25 98.74 37.76 111.5 53.5 111.5Z" fill="#E1F3EC" />
                  <rect x="74" y="24" width="200" height="152" rx="16" fill="#F0F2F5" stroke="#E9EDEF" strokeWidth="4" />
                  <rect x="88" y="38" width="172" height="124" rx="8" fill="#FFFFFF" />
                  <circle cx="174" cy="196" r="14" fill="#008069" />
                  <path d="M171 193H177M174 190V196" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <path d="M44 184H304C312.837 184 320 191.163 320 200V204H28V200C28 191.163 35.1633 184 44 184Z" fill="#D9FDD3" />
                  <rect x="144" y="204" width="60" height="4" fill="#008069" rx="2" />
                  <rect x="100" y="50" width="80" height="16" rx="6" fill="#D9FDD3" />
                  <rect x="160" y="74" width="88" height="16" rx="6" fill="#E9EDEF" />
                  <rect x="100" y="98" width="104" height="16" rx="6" fill="#D9FDD3" />
                </svg>
              </div>
              
              <h2 className="text-2xl font-light text-slate-700 tracking-wide">EduExpress Live Chat</h2>
              <p className="text-slate-500 text-sm mt-3 leading-relaxed max-w-sm">
                Send and receive messages on WhatsApp, Messenger, and Instagram. Attach documents, images, and track statuses in real-time.
              </p>
              
              <div className="flex items-center gap-2 mt-12 text-slate-400 text-xs font-medium border-t border-slate-200 pt-4 w-full justify-center">
                <Lock size={12} className="text-slate-400" />
                <span>End-to-end communication via Meta Cloud API</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
          <button 
            className="absolute top-4 right-4 text-white hover:text-slate-300 p-2 cursor-pointer transition-all" 
            onClick={() => setLightboxImage(null)}
          >
            <X size={28} />
          </button>
          <img src={lightboxImage} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-scale-in" />
        </div>
      )}

      {/* Convert to Lead Modal */}
      {showLeadModal && selectedConv && (
        <div className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <User className="text-emerald-600" size={20} /> Convert to Lead
              </h3>
              <button 
                onClick={() => { setShowLeadModal(false); setSelectedExistingLead(null); setLeadSearch(''); }} 
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setLeadTab('new')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${leadTab === 'new' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Create New Lead
              </button>
              <button
                type="button"
                onClick={() => setLeadTab('link')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${leadTab === 'link' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Link Existing Lead
              </button>
            </div>

            {leadTab === 'new' ? (
              <div className="flex flex-col gap-3 py-2">
                <p className="text-sm text-slate-500 leading-relaxed">
                  This will create a new CRM lead for <strong>{selectedConv.contact_name || 'this contact'}</strong> with source <strong>{selectedConv.channel_type}</strong>.
                </p>
                <div className="bg-[#efeae2]/40 border border-[#e9edef] rounded-xl p-3.5 flex flex-col gap-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">Name:</span> <span className="font-bold text-slate-700">{selectedConv.contact_name || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Phone:</span> <span className="font-bold text-slate-700">{selectedConv.contact_phone || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Channel Owner:</span> <span className="font-bold text-emerald-700">{selectedConv.channel_consultant || 'Abdullah Al Rakib'}</span></div>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  The lead will be auto-assigned to <strong>{selectedConv.channel_consultant || 'Abdullah Al Rakib'}</strong>.
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50 text-xs"
                >
                  {convertingLead ? 'Creating Lead...' : 'Create Lead'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 py-2">
                <p className="text-sm text-slate-500 leading-relaxed">
                  Search and select an existing CRM lead to link this conversation to.
                </p>

                {/* Search field */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search by name, phone, or Lead ID..."
                    value={leadSearch}
                    onChange={e => { setLeadSearch(e.target.value); setSelectedExistingLead(null); }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-transparent placeholder-slate-400"
                  />
                </div>

                {/* Search Results list */}
                {leadSearchResults.length > 0 && (
                  <div className="border border-slate-100 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-50 bg-white shadow-inner">
                    {leadSearchResults.map(lead => (
                      <button
                        type="button"
                        key={lead.id}
                        onClick={() => setSelectedExistingLead(lead)}
                        className={`w-full text-left px-3 py-2.5 flex items-center justify-between text-xs transition-colors cursor-pointer hover:bg-slate-50
                          ${selectedExistingLead?.id === lead.id ? 'bg-emerald-50 text-emerald-800 font-semibold border-l-4 border-l-emerald-600' : 'text-slate-600'}`}
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">{lead.client_name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">ID: {lead.lead_id} | Phone: {lead.phone || 'N/A'}</p>
                        </div>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">{lead.assigned_consultant || 'Unassigned'}</span>
                      </button>
                    ))}
                  </div>
                )}

                {leadSearch.trim().length >= 2 && leadSearchResults.length === 0 && (
                  <p className="text-xs text-center text-slate-400 py-2">No matching leads found.</p>
                )}

                {/* Selected Lead details */}
                {selectedExistingLead && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-col gap-1 text-xs">
                    <p className="font-bold text-emerald-800">Selected Lead:</p>
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50 text-xs"
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
