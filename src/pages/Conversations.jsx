import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import {
  MessageSquare, Search, Send, Clock, User, Phone, Mail, ExternalLink,
  Check, CheckCheck, AlertCircle, Sparkles, Filter, Archive, CheckCircle, RefreshCw, Trash2
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
  
  // Compose message state
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  
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
    if (!replyText.trim() || !selectedConv) return;
    setSending(true);
    try {
      const sentBy = user?.name || user?.email || 'Admin';
      await api.sendMessage(selectedConv.id, {
        content: replyText.trim(),
        sent_by: sentBy
      });
      setReplyText('');
    } catch (err) {
      toast.error('Failed to send message: ' + err.message);
    } finally {
      setSending(false);
    }
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
    <div className="flex h-[calc(100vh-120px)] bg-slate-50 border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
      
      {/* 1. Left Sidebar: Conversations List */}
      <div className="w-80 md:w-96 flex flex-col bg-white border-r border-slate-200 flex-shrink-0">
        
        {/* Header Area */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <MessageSquare className="text-indigo-600" size={20} /> Live Chat Inbox
            </h2>
            <button onClick={loadConversations} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors" title="Reload list">
              <RefreshCw size={15} />
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Filters row */}
          <div className="flex items-center gap-1.5 text-xs">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-lg py-1 px-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open Chats</option>
              <option value="archived">Archived</option>
            </select>

            <select
              value={channelFilter}
              onChange={e => setChannelFilter(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-lg py-1 px-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="messenger">Messenger</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>
        </div>

        {/* List of Conversations */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p>Loading conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm p-5 text-center">
              <MessageSquare size={32} className="text-slate-200 mb-2" />
              <p className="font-medium">No conversations found</p>
              <p className="text-xs mt-1 text-slate-400">Configure Meta channels or wait for inbound WhatsApp/Messenger messages.</p>
            </div>
          ) : (
            conversations.map(conv => {
              const isSelected = selectedConv?.id === conv.id;
              const isWhatsApp = conv.channel_type === 'whatsapp';
              const isMessenger = conv.channel_type === 'messenger';
              const isInstagram = conv.channel_type === 'instagram';
              const lastTime = formatTime(conv.last_message_at);

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={`w-full text-left p-4 flex gap-3 transition-colors outline-none border-l-4
                    ${isSelected ? 'bg-indigo-50/60 border-indigo-600' : 'bg-white border-transparent hover:bg-slate-50/60'}`}
                >
                  {/* Avatar & Channel Badge */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base
                      ${isWhatsApp ? 'bg-gradient-to-br from-emerald-500 to-green-600' : isMessenger ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-purple-500 to-pink-500'}`}>
                      {(conv.contact_name || 'C').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    {/* Tiny Channel Type indicator dot */}
                    <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white text-[9px] font-extrabold text-white
                      ${isWhatsApp ? 'bg-emerald-500' : isMessenger ? 'bg-blue-500' : 'bg-pink-500'}`} title={conv.channel_type}>
                      {isWhatsApp ? 'W' : isMessenger ? 'F' : 'I'}
                    </span>
                  </div>

                  {/* Snippet Detail */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex justify-between items-baseline gap-1">
                      <p className={`text-sm truncate ${conv.unread_count > 0 ? 'font-bold text-slate-800' : 'font-semibold text-slate-700'}`}>
                        {conv.contact_name || conv.contact_phone || 'Meta Contact'}
                      </p>
                      {lastTime && <span className="text-[10px] text-slate-400 whitespace-nowrap">{lastTime}</span>}
                    </div>

                    <p className={`text-xs truncate mt-0.5 ${conv.unread_count > 0 ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>
                      {conv.last_message || 'No messages yet'}
                    </p>

                    {/* Unread count & channels name */}
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] font-medium text-slate-400 truncate max-w-[120px]" style={{ color: conv.channel_color }}>
                        {conv.channel_name || conv.channel_type}
                      </span>
                      {conv.unread_count > 0 && (
                        <span className="bg-indigo-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full min-w-4 text-center">
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
      <div className="flex-1 flex flex-col bg-slate-50 min-w-0">
        {selectedConv ? (
          <>
            {/* Chat Pane Header */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0
                  ${selectedConv.channel_type === 'whatsapp' ? 'bg-gradient-to-br from-emerald-500 to-green-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
                  {(selectedConv.contact_name || 'C').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-800 text-sm truncate">
                    {selectedConv.contact_name || 'Meta Contact'}
                  </h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    {selectedConv.channel_type === 'whatsapp' ? (
                      <>
                        <Phone size={11} /> {selectedConv.contact_phone}
                      </>
                    ) : (
                      <>
                        <Mail size={11} /> Facebook Messenger
                      </>
                    )}
                    {selectedConv.lead_id && (
                      <>
                        <span>·</span>
                        <Link to={`/leads/${selectedConv.lead_id}`} className="text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-0.5 font-semibold">
                          View Lead ID <ExternalLink size={10} />
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Chat Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleArchive(selectedConv)}
                  className="p-2 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-indigo-600 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                  title={selectedConv.status === 'archived' ? 'Reopen Conversation' : 'Archive Conversation'}
                >
                  <Archive size={15} />
                </button>
                <button
                  onClick={() => handleDeleteConversation(selectedConv)}
                  className="p-2 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-all cursor-pointer"
                  title="Delete Conversation"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Chat Pane Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-slate-50/60 scrollbar-thin">
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400 text-sm">
                  <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p>Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
                  <p className="font-semibold text-slate-400">No messages in this chat yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Send a welcome message to start the conversation.</p>
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isInbound = m.direction === 'in' || m.direction === 'inbound';
                  const timeStr = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <div key={m.id || idx} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm relative group
                        ${isInbound 
                          ? 'bg-white text-slate-800 border border-slate-100 rounded-tl-none' 
                          : 'bg-indigo-600 text-white rounded-tr-none'}`}>
                        
                        {/* Sender info */}
                        {!isInbound && m.sent_by && (
                          <p className="text-[9px] opacity-75 font-semibold mb-0.5 tracking-wide uppercase">
                            {m.sent_by}
                          </p>
                        )}

                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        
                        {/* Time & Delivery status ticks */}
                        <div className="flex items-center justify-end gap-1.5 mt-1 text-[9px] opacity-65">
                          <span>{timeStr}</span>
                          {!isInbound && (
                            <span className="flex-shrink-0">
                              {m.status === 'read' ? (
                                <CheckCheck size={11} className="text-emerald-300" title="Read" />
                              ) : m.status === 'delivered' ? (
                                <CheckCheck size={11} className="text-slate-200" title="Delivered" />
                              ) : m.status === 'failed' ? (
                                <AlertCircle size={11} className="text-rose-300" title="Failed to send" />
                              ) : (
                                <Check size={11} className="text-slate-300" title="Sent" />
                              )}
                            </span>
                          )}
                        </div>

                        {/* Error message tooltip if failed */}
                        {m.status === 'failed' && m.error_msg && (
                          <div className="absolute right-0 -bottom-6 bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
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

            {/* Quick replies toolbar */}
            {quickReplies.length > 0 && (
              <div className="px-6 py-2 bg-slate-100 border-t border-slate-200 flex items-center gap-2 overflow-x-auto text-xs whitespace-nowrap scrollbar-none">
                <span className="text-slate-400 font-semibold flex items-center gap-1">
                  <Sparkles size={12} className="text-yellow-500" /> Templates:
                </span>
                {quickReplies.slice(0, 5).map(reply => (
                  <button
                    key={reply.id}
                    onClick={() => setReplyText(reply.content)}
                    className="bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded-lg hover:border-indigo-400 hover:text-indigo-600 transition-all font-medium cursor-pointer"
                    title={reply.content}
                  >
                    {reply.title}
                  </button>
                ))}
              </div>
            )}

            {/* Chat Pane Composer Area */}
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-200 flex gap-3 items-center">
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Type a message..."
                rows={1}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none max-h-24 scrollbar-thin"
              />
              <button
                type="submit"
                disabled={sending || !replyText.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-3 rounded-xl shadow-md transition-all flex-shrink-0 cursor-pointer flex items-center justify-center"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner mb-4">
              <MessageSquare size={32} />
            </div>
            <h3 className="font-bold text-slate-800 text-lg">No Chat Selected</h3>
            <p className="text-slate-400 text-sm max-w-sm mt-1">
              Select a conversation from the sidebar inbox to read and send messages directly on WhatsApp or Messenger.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
