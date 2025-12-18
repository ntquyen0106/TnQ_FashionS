import { useState, useEffect, useRef, useCallback } from 'react';
import { chatbotApi } from '@/api/chatbot-api';
import { useAuth } from '@/auth/AuthProvider';
import io from 'socket.io-client';
import ProductPickerModal from '@/components/ProductPickerModal';
import { productsApi } from '@/api/products-api';
import { authApi } from '@/api/auth-api';
import styles from './StaffChatPage.module.css';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

const BACKEND_SOCKET_ORIGIN = (() => {
  const configured = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL;
  if (configured && /^https?:\/\//i.test(configured)) return configured;
  // Dev fallback
  if (!import.meta.env.PROD) return 'http://localhost:5000';
  // Prod fallback (matches client/vercel.json proxy target)
  return 'https://tnq-fashions.onrender.com';
})();

const normalizeTimestamp = (value) => {
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const encodePublicId = (pid) => (pid ? pid.split('/').map(encodeURIComponent).join('/') : '');

const normalizeProductImageId = (raw) => {
  if (!raw) return '';
  let id = String(raw).trim();
  if (!id) return '';
  if (/^https?:/i.test(id)) return id;
  id = id.replace(/^\/+/, '');
  id = id.replace(/\.(jpe?g|png|gif|webp)$/i, '');
  return id;
};

const buildCloudinaryUrl = (raw, width = 200) => {
  const normalized = normalizeProductImageId(raw);
  if (!normalized) return '';
  if (/^https?:/i.test(normalized)) return normalized;
  if (!CLOUD_NAME) return '';
  const encoded = encodePublicId(normalized);
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_${width},f_auto,q_auto/${encoded}`;
};

export default function StaffChatPage({ onCountsChange, initialCounts }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState(null);
  const [filter, setFilter] = useState('waiting_staff'); // waiting_staff, with_staff, all
  const [counts, setCounts] = useState(initialCounts || { waiting: 0, withStaff: 0, all: 0 });
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({}); // Track unread messages per session
  const messagesEndRef = useRef(null);
  const selectedSessionRef = useRef(null); // Ref to hold current session
  const fileInputRef = useRef(null);
  const joinedSessionIdsRef = useRef(new Set());
  const filterRef = useRef('waiting_staff');
  // AI product hydration cache for bot suggestions
  const [aiProductCache, setAiProductCache] = useState({});
  const aiProductFetchRef = useRef(new Set());
  const sortSessionsByLastMessage = useCallback((list = []) => {
    return [...list].sort((a, b) => {
      const timeA = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, []);

  const applySessionUpdate = useCallback(
    (sessionId, updater) => {
      if (!sessionId) return;

      setSessions((prev) => {
        let changed = false;
        const updated = prev.map((session) => {
          if (session.sessionId !== sessionId) return session;
          const next =
            typeof updater === 'function' ? updater(session) : { ...session, ...updater };
          changed = changed || next !== session;
          return next;
        });
        if (!changed) return prev;
        return sortSessionsByLastMessage(updated);
      });

      setSelectedSession((prev) => {
        if (!prev || prev.sessionId !== sessionId) return prev;
        return typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      });
    },
    [sortSessionsByLastMessage, setSelectedSession],
  );
  const queueSessionRoomJoin = useCallback(
    (sessionList) => {
      if (!sessionList || sessionList.length === 0) return;

      sessionList.forEach((session) => {
        const sessionId = session?.sessionId;
        if (!sessionId || joinedSessionIdsRef.current.has(sessionId)) return;

        joinedSessionIdsRef.current.add(sessionId);
        if (socket) {
          socket.emit('join_chat', sessionId);
          console.log('[Staff Chat] Auto-joined session room:', sessionId);
        }
      });
    },
    [socket],
  );

  // Rejoin all known rooms when socket reconnects
  useEffect(() => {
    if (!socket) return;
    joinedSessionIdsRef.current.forEach((sessionId) => {
      socket.emit('join_chat', sessionId);
      console.log('[Staff Chat] Rejoined session room after reconnect:', sessionId);
    });
  }, [socket]);

  useEffect(() => {
    if (initialCounts) {
      setCounts(initialCounts);
    }
  }, [initialCounts]);

  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  // Hydrate AI product cards in bot messages so images come from DB
  useEffect(() => {
    if (!Array.isArray(messages) || messages.length === 0) return;
    const toFetch = [];
    const seen = new Set();

    messages.forEach((msg) => {
      if (!msg || msg.from !== 'bot') return;
      const list = extractJSONProducts(msg.text) || [];
      list.forEach((item) => {
        const slug = item?.slug?.trim?.() || '';
        if (!slug || seen.has(slug)) return;
        seen.add(slug);
        if (aiProductCache[slug]) return;
        if (aiProductFetchRef.current.has(slug)) return;
        aiProductFetchRef.current.add(slug);
        toFetch.push(slug);
      });
    });

    if (!toFetch.length) return;

    (async () => {
      for (const slug of toFetch) {
        try {
          const res = await productsApi.detailBySlug(slug, { _noAutoToast: true });
          const detail = res?.data || res?.product || res;
          if (!detail || !detail._id) continue;
          const imagePublicId =
            detail?.images?.find?.((im) => im?.isPrimary)?.publicId ||
            detail?.images?.[0]?.publicId ||
            detail?.variants?.find?.((v) => v?.imagePublicId)?.imagePublicId ||
            '';
          setAiProductCache((prev) => ({
            ...prev,
            [slug]: {
              slug: detail.slug || slug,
              name: detail.name,
              imagePublicId: normalizeProductImageId(imagePublicId),
              rating: detail.ratingAvg ?? null,
            },
          }));
        } catch (err) {
          console.warn('[StaffChat] Không thể hydrate sản phẩm AI', slug, err);
        } finally {
          aiProductFetchRef.current.delete(slug);
        }
      }
    })();
  }, [messages]);

  // Extract JSON product list from AI bot message
  const extractJSONProducts = (text) => {
    if (!text || typeof text !== 'string') return null;

    // 1) Look for fenced code block ```json ... ```
    const fenced = text.match(/```json([\s\S]*?)```/i) || text.match(/```([\s\S]*?)```/i);
    const candidates = [];
    if (fenced && fenced[1]) candidates.push(fenced[1].trim());

    // 2) Look for first JSON-like array/object
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    const start = [firstBrace, firstBracket].filter((v) => v >= 0).sort((a, b) => a - b)[0];
    if (start >= 0) {
      const tail = text.slice(start);
      const lastBrace = Math.max(tail.lastIndexOf('}'), tail.lastIndexOf(']'));
      if (lastBrace > 0) {
        candidates.push(tail.slice(0, lastBrace + 1));
      }
    }

    for (const raw of candidates) {
      try {
        const obj = JSON.parse(raw);
        if (Array.isArray(obj)) {
          return obj.map((p) => ({
            name: p.name || p.title || '',
            slug: p.slug || p.link?.replace(/^.*\/product\//, '') || '',
            image: p.image || p.images?.[0]?.publicId || p.images?.[0] || '',
            price:
              p.priceText ||
              (typeof p.price === 'number' ? p.price.toLocaleString('vi-VN') : p.price) ||
              '',
            rating: p.rating || p.ratingAvg || '',
          }));
        }
        if (obj && (obj.type === 'product_list' || obj.items)) {
          const items = obj.items || [];
          return items.map((p) => ({
            name: p.name || p.title || '',
            slug: p.slug || p.link?.replace(/^.*\/product\//, '') || '',
            image: p.image || p.images?.[0]?.publicId || p.images?.[0] || '',
            price:
              p.priceText ||
              (typeof p.price === 'number' ? p.price.toLocaleString('vi-VN') : p.price) ||
              '',
            rating: p.rating || p.ratingAvg || '',
          }));
        }
      } catch (_) {
        // ignore and continue
      }
    }

    return null;
  };

  const getMessageDisplayText = (message) => {
    const hasAttachment = Boolean(message?.attachment?.url);
    const trimmed = message?.text?.trim();

    // If product card is attached, suppress text line
    if (message?.productData) {
      return '';
    }

    // Check if message contains JSON product list
    const hasProductList = message?.from === 'bot' && extractJSONProducts(trimmed);
    if (hasProductList) {
      // Strip JSON from display text
      const braceIdx = trimmed.indexOf('{');
      const bracketIdx = trimmed.indexOf('[');
      let cutIdx = trimmed.length;
      if (braceIdx >= 0) cutIdx = Math.min(cutIdx, braceIdx);
      if (bracketIdx >= 0) cutIdx = Math.min(cutIdx, bracketIdx);
      const lead = trimmed.slice(0, cutIdx).trim();
      return lead || '';
    }

    if (trimmed) {
      if (hasAttachment && /^(Ảnh|Video)\s*:/i.test(trimmed)) {
        // Hide raw filename text when attachment present
        return message.attachment.type === 'image'
          ? 'Đã gửi một ảnh'
          : message.attachment.type === 'video'
          ? 'Đã gửi một video'
          : 'Đã gửi tệp đính kèm';
      }
      return trimmed;
    }

    // If no text and only productData, return empty to let product card render
    if (message?.productData?.name) return '';

    if (hasAttachment) {
      return message.attachment.type === 'image'
        ? 'Đã gửi một ảnh'
        : message.attachment.type === 'video'
        ? 'Đã gửi một video'
        : 'Đã gửi tệp đính kèm';
    }

    return '';
  };

  // Update ref whenever selectedSession changes
  useEffect(() => {
    selectedSessionRef.current = selectedSession;
  }, [selectedSession]);

  // Initialize socket
  useEffect(() => {
    if (!user) return;

    console.log('[Staff Chat] Initializing socket for user:', user.name);

    let alive = true;

    (async () => {
      try {
        const tokenRes = await authApi.socketToken();
        const token = tokenRes?.token;

        const socketOptions = {
          transports: ['websocket', 'polling'],
          auth: token ? { token } : undefined,
        };

        const newSocket = io(BACKEND_SOCKET_ORIGIN, socketOptions);

        newSocket.on('connect', () => {
          console.log('[Staff Chat] ✅ Connected to WebSocket');
          console.log('[Staff Chat] Socket ID:', newSocket.id);
        });

        newSocket.on('connect_error', (error) => {
          console.error('[Staff Chat] ❌ Connection error:', error);
        });

        // Confirm joined staff room
        newSocket.on('staff_room_joined', (info) => {
          console.log('[Staff Chat] Joined staff room:', info);
        });

        newSocket.on('new_staff_request', (data) => {
          console.log('[Staff Chat] 🔔 New request:', data);
          // Play notification sound
          playNotificationSound();
          // Refresh sessions list and counts
          loadSessionsRef.current();
          loadCountsRef.current();
        });

        // NOTE: new_message listener moved to separate effect to avoid stale selectedSession closure

        // Optional ack when a customer emits request_staff
        newSocket.on('staff_request_ack', (ack) => {
          console.log('[Staff Chat] Staff request ack:', ack);
          if (ack?.sessionId) {
            loadSessionsRef.current();
            loadCountsRef.current();
          }
        });

        // When any staff accepts a session, update my list
        newSocket.on('session_accepted', (data) => {
          console.log('[Staff Chat] Session accepted broadcast:', data);
          setSessions((prev) =>
            prev.map((s) =>
              s.sessionId === data.sessionId
                ? { ...s, status: 'with_staff', assignedStaffId: data.staffId }
                : s,
            ),
          );
          if (filterRef.current === 'waiting_staff') loadSessionsRef.current();
          loadCountsRef.current(); // Update counts when session is accepted
        });

        if (!alive) {
          newSocket.disconnect();
          return;
        }
        setSocket(newSocket);
      } catch (error) {
        console.error('[Staff Chat] ❌ Failed to init socket:', error);
      }
    })();

    return () => {
      console.log('[Staff Chat] Disconnecting socket');
      alive = false;
      setSocket((prev) => {
        try {
          prev?.disconnect();
        } catch {
          // ignore
        }
        return null;
      });
    };
  }, [user]);

  // Subscribe to new_message with latest selectedSession (avoid stale closure)
  useEffect(() => {
    if (!socket) return;

    const handler = (message) => {
      const currentSession = selectedSessionRef.current; // Read from ref
      console.log('[Staff Chat] 💬 Received new_message event:', message);
      console.log('[Staff Chat] Selected session (from ref):', currentSession?.sessionId);
      console.log('[Staff Chat] Message sessionId:', message.sessionId);

      const timestampISO = normalizeTimestamp(message.createdAt);

      if (currentSession?.sessionId === message.sessionId) {
        console.log('[Staff Chat] ✅ SessionId matches, adding message');
        const formattedMsg = {
          _id: message._id,
          from: message.from,
          text: message.text,
          staffName: message.staffName,
          attachment: message.attachment,
          productData: message.productData,
          createdAt: message.createdAt,
          pending: false,
        };
        setMessages((prev) => {
          const optimisticIndex = prev.findIndex(
            (m) => m.pending && m.from === formattedMsg.from && m.text === formattedMsg.text,
          );

          if (optimisticIndex !== -1) {
            const next = [...prev];
            next[optimisticIndex] = { ...next[optimisticIndex], ...formattedMsg };
            console.log('[Staff Chat] 🔄 Replaced optimistic message with server payload');
            return next;
          }

          if (prev.some((m) => m._id === formattedMsg._id)) {
            console.log('[Staff Chat] ⚠️ Duplicate message, skipping');
            return prev;
          }

          return [...prev, formattedMsg];
        });
      } else {
        console.log('[Staff Chat] ❌ SessionId mismatch or no session selected, ignoring');
        // Message from a different session - increment unread count if from user/bot
        if (message.from === 'user') {
          setUnreadCounts((prev) => ({
            ...prev,
            [message.sessionId]: (prev[message.sessionId] || 0) + 1,
          }));
        }
      }

      applySessionUpdate(message.sessionId, (session) => ({
        ...session,
        lastMessageAt: timestampISO,
      }));
    };

    socket.on('new_message', handler);
    return () => {
      socket.off('new_message', handler);
    };
  }, [socket, applySessionUpdate]);

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const params = {};
      if (filter === 'waiting_staff') {
        params.status = 'waiting_staff';
      } else if (filter === 'with_staff') {
        params.status = 'with_staff';
        params.assignedToMe = true;
      } else if (filter === 'all') {
        // 'all' includes: waiting_staff OR assigned to me
        params.includeWaitingAndMine = true;
      }
      const resp = await chatbotApi.getStaffSessions(params);
      const rawSessions = resp?.data?.sessions || [];

      // Defensive client-side filtering to avoid any backend inconsistency
      const filteredSessions =
        filter === 'with_staff'
          ? rawSessions.filter((s) => s.status === 'with_staff')
          : filter === 'waiting_staff'
          ? rawSessions.filter((s) => s.status === 'waiting_staff')
          : rawSessions; // 'all'

      console.debug(
        '[Staff Chat] loadSessions filter:',
        filter,
        'raw:',
        rawSessions.length,
        'after:',
        filteredSessions.length,
      );
      queueSessionRoomJoin(rawSessions);

      setSessions((prev) => {
        const prevMap = new Map(prev.map((s) => [s.sessionId, s]));
        const merged = filteredSessions.map((session) => {
          const prevSession = prevMap.get(session.sessionId) || {};
          const normalizedLast = session.lastMessageAt
            ? normalizeTimestamp(session.lastMessageAt)
            : session.createdAt
            ? normalizeTimestamp(session.createdAt)
            : prevSession.lastMessageAt;
          const normalizedCreated = session.createdAt
            ? normalizeTimestamp(session.createdAt)
            : prevSession.createdAt;
          return {
            ...prevSession,
            ...session,
            lastMessageAt: normalizedLast,
            createdAt: normalizedCreated,
          };
        });
        return sortSessionsByLastMessage(merged);
      });

      setSelectedSession((prev) => {
        if (!prev) return prev;
        const match = filteredSessions.find((s) => s.sessionId === prev.sessionId);
        if (!match) return prev;
        const normalizedLast = match.lastMessageAt
          ? normalizeTimestamp(match.lastMessageAt)
          : match.createdAt
          ? normalizeTimestamp(match.createdAt)
          : prev.lastMessageAt;
        const normalizedCreated = match.createdAt
          ? normalizeTimestamp(match.createdAt)
          : prev.createdAt;
        return {
          ...prev,
          ...match,
          lastMessageAt: normalizedLast,
          createdAt: normalizedCreated,
        };
      });
    } catch (error) {
      console.error('[Staff Chat] Error loading sessions:', error);
    }
  }, [filter, queueSessionRoomJoin, sortSessionsByLastMessage]);

  // Load counts for all filters
  const loadCounts = useCallback(async () => {
    try {
      const [waitingResp, withStaffResp, allResp] = await Promise.all([
        chatbotApi.getStaffSessions({ status: 'waiting_staff' }),
        chatbotApi.getStaffSessions({ status: 'with_staff', assignedToMe: true }),
        chatbotApi.getStaffSessions({ includeWaitingAndMine: true }),
      ]);

      const waitingSessions = waitingResp?.data?.sessions || [];
      const withStaffSessions = withStaffResp?.data?.sessions || [];
      const allSessions = allResp?.data?.sessions || [];

      const sanitizedWaiting = waitingSessions.filter((s) => s.status === 'waiting_staff');
      const sanitizedWithStaff = withStaffSessions.filter((s) => s.status === 'with_staff');
      const sanitizedAll = allSessions.filter(
        (s) => s.status === 'waiting_staff' || s.status === 'with_staff' || s.status === 'resolved',
      );

      queueSessionRoomJoin(sanitizedWaiting);
      queueSessionRoomJoin(sanitizedWithStaff);
      queueSessionRoomJoin(sanitizedAll);

      const nextCounts = {
        waiting: sanitizedWaiting.length,
        withStaff: sanitizedWithStaff.length,
        all: sanitizedAll.length,
      };
      setCounts(nextCounts);
      if (typeof onCountsChange === 'function') {
        onCountsChange(nextCounts);
      }
    } catch (error) {
      console.error('[Staff Chat] Error loading counts:', error);
    }
  }, [onCountsChange, queueSessionRoomJoin]);

  const loadSessionsRef = useRef(loadSessions);
  const loadCountsRef = useRef(loadCounts);

  useEffect(() => {
    loadSessionsRef.current = loadSessions;
  }, [loadSessions]);

  useEffect(() => {
    loadCountsRef.current = loadCounts;
  }, [loadCounts]);

  useEffect(() => {
    loadSessions();
    loadCounts();
    const sessionInterval = setInterval(() => loadSessionsRef.current(), 30000); // Refresh every 30s
    const countInterval = setInterval(() => loadCountsRef.current(), 30000); // Refresh counts every 30s
    return () => {
      clearInterval(sessionInterval);
      clearInterval(countInterval);
    };
  }, [filter, loadSessions, loadCounts]);

  // Join room immediately when selecting session, then load history
  useEffect(() => {
    if (!selectedSession) return;

    // Clear unread count for this session
    setUnreadCounts((prev) => {
      const updated = { ...prev };
      delete updated[selectedSession.sessionId];
      return updated;
    });

    // Join first to avoid race where messages arrive before history finishes
    if (socket) {
      const alreadyJoined = joinedSessionIdsRef.current.has(selectedSession.sessionId);
      joinedSessionIdsRef.current.add(selectedSession.sessionId);
      if (!alreadyJoined) {
        socket.emit('join_chat', selectedSession.sessionId);
        console.log('[Staff Chat] Joined chat room (early):', selectedSession.sessionId);
      }
    }

    let cancelled = false;
    (async () => {
      try {
        const resp = await chatbotApi.getHistory(selectedSession.sessionId);
        if (cancelled) return;
        const msgs = resp?.data?.messages || [];
        console.log('[Staff Chat] Loaded messages:', msgs.length);
        setMessages(msgs);
      } catch (error) {
        if (!cancelled) console.error('[Staff Chat] Error loading history:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSession, socket]);

  // Auto scroll to bottom - instant scroll to show newest message immediately
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedSession) return;

    const tempId = `temp_${Date.now()}`;
    const textToSend = inputText.trim();

    // Optimistically add message
    const newMessage = {
      _id: tempId,
      from: 'staff',
      text: textToSend,
      staffName: user.name,
      createdAt: new Date(),
      pending: true,
    };
    setMessages((prev) => [...prev, newMessage]);
    setInputText('');

    try {
      const result = await chatbotApi.sendStaffMessage({
        sessionId: selectedSession.sessionId,
        text: textToSend,
      });

      // Replace temp message with real one from server
      if (result?.data?.message) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === tempId
              ? {
                  _id: result.data.message._id,
                  from: result.data.message.from,
                  text: result.data.message.text,
                  staffName: result.data.message.staffName,
                  createdAt: result.data.message.createdAt,
                  pending: false,
                }
              : m,
          ),
        );
      }
    } catch (error) {
      console.error('[Staff Chat] Error sending message:', error);
      // Remove failed message
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
    ];
    if (!validTypes.includes(file.type)) {
      alert('Chỉ hỗ trợ file ảnh (JPEG, PNG, GIF, WebP) và video (MP4, WebM)');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File không được vượt quá 10MB');
      return;
    }

    if (!selectedSession) return;

    const tempId = `temp_${Date.now()}`;
    const mediaType = file.type.startsWith('image/') ? 'Ảnh' : 'Video';
    // Dùng text cuối cùng luôn để đồng bộ với socket emit
    const uploadingMessage = {
      _id: tempId,
      from: 'staff',
      text: `${mediaType}: ${file.name}`,
      staffName: user.name,
      createdAt: new Date(),
      pending: true,
      attachment: null,
    };
    setMessages((prev) => [...prev, uploadingMessage]);

    try {
      // Upload file
      const uploadResult = await chatbotApi.uploadStaffMedia(file);

      // Send message with attachment
      const result = await chatbotApi.sendStaffMessage({
        sessionId: selectedSession.sessionId,
        text: `${mediaType}: ${file.name}`,
        attachment: {
          url: uploadResult.url,
          type: uploadResult.resourceType,
          publicId: uploadResult.publicId,
          width: uploadResult.width,
          height: uploadResult.height,
          duration: uploadResult.duration,
        },
      });

      // Replace temp message
      if (result?.data?.message) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === tempId
              ? {
                  _id: result.data.message._id,
                  from: result.data.message.from,
                  text: `${mediaType}: ${file.name}`,
                  staffName: result.data.message.staffName,
                  attachment: result.data.message.attachment || {
                    url: uploadResult.url,
                    type: uploadResult.resourceType,
                    publicId: uploadResult.publicId,
                    width: uploadResult.width,
                    height: uploadResult.height,
                    duration: uploadResult.duration,
                  },
                  createdAt: result.data.message.createdAt,
                  pending: false,
                }
              : m,
          ),
        );
      }
    } catch (error) {
      console.error('[Staff Chat] Error uploading file:', error);
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      alert('Không thể tải file lên. Vui lòng thử lại!');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleProductSelect = async (product) => {
    if (!selectedSession) return;

    const tempId = `temp_${Date.now()}`;

    // Use promotion info that was already calculated in the ProductPickerModal
    // If product already has _promotion attached, use it; otherwise no promotion
    const productData = product._promotion
      ? {
          ...product,
          _promotion: product._promotion,
        }
      : {
          ...product,
          _promotion: null,
        };

    // We previously composed a verbose productText, but product cards now render rich details.
    // To avoid showing redundant text while still satisfying server's "text required" validation,
    // send a zero-width space (\u200B) which survives trim() but is invisible.
    const silentText = '\u200B';

    const newMessage = {
      _id: tempId,
      from: 'staff',
      text: silentText,
      staffName: user.name,
      createdAt: new Date(),
      pending: true,
      productData,
    };
    setMessages((prev) => [...prev, newMessage]);

    try {
      const result = await chatbotApi.sendStaffMessage({
        sessionId: selectedSession.sessionId,
        text: silentText,
        productData: newMessage.productData,
      });

      if (result?.data?.message) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === tempId
              ? {
                  ...result.data.message,
                  productData: newMessage.productData,
                  pending: false,
                }
              : m,
          ),
        );
      }
    } catch (error) {
      console.error('[Staff Chat] Error sending product:', error);
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
    }
  };

  const handleResolve = async () => {
    if (!selectedSession) return;

    try {
      await chatbotApi.resolveSession({ sessionId: selectedSession.sessionId });
      if (joinedSessionIdsRef.current.has(selectedSession.sessionId)) {
        joinedSessionIdsRef.current.delete(selectedSession.sessionId);
        if (socket) {
          socket.emit('leave_chat', selectedSession.sessionId);
          console.log('[Staff Chat] Left session room after resolve:', selectedSession.sessionId);
        }
      }
      setSelectedSession(null);
      setMessages([]);
      loadSessions();
      loadCounts(); // Update counts after resolving
    } catch (error) {
      console.error('[Staff Chat] Error resolving:', error);
    }
  };

  // Accept a waiting session
  const handleAccept = async (sessionId) => {
    try {
      const resp = await chatbotApi.acceptSession({ sessionId });
      applySessionUpdate(sessionId, (session) => ({
        ...session,
        status: 'with_staff',
        assignedStaffId: user._id,
        assignedStaffName: user.name,
      }));
      // Auto select accepted session immediately using response (avoid stale sessions state)
      const accepted = resp?.data?.session || { sessionId, status: 'with_staff' };
      const existingSession = sessions.find((s) => s.sessionId === sessionId) || {};
      const toSelect = {
        ...existingSession,
        sessionId: accepted.sessionId || sessionId,
        status: 'with_staff',
        assignedStaffId: user._id,
        customerInfo: accepted.customerInfo || existingSession.customerInfo || {},
        lastMessageAt: accepted.lastMessageAt
          ? normalizeTimestamp(accepted.lastMessageAt)
          : existingSession.lastMessageAt,
        createdAt: accepted.createdAt
          ? normalizeTimestamp(accepted.createdAt)
          : existingSession.createdAt,
      };
      setSelectedSession(toSelect);
      // Join room right away to receive messages instantly
      if (socket) {
        socket.emit('join_chat', toSelect.sessionId);
        console.log('[Staff Chat] Joined room after accept:', toSelect.sessionId);
      }
      joinedSessionIdsRef.current.add(toSelect.sessionId);
      loadSessions();
      loadCounts(); // Update counts after accepting
    } catch (error) {
      console.error('[Staff Chat] Error accepting session:', error);
    }
  };

  const playNotificationSound = () => {
    // Simple beep sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  const parseDate = (value) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const formatTime = (date) => {
    return parseDate(date).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date) => {
    return parseDate(date).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>💬 Chat với khách hàng</h1>
        <div className={styles.filters}>
          <button
            className={`${styles.filterButton} ${
              filter === 'waiting_staff' ? styles.filterButtonActive : ''
            }`}
            onClick={() => setFilter('waiting_staff')}
          >
            <span className={styles.filterLabel}>Đang chờ</span>
            <span
              className={`${styles.filterBadge} ${counts.waiting > 0 ? styles.filterBadgeHot : ''}`}
            >
              {counts.waiting}
            </span>
          </button>
          <button
            className={`${styles.filterButton} ${
              filter === 'with_staff' ? styles.filterButtonActive : ''
            }`}
            onClick={() => setFilter('with_staff')}
          >
            <span className={styles.filterLabel}>Đang chat</span>
            <span
              className={`${styles.filterBadge} ${
                counts.withStaff > 0 ? styles.filterBadgeHot : ''
              }`}
            >
              {counts.withStaff}
            </span>
          </button>
          <button
            className={`${styles.filterButton} ${
              filter === 'all' ? styles.filterButtonActive : ''
            }`}
            onClick={() => setFilter('all')}
          >
            <span className={styles.filterLabel}>Tất cả</span>
            <span className={styles.filterBadge}>{counts.all}</span>
          </button>
        </div>
      </div>

      <div className={styles.main}>
        {/* Sessions List */}
        <div className={styles.sessionsList}>
          <div className={styles.sessionsHeader}>
            <h3>Danh sách cuộc trò chuyện</h3>
            <button onClick={loadSessions} className={styles.refreshBtn}>
              🔄
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Không có cuộc trò chuyện nào</p>
            </div>
          ) : (
            <div className={styles.sessions}>
              {sessions.map((session) => (
                <div
                  key={session.sessionId}
                  className={`${styles.sessionItem} ${
                    selectedSession?.sessionId === session.sessionId ? styles.selected : ''
                  }`}
                  onClick={() => setSelectedSession(session)}
                >
                  <div className={styles.sessionHeader}>
                    <span className={styles.customerName}>
                      {session.customerInfo?.name || 'Khách hàng'}
                      {unreadCounts[session.sessionId] > 0 && (
                        <span className={styles.unreadBadge}>
                          {unreadCounts[session.sessionId]}
                        </span>
                      )}
                    </span>
                    <span className={styles.sessionTime}>
                      {formatTime(session.lastMessageAt || session.createdAt || Date.now())}
                    </span>
                  </div>
                  <div className={styles.sessionMeta}>
                    <span className={`${styles.status} ${styles[session.status]}`}>
                      {session.status === 'waiting_staff'
                        ? '⏳ Chờ nhân viên'
                        : session.status === 'with_staff'
                        ? '💬 Đang chat'
                        : '✅ Đã xong'}
                    </span>
                    {session.status === 'waiting_staff' && (
                      <button
                        className={styles.acceptBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccept(session.sessionId);
                        }}
                      >
                        Nhận
                      </button>
                    )}
                    {session.assignedStaffId && (
                      <span className={styles.assignedStaff}>
                        👤 {session.assignedStaffId === user?._id ? 'Bạn' : 'Khác'}
                      </span>
                    )}
                  </div>
                  {session.lastMessage && (
                    <div className={styles.lastMessagePreview}>
                      <span className={styles.lastMessageText}>
                        {getMessageDisplayText(session.lastMessage)}
                      </span>
                      {unreadCounts[session.sessionId] > 0 && (
                        <span className={styles.newMessageIndicator}>
                          {unreadCounts[session.sessionId]} tin mới
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className={styles.chatArea}>
          {!selectedSession ? (
            <div className={styles.emptyChat}>
              <p>👈 Chọn cuộc trò chuyện để bắt đầu</p>
            </div>
          ) : (
            <>
              <div className={styles.chatHeader}>
                <div>
                  <h3>{selectedSession.customerInfo?.name || 'Khách hàng'}</h3>
                  <p className={styles.sessionInfo}>
                    {formatDate(
                      selectedSession.lastMessageAt || selectedSession.createdAt || Date.now(),
                    )}
                  </p>
                </div>
                <button onClick={handleResolve} className={styles.resolveBtn}>
                  ✓ Kết thúc
                </button>
              </div>

              <div className={styles.messages}>
                {messages.map((msg) => {
                  const displayText = getMessageDisplayText(msg);
                  const botProductList = msg.from === 'bot' ? extractJSONProducts(msg.text) : null;
                  return (
                    <div
                      key={msg._id}
                      className={`${styles.message} ${
                        msg.from === 'staff' ? styles.staff : styles.customer
                      }`}
                    >
                      <div className={styles.messageContent}>
                        {msg.from !== 'staff' && (
                          <div className={styles.messageSender}>
                            {msg.from === 'bot'
                              ? '🤖 Bot'
                              : `👤 ${selectedSession.customerInfo?.name || 'Khách hàng'}`}
                          </div>
                        )}

                        {/* Display attachment if exists */}
                        {msg.attachment && msg.attachment.url && (
                          <div className={styles.attachmentWrapper}>
                            {msg.attachment.type === 'image' && (
                              <img
                                src={msg.attachment.url}
                                alt={msg.text}
                                className={styles.attachmentImage}
                              />
                            )}
                            {msg.attachment.type === 'video' && (
                              <video
                                src={msg.attachment.url}
                                controls
                                className={styles.attachmentVideo}
                              />
                            )}
                          </div>
                        )}

                        {/* Display text before product list */}
                        {displayText && <div className={styles.messageText}>{displayText}</div>}

                        {/* Display bot product list if exists */}
                        {botProductList && botProductList.length > 0 && (
                          <div className={styles.botProductList}>
                            {botProductList.map((product, idx) => {
                              const slug = (product.slug || '').trim();
                              const cached = slug ? aiProductCache[slug] : null;
                              // Only render an image once we've hydrated a real publicId from DB
                              const imageUrl = cached?.imagePublicId
                                ? buildCloudinaryUrl(cached.imagePublicId, 200)
                                : '';
                              return (
                                <div key={idx} className={styles.botProductCard}>
                                  {imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt={product.name}
                                      className={styles.botProductImage}
                                      onError={(e) => {
                                        e.target.src = '/no-image.png';
                                      }}
                                    />
                                  ) : (
                                    <div
                                      className={styles.botProductImage}
                                      style={{
                                        background: '#f3f4f6',
                                        borderRadius: 8,
                                      }}
                                    />
                                  )}
                                  <div className={styles.botProductInfo}>
                                    <h5>{product.name}</h5>
                                    {product.price && (
                                      <p className={styles.botProductPrice}>
                                        {String(product.price).includes('đ')
                                          ? product.price
                                          : `${product.price}đ`}
                                      </p>
                                    )}
                                    {product.rating && (
                                      <p className={styles.botProductRating}>
                                        ⭐ {product.rating}/5
                                      </p>
                                    )}
                                    <a
                                      href={`/product/${product.slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={styles.botProductLink}
                                    >
                                      Xem chi tiết
                                    </a>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Display product card if exists (staff sent) */}
                        {msg.productData && (
                          <div className={styles.productCard}>
                            <div className={styles.productImageWrapper}>
                              {msg.productData.images?.[0] && (
                                <img
                                  src={
                                    msg.productData.images[0].publicId
                                      ? `https://res.cloudinary.com/${
                                          import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
                                        }/image/upload/w_300,f_auto,q_auto/${
                                          msg.productData.images[0].publicId
                                        }`
                                      : msg.productData.images[0]
                                  }
                                  alt={msg.productData.name}
                                  className={styles.productImage}
                                />
                              )}
                              {msg.productData._promotion?.discountPercent > 0 && (
                                <div className={styles.productDiscountBadge}>
                                  -{Math.round(msg.productData._promotion.discountPercent)}%
                                </div>
                              )}
                            </div>
                            <div className={styles.productInfo}>
                              <h4>{msg.productData.name}</h4>
                              {msg.productData._promotion?.finalPrice !== undefined &&
                              msg.productData._promotion?.originalPrice !== undefined ? (
                                <div className={styles.productPriceRow}>
                                  <span className={styles.productPriceNow}>
                                    {msg.productData._promotion.finalPrice.toLocaleString('vi-VN')}đ
                                  </span>
                                  <span className={styles.productPriceOld}>
                                    {msg.productData._promotion.originalPrice.toLocaleString(
                                      'vi-VN',
                                    )}
                                    đ
                                  </span>
                                </div>
                              ) : (
                                <p className={styles.productPrice}>
                                  {(
                                    msg.productData.minPrice ??
                                    msg.productData.basePrice ??
                                    msg.productData.price ??
                                    0
                                  ).toLocaleString('vi-VN')}
                                  đ
                                </p>
                              )}
                              {msg.productData._promotion?.code && (
                                <div className={styles.productPromoTag}>
                                  {msg.productData._promotion.code}
                                </div>
                              )}
                              <div className={styles.productActions}>
                                <a
                                  href={`/product/${msg.productData.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.productDetailBtn}
                                >
                                  Xem chi tiết
                                </a>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className={styles.messageTime}>
                          {formatTime(msg.createdAt)}
                          {msg.staffName && ` • ${msg.staffName}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className={styles.inputArea}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <div className={styles.actionButtons}>
                  <button
                    className={styles.attachBtn}
                    onClick={() => fileInputRef.current?.click()}
                    title="Gửi ảnh/video"
                    disabled={selectedSession?.status === 'resolved'}
                  >
                    📎 Đính kèm
                  </button>
                  <button
                    className={styles.productBtn}
                    onClick={() => setShowProductPicker(true)}
                    title="Gửi sản phẩm"
                    disabled={selectedSession?.status === 'resolved'}
                  >
                    🛍️ Sản phẩm
                  </button>
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (selectedSession?.status !== 'resolved') {
                        handleSendMessage();
                      }
                    }
                  }}
                  placeholder={
                    selectedSession?.status === 'resolved'
                      ? 'Cuộc trò chuyện đã kết thúc (chỉ xem)'
                      : 'Nhập tin nhắn...'
                  }
                  disabled={selectedSession?.status === 'resolved'}
                />
                <button
                  className={styles.sendBtn}
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || selectedSession?.status === 'resolved'}
                >
                  ✈️ Gửi
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <ProductPickerModal
        isOpen={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        onSelectProduct={handleProductSelect}
      />
    </div>
  );
}
