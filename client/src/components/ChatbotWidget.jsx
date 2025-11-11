import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatbotApi } from '@/api';
import { productsApi } from '@/api/products-api';
import { promotionsApi } from '@/api/promotions-api';
import { useCart } from '@/contexts/CartProvider';
import { useAuth } from '@/auth/AuthProvider';
import { showAddToCartToast } from '@/components/showAddToCartToast';
import io from 'socket.io-client';
import styles from './ChatbotWidget.module.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

// Helper functions for Cloudinary images
const encodePublicId = (pid) => (pid ? pid.split('/').map(encodeURIComponent).join('/') : '');
const img = (publicId, w = 400) =>
  publicId && CLOUD
    ? `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,w_${w}/${encodePublicId(
        publicId,
      )}`
    : '/no-image.png';

// Generate unique session ID
function generateSessionId() {
  const stored = localStorage.getItem('chatbot_session_id');
  if (stored) return stored;

  const newId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('chatbot_session_id', newId);
  return newId;
}

// Parse product info from bot message
function parseProducts(text) {
  const productRegex = /\*\*(.+?)\*\*[^(]*\(\/product\/([^)]+)\)/g;
  const products = [];
  let match;

  while ((match = productRegex.exec(text)) !== null) {
    const [_, name, slug] = match;
    const priceMatch = text.match(
      new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?Giá:\\s*([\\d.,]+)đ`, 's'),
    );
    const ratingMatch = text.match(
      new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?Rating:\\s*([\\d.]+)/5`, 's'),
    );
    const imageMatch = text.match(
      new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?image:\\s*([^\\s,)]+)`, 's'),
    );

    products.push({
      name: name.trim(),
      slug: slug.trim(),
      price: priceMatch ? priceMatch[1] : null,
      rating: ratingMatch ? ratingMatch[1] : null,
      image: imageMatch ? imageMatch[1] : null,
    });
  }

  return products;
}

// Try to extract a JSON block with product list from bot text
function extractJSONProducts(text) {
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
    // Try to find the end by last closing brace/bracket
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
}

export default function ChatbotWidget() {
  const navigate = useNavigate();
  const { add, refresh } = useCart();
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(generateSessionId());
  const [isLoading, setIsLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [chatMode, setChatMode] = useState('ai'); // 'ai' or 'staff'
  const [socket, setSocket] = useState(null);
  const [activeStaffName, setActiveStaffName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0); // Track unread messages
  const [isSessionResolved, setIsSessionResolved] = useState(false); // Track if session ended
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const sessionIdRef = useRef(sessionId); // Ref to hold current session ID

  // Update ref whenever sessionId changes
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    setActiveStaffName('');
  }, [sessionId]);

  // Modal states for variant selection
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productDetail, setProductDetail] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // When the chat modal is opened, ensure we jump immediately to the latest message.
  // This covers the case where messages were already loaded but the widget was closed,
  // so reopening should show the newest message instead of remaining scrolled to top.
  useEffect(() => {
    if (!isOpen) return;
    // Give React a tick to render the message list, then jump to bottom.
    const t = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 30);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Initialize socket connection
  useEffect(() => {
    console.log('[ChatbotWidget] Initializing socket for session:', sessionId);

    const newSocket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('[ChatbotWidget] ✅ Connected to WebSocket');
      console.log('[ChatbotWidget] Socket ID:', newSocket.id);
      // Join chat room
      console.log('[ChatbotWidget] Joining room: chat:' + sessionId);
      newSocket.emit('join_chat', sessionId);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[ChatbotWidget] ❌ Connection error:', error);
    });

    // Listen for messages from staff
    newSocket.on('new_message', (message) => {
      const currentSessionId = sessionIdRef.current; // Read from ref
      console.log('[ChatbotWidget] 💬 Received new_message event:', message);
      console.log('[ChatbotWidget] Current sessionId (from ref):', currentSessionId);
      console.log('[ChatbotWidget] Message sessionId:', message.sessionId);

      if (message.sessionId === currentSessionId) {
        console.log('[ChatbotWidget] ✅ SessionId matches, adding message');
        // Map sender: server 'user' -> 'user'; 'bot' & 'staff' -> 'bot' for rendering style
        const formattedMsg = {
          id: message._id,
          sender: message.from === 'user' ? 'user' : 'bot',
          text: message.text,
          staffName: message.staffName,
          attachment: message.attachment,
          productData: message.productData,
          timestamp: new Date(message.createdAt),
          pending: false,
          origin: message.from || 'bot',
        };

        // Increment unread count if chatbot is closed and message is from bot/staff
        if (!isOpen && (message.from === 'bot' || message.from === 'staff')) {
          setUnreadCount((prev) => prev + 1);
        }

        setMessages((prev) => {
          // Try to replace existing optimistic entry
          const optimisticIndex = prev.findIndex(
            (m) => m.pending && m.sender === formattedMsg.sender && m.text === formattedMsg.text,
          );

          if (optimisticIndex !== -1) {
            const next = [...prev];
            next[optimisticIndex] = {
              ...next[optimisticIndex],
              ...formattedMsg,
              pending: false,
            };
            console.log('[ChatbotWidget] 🔄 Replaced optimistic message with server payload');
            return next;
          }

          if (
            prev.some(
              (m) =>
                m.id === formattedMsg.id ||
                (!formattedMsg.id &&
                  m.origin === formattedMsg.origin &&
                  m.text === formattedMsg.text &&
                  Math.abs(new Date(m.timestamp).getTime() - formattedMsg.timestamp.getTime()) <
                    2000),
            )
          ) {
            console.log('[ChatbotWidget] ⚠️ Duplicate message, skipping');
            return prev;
          }

          console.log('[ChatbotWidget] ✅ Adding message to state');
          return [...prev, formattedMsg];
        });
        // Scroll bottom after append - instant scroll to show newest message
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }, 30);

        // Fallback enrichment: if staff message lacks productData but contains a product URL,
        // fetch product detail and promotions to render a product card for the customer.
        try {
          if (
            !message.productData &&
            message.from === 'staff' &&
            typeof message.text === 'string'
          ) {
            const match = message.text.match(/\/product\/([a-z0-9-]+)/i);
            const slug = match && match[1];
            if (slug) {
              (async () => {
                try {
                  const prodRes = await productsApi.detailBySlug(slug);
                  const product = prodRes?.data || prodRes?.product || prodRes;
                  if (product && product._id) {
                    const base = Number(
                      product.minPrice ?? product.basePrice ?? product?.variants?.[0]?.price ?? 0,
                    );
                    let bestPromo = null;
                    let finalPrice = base;
                    let discountAmount = 0;
                    let discountPercent = 0;
                    try {
                      const promos = await promotionsApi.available(base, {
                        productIds: [product._id],
                        ...(product.categoryId ? { categoryIds: [product.categoryId] } : {}),
                      });
                      if (Array.isArray(promos) && promos.length > 0) {
                        let maxDiscount = 0;
                        for (const pr of promos) {
                          let d = 0;
                          if (pr?.type === 'percent')
                            d = Math.round((base * Number(pr.value || 0)) / 100);
                          else if (pr?.type === 'amount') d = Number(pr.value || 0);
                          if (d > maxDiscount) {
                            maxDiscount = d;
                            bestPromo = pr;
                          }
                        }
                        if (maxDiscount > 0 && bestPromo) {
                          discountAmount = maxDiscount;
                          discountPercent =
                            bestPromo.type === 'percent'
                              ? Number(bestPromo.value || 0)
                              : Math.round((maxDiscount / Math.max(base, 1)) * 100);
                          finalPrice = Math.max(0, base - discountAmount);
                        }
                      }
                    } catch {}

                    const enrichedProduct = {
                      ...product,
                      _promotion: bestPromo
                        ? {
                            code: bestPromo.code,
                            discountPercent,
                            discountAmount,
                            finalPrice,
                            originalPrice: base,
                          }
                        : null,
                    };

                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === message._id ? { ...m, productData: enrichedProduct } : m,
                      ),
                    );
                  }
                } catch (e) {
                  console.warn('[ChatbotWidget] Fallback enrich failed:', e);
                }
              })();
            }
          }
        } catch {}
      } else {
        console.log('[ChatbotWidget] ❌ SessionId mismatch, ignoring');
      }
    });

    // Listen for AI toggle status
    newSocket.on('ai_toggled', (data) => {
      console.log('[ChatbotWidget] 🤖 AI toggled:', data);
      if (data.sessionId === sessionId) {
        setChatMode(data.aiEnabled ? 'ai' : 'staff');
        if (data.aiEnabled) {
          setActiveStaffName('');
        }
      }
    });

    // Listen for session updates (staff accepted)
    newSocket.on('session_update', (data) => {
      console.log('[ChatbotWidget] 📥 Session update:', data);
      if (data.sessionId === sessionId) {
        // Switch to staff mode immediately when staff joins
        if (data.status === 'with_staff') {
          setChatMode('staff');
          setActiveStaffName(data.staffName || '');
          // Optional: append system message
          setMessages((prev) => [
            ...prev,
            {
              id: `sys_${Date.now()}`,
              sender: 'bot',
              text: `👨‍💼 Nhân viên ${
                data.staffName || 'hỗ trợ'
              } đã tham gia cuộc trò chuyện. Bạn có thể tiếp tục đặt câu hỏi nhé!`,
              timestamp: new Date(),
              origin: 'system',
              pending: false,
            },
          ]);
        } else {
          setActiveStaffName('');
        }
      }
    });

    // Listen for session resolved (staff ended chat)
    newSocket.on('session_resolved', (data) => {
      console.log('[ChatbotWidget] ✅ Session resolved:', data);
      if (data.sessionId === sessionId) {
        // Add system message
        setMessages((prev) => [
          ...prev,
          {
            id: `resolved_${Date.now()}`,
            sender: 'bot',
            text: `✅ ${data.staffName || 'Nhân viên'} đã kết thúc cuộc trò chuyện.\n\n${
              data.message || 'Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!'
            }\n\n💬 Vui lòng nhấn nút "Làm mới" bên dưới để bắt đầu cuộc trò chuyện mới.`,
            timestamp: new Date(),
            origin: 'system',
            pending: false,
          },
        ]);
        // Mark session as resolved to disable input
        setIsSessionResolved(true);
        // Reset to AI mode
        setChatMode('ai');
        setActiveStaffName('');
      }
    });

    setSocket(newSocket);

    return () => {
      console.log('[ChatbotWidget] Disconnecting socket');
      newSocket.emit('leave_chat', sessionId);
      newSocket.disconnect();
    };
  }, [sessionId]);

  // Update selected variant when color/size changes
  useEffect(() => {
    if (!productDetail?.variants?.length) return;

    const found =
      productDetail.variants.find(
        (v) =>
          (!selectedColor || v.color === selectedColor) &&
          (!selectedSize || v.size === selectedSize),
      ) || productDetail.variants[0];

    setSelectedVariant(found);

    // Auto-select size if color changed and current size not available
    if (selectedColor && !found.size) {
      const firstOfColor = productDetail.variants.find((v) => v.color === selectedColor);
      if (firstOfColor) {
        setSelectedSize(firstOfColor.size || null);
      }
    }
  }, [selectedColor, selectedSize, productDetail]);

  // Load chat history when open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const res = await chatbotApi.getHistory(sessionId, 20);

      if (res.success && res.data.messages.length > 0) {
        const formattedMessages = res.data.messages.map((msg) => {
          const isBot = msg.from !== 'user';
          const jsonProducts = isBot ? extractJSONProducts(msg.text) : null;
          return {
            id: msg._id,
            sender: isBot ? 'bot' : 'user',
            text: msg.text,
            attachment: msg.attachment || null,
            productData: msg.productData || null,
            products: isBot
              ? jsonProducts && jsonProducts.length
                ? jsonProducts
                : parseProducts(msg.text)
              : [],
            timestamp: new Date(msg.createdAt),
            origin: msg.from || (isBot ? 'bot' : 'user'),
            staffName: msg.staffName,
            pending: false,
          };
        });
        setMessages(formattedMessages);

        // Restore session state from API response
        if (res.data.session) {
          const { status, assignedStaffName } = res.data.session;

          // If session has assigned staff, restore staff name and chat mode
          if (status === 'with_staff' && assignedStaffName) {
            setActiveStaffName(assignedStaffName);
            setChatMode('staff');
          } else {
            // Otherwise, try to find last staff message
            const lastStaffMessage = [...res.data.messages]
              .reverse()
              .find((msg) => msg.from === 'staff' && msg.staffName);

            if (lastStaffMessage?.staffName) {
              setActiveStaffName(lastStaffMessage.staffName);
              setChatMode('staff');
            }
          }
        } else {
          // Fallback: Find the last staff message to restore activeStaffName
          const lastStaffMessage = [...res.data.messages]
            .reverse()
            .find((msg) => msg.from === 'staff' && msg.staffName);

          if (lastStaffMessage?.staffName) {
            setActiveStaffName(lastStaffMessage.staffName);
            setChatMode('staff');
          }
        }
      } else {
        // No history, show welcome message
        setMessages([
          {
            id: 'welcome',
            sender: 'bot',
            text: 'Xin chào! Em là trợ lý AI của TnQ Fashion. Em có thể giúp gì cho anh/chị? 😊',
            timestamp: new Date(),
            origin: 'system',
            pending: false,
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading history:', error);
      setMessages([
        {
          id: 'welcome',
          sender: 'bot',
          text: 'Xin chào! Em là trợ lý AI của TnQ Fashion. Em có thể giúp gì cho anh/chị? 😊',
          timestamp: new Date(),
          origin: 'system',
          pending: false,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const tempId = `temp_${Date.now()}`;
    const userMessage = {
      id: tempId,
      sender: 'user',
      text: inputText.trim(),
      timestamp: new Date(),
      pending: true,
      origin: 'user',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      const res = await chatbotApi.sendMessage({
        sessionId,
        text: userMessage.text,
        customerInfo: user ? { name: user.name || user.username } : {},
      });

      if (res.success && res.data?.userMessage?._id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId
              ? {
                  ...msg,
                  id: res.data.userMessage._id,
                  pending: false,
                  timestamp: new Date(res.data.userMessage.createdAt),
                  origin: 'user',
                }
              : msg,
          ),
        );
      }

      // If AI disabled (waiting for staff), don't add bot message
      if (res.success && res.data.botMessage) {
        const raw = res.data.botMessage.text;
        const jsonProducts = extractJSONProducts(raw);
        const parsedProducts =
          jsonProducts && jsonProducts.length ? jsonProducts : parseProducts(raw);
        const botMessage = {
          id: res.data.botMessage._id,
          sender: 'bot',
          text: raw,
          attachment: res.data.botMessage.attachment || null,
          products: parsedProducts,
          timestamp: new Date(res.data.botMessage.createdAt),
          origin: res.data.botMessage.from || 'bot',
          pending: false,
        };
        if (res.data.botMessage.from === 'staff' && res.data.botMessage.staffName) {
          setActiveStaffName(res.data.botMessage.staffName);
          setChatMode('staff');
        }
        setMessages((prev) => [...prev, botMessage]);
      }
      // If botMessage không trả về (AI disabled chờ staff) thì realtime auto-message đã được emit ở requestStaff
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        text: 'Xin lỗi, em đang gặp sự cố. Vui lòng thử lại hoặc liên hệ hotline 1900-xxxx! 🙏',
        timestamp: new Date(),
        origin: 'system',
        pending: false,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickQuestions = [
    '📦 Chính sách giao hàng?',
    '↩️ Đổi trả như thế nào?',
    '💳 Thanh toán COD?',
    '🛡️ Bảo hành bao lâu?',
  ];

  const handleQuickQuestion = (question) => {
    setInputText(question);
  };

  const handleRefreshChat = () => {
    // Clear current session
    localStorage.removeItem('chatbot_session_id');
    const newId = generateSessionId();
    setSessionId(newId);
    setChatMode('ai');
    setActiveStaffName('');
    setIsSessionResolved(false); // Reset resolved state
    setMessages([
      {
        id: 'welcome',
        sender: 'bot',
        text: 'Xin chào! Em là trợ lý AI của TnQ Fashion. Em có thể giúp gì cho anh/chị? 😊',
        timestamp: new Date(),
        origin: 'system',
        pending: false,
      },
    ]);
  };

  const handleCategorySelect = (category) => {
    setInputText(`Cho tôi xem ${category}`);
    setShowSidebar(false);
  };

  const handleRequestStaff = async () => {
    console.log('[ChatbotWidget] Requesting staff for session:', sessionId);
    setChatMode('staff');
    setShowSidebar(false);
    setActiveStaffName('');

    // We rely on server to emit the auto system message to avoid duplicates.

    let targetSessionId = sessionId;

    const hasStaffMessages = messages.some((m) => m.origin === 'staff');
    if (hasStaffMessages) {
      // Previous conversation with staff exists; start a fresh session to avoid leaking history
      localStorage.removeItem('chatbot_session_id');
      targetSessionId = generateSessionId();
      sessionIdRef.current = targetSessionId;
      setSessionId(targetSessionId);
      // start fresh with empty history (server will emit system msg)
      setMessages([]);
    }

    try {
      // Request staff - server will create session if needed and save customer name
      const customerInfo = user ? { name: user.name || user.username } : {};
      const result = await chatbotApi.requestStaff(targetSessionId, customerInfo);
      console.log('[ChatbotWidget] Staff request success:', result);

      // No client-side socket.emit here — the API call already notifies staff via server-side emit.

      // Không chèn thêm tin nhắn xác nhận để tránh lặp nội dung
      // Server đã cập nhật trạng thái và staff dashboard sẽ nhận realtime.
    } catch (error) {
      console.error('[ChatbotWidget] Error requesting staff:', error);
      console.error('[ChatbotWidget] Error details:', error.response?.data);

      // Show error message to user
      const errorMessage = {
        id: Date.now() + 2,
        sender: 'bot',
        text: 'Xin lỗi, không thể kết nối với nhân viên lúc này. Vui lòng thử lại sau! 🙏',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleSwitchToAI = async () => {
    setShowSidebar(false);
    try {
      // Ask server to re-enable AI for this session
      await chatbotApi.toggleAIPublic({ sessionId, enabled: true });
    } catch (err) {
      console.error('[ChatbotWidget] Error toggling AI public:', err?.response?.data || err);
    }
    setChatMode('ai');
    setActiveStaffName('');
    setIsSessionResolved(false);
    // Inform user
    setMessages((prev) => [
      ...prev,
      {
        id: `sys_ai_${Date.now()}`,
        sender: 'bot',
        text: 'Bạn đã chuyển về Chat với AI. Mình sẽ hỗ trợ bạn tiếp theo nhé! 🤖',
        timestamp: new Date(),
        origin: 'system',
        pending: false,
      },
    ]);
  };

  const handleAddToCart = async (product) => {
    try {
      // Fetch product details to get variants
      const detail = await productsApi.detailBySlug(product.slug);
      setProductDetail(detail);
      setSelectedProduct(product);

      // If product has variants (color/size), show modal
      if (detail?.variants && detail.variants.length > 0) {
        const firstVariant = detail.variants[0];
        setSelectedColor(firstVariant.color || null);
        setSelectedSize(firstVariant.size || null);
        setSelectedVariant(firstVariant);
        setShowVariantModal(true);
      } else {
        // No variants, add directly
        await add({
          productId: detail._id,
          variantSku: null,
          qty: 1,
        });
        await refresh();

        // Show success toast
        const coverId =
          detail.images?.find?.((im) => im?.isPrimary)?.publicId || detail.images?.[0]?.publicId;
        showAddToCartToast({
          name: detail.name,
          variantText: '',
          price: Number(detail.price),
          imageUrl: img(coverId, 160),
          duration: 2600,
          onViewCart: async () => {
            await refresh();
            navigate('/cart');
          },
        });
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const handleConfirmAddToCart = async () => {
    if (!selectedVariant || !productDetail) return;

    try {
      await add({
        productId: productDetail._id,
        variantSku: selectedVariant.sku,
        qty: 1,
      });
      await refresh();

      // Close modal
      setShowVariantModal(false);

      // Show success toast
      const coverId =
        productDetail.images?.find?.((im) => im?.isPrimary)?.publicId ||
        productDetail.images?.[0]?.publicId;
      showAddToCartToast({
        name: productDetail.name,
        variantText: [selectedVariant.color, selectedVariant.size].filter(Boolean).join(' / '),
        price: Number(selectedVariant.price || productDetail.price),
        imageUrl: img(coverId, 160),
        duration: 2600,
        onViewCart: async () => {
          await refresh();
          navigate('/cart');
        },
      });
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const handleViewProduct = (product) => {
    navigate(`/product/${product.slug}`);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (images and videos)
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
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert('File không được vượt quá 10MB');
      return;
    }

    setSelectedFile(file);

    // Create optimistic message
    const tempId = `temp_${Date.now()}`;
    const mediaType = file.type.startsWith('image/') ? 'Ảnh' : 'Video';
    // Dùng text cuối cùng ngay từ đầu để socket thay thế optimistic message chuẩn
    const uploadingMessage = {
      id: tempId,
      sender: 'user',
      text: `${mediaType}: ${file.name}`,
      timestamp: new Date(),
      origin: 'user',
      pending: true,
      attachment: null,
    };
    setMessages((prev) => [...prev, uploadingMessage]);

    try {
      // Upload file to server
      const uploadResult = await chatbotApi.uploadChatMedia(file);

      // Send message with attachment info
      const res = await chatbotApi.sendMessage({
        sessionId,
        text: `${mediaType}: ${file.name}`,
        customerInfo: user ? { name: user.name || user.username } : {},
        attachment: {
          url: uploadResult.url,
          type: uploadResult.resourceType,
          publicId: uploadResult.publicId,
          width: uploadResult.width,
          height: uploadResult.height,
          duration: uploadResult.duration,
        },
      });

      if (res.success && res.data?.userMessage?._id) {
        // Replace optimistic message with confirmed message
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId
              ? {
                  ...msg,
                  id: res.data.userMessage._id,
                  text: `${mediaType}: ${file.name}`,
                  pending: false,
                  timestamp: new Date(res.data.userMessage.createdAt),
                  attachment: res.data.userMessage.attachment || {
                    url: uploadResult.url,
                    type: uploadResult.resourceType,
                    publicId: uploadResult.publicId,
                    width: uploadResult.width,
                    height: uploadResult.height,
                    duration: uploadResult.duration,
                  },
                }
              : msg,
          ),
        );
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      // Remove optimistic message and show error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        text: 'Xin lỗi, không thể tải file lên. Vui lòng thử lại! 🙏',
        timestamp: new Date(),
        origin: 'system',
        pending: false,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAttachClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const categoryOptions = [
    { icon: '👔', label: 'Áo thun nam', value: 'áo thun nam' },
    { icon: '👗', label: 'Áo thun nữ', value: 'áo thun nữ' },
    { icon: '👕', label: 'Áo polo', value: 'áo polo' },
    { icon: '🧥', label: 'Áo khoác', value: 'áo khoác' },
    { icon: '👖', label: 'Quần', value: 'quần' },
    { icon: '🎽', label: 'Phụ kiện', value: 'phụ kiện' },
  ];

  return (
    <>
      {/* Floating Button - Hide when chat is open */}
      {!isOpen && (
        <button
          className={styles.chatButton}
          onClick={() => {
            setIsOpen(true);
            setUnreadCount(0); // Reset unread count when opening chat
          }}
          aria-label="Chat với TnQ AI"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.badge}>AI</span>
          {unreadCount > 0 && (
            <span className={styles.unreadBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={styles.chatWindow}>
          {/* Sidebar Menu */}
          {showSidebar && (
            <div className={styles.sidebar}>
              <div className={styles.sidebarHeader}>
                <h4>📋 Menu</h4>
                <button onClick={() => setShowSidebar(false)}>×</button>
              </div>

              <div className={styles.sidebarSection}>
                <p className={styles.sidebarTitle}>Hỗ trợ</p>
                {chatMode === 'ai' && (
                  <button className={styles.sidebarItem} onClick={handleRequestStaff}>
                    <span>👤</span>
                    <span>Chat với nhân viên</span>
                  </button>
                )}
                {chatMode === 'staff' && (
                  <>
                    <button className={styles.sidebarItem} onClick={handleSwitchToAI}>
                      <span>🤖</span>
                      <span>Chat với AI</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Header */}
          <div className={styles.chatHeader}>
            <button className={styles.menuBtn} onClick={() => setShowSidebar(!showSidebar)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="3" y1="6" x2="21" y2="6" strokeWidth="2" strokeLinecap="round" />
                <line x1="3" y1="12" x2="21" y2="12" strokeWidth="2" strokeLinecap="round" />
                <line x1="3" y1="18" x2="21" y2="18" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <div className={styles.headerInfo}>
              <div className={styles.avatar}>{chatMode === 'ai' ? '🤖' : '👤'}</div>
              <div>
                <h4>
                  {chatMode === 'ai' ? 'TnQ AI Assistant' : activeStaffName || 'Nhân viên hỗ trợ'}
                </h4>
                <p>
                  {chatMode === 'ai'
                    ? 'Trợ lý ảo của TnQ Fashion'
                    : activeStaffName
                    ? `Đang chat với ${activeStaffName}`
                    : 'Đang kết nối...'}
                </p>
              </div>
            </div>

            <div className={styles.headerActions}>
              <button
                className={styles.refreshBtn}
                onClick={handleRefreshChat}
                title="Làm mới cuộc trò chuyện"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className={styles.chatMessages}>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                <div className={styles.typingIndicator}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <p style={{ marginTop: '12px', fontSize: '14px' }}>Đang tải lịch sử chat...</p>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`${styles.message} ${
                      msg.sender === 'user' ? styles.userMessage : styles.botMessage
                    }`}
                  >
                    {msg.sender === 'bot' && (
                      <div className={styles.msgAvatar}>
                        {msg.origin === 'staff' ? '👤' : chatMode === 'ai' ? '🤖' : '👤'}
                      </div>
                    )}
                    <div className={styles.msgContent}>
                      {/* Show staff name if message is from staff */}
                      {msg.origin === 'staff' && msg.staffName && (
                        <div className={styles.staffLabel}>👤 {msg.staffName}</div>
                      )}

                      {/* Display attachment if exists */}
                      {msg.attachment && msg.attachment.url && (
                        <div className={styles.attachmentWrapper}>
                          {msg.attachment.type === 'image' && (
                            <img
                              src={msg.attachment.url}
                              alt={msg.text}
                              className={styles.attachmentImage}
                              style={{
                                maxWidth: '300px',
                                borderRadius: '8px',
                                marginBottom: '8px',
                              }}
                            />
                          )}
                          {msg.attachment.type === 'video' && (
                            <video
                              src={msg.attachment.url}
                              controls
                              className={styles.attachmentVideo}
                              style={{
                                maxWidth: '300px',
                                borderRadius: '8px',
                                marginBottom: '8px',
                              }}
                            />
                          )}
                        </div>
                      )}

                      {/* Only show text if no products were extracted, or show cleaned text */}
                      {(!msg.products || msg.products.length === 0) &&
                        !msg.productData &&
                        (() => {
                          // Hide "Ảnh: filename" or "Video: filename" when attachment exists
                          if (msg.attachment && msg.text) {
                            const cleanText = msg.text
                              .replace(/^(Ảnh|Video):\s*.+$/i, '')
                              .replace(/[\u200B-\u200D\uFEFF]/g, '')
                              .trim();
                            return cleanText ? <p>{cleanText}</p> : null;
                          }
                          const normalized = (msg.text || '')
                            .replace(/[\u200B-\u200D\uFEFF]/g, '')
                            .trim();
                          return normalized ? <p>{normalized}</p> : null;
                        })()}
                      {msg.products && msg.products.length > 0 && (
                        <p>
                          {(() => {
                            let cleaned = msg.text;
                            // Remove fenced code blocks
                            cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
                            // Remove JSON objects (greedy match from first { to last })
                            const firstBrace = cleaned.indexOf('{');
                            const lastBrace = cleaned.lastIndexOf('}');
                            if (firstBrace >= 0 && lastBrace > firstBrace) {
                              cleaned = cleaned.slice(0, firstBrace) + cleaned.slice(lastBrace + 1);
                            }
                            // Remove JSON arrays
                            const firstBracket = cleaned.indexOf('[');
                            const lastBracket = cleaned.lastIndexOf(']');
                            if (firstBracket >= 0 && lastBracket > firstBracket) {
                              cleaned =
                                cleaned.slice(0, firstBracket) + cleaned.slice(lastBracket + 1);
                            }
                            // Clean up residual punctuation
                            cleaned = cleaned.replace(/[,\s]*$/g, '').trim();
                            return (
                              cleaned ||
                              'Dưới đây là danh sách một số sản phẩm mà Anh/Chị có thể tham khảo:'
                            );
                          })()}
                        </p>
                      )}

                      {/* Staff Product Card (single) */}
                      {msg.productData && (
                        <div className={styles.singleProductCard}>
                          <div className={styles.singleProductImageWrapper}>
                            {msg.productData.images?.[0] && (
                              <img
                                src={
                                  msg.productData.images[0].publicId
                                    ? img(msg.productData.images[0].publicId, 300)
                                    : msg.productData.images[0]
                                }
                                alt={msg.productData.name}
                                className={styles.singleProductImage}
                              />
                            )}
                            {msg.productData._promotion?.discountPercent > 0 && (
                              <div className={styles.singleProductBadge}>
                                -{Math.round(msg.productData._promotion.discountPercent)}%
                              </div>
                            )}
                          </div>
                          <div className={styles.singleProductInfo}>
                            <h5 className={styles.singleProductName}>{msg.productData.name}</h5>
                            {msg.productData._promotion?.finalPrice ? (
                              <div className={styles.singleProductPriceRow}>
                                <span className={styles.singleProductPriceNow}>
                                  {msg.productData._promotion.finalPrice.toLocaleString('vi-VN')}đ
                                </span>
                                <span className={styles.singleProductPriceOld}>
                                  {msg.productData._promotion.originalPrice.toLocaleString('vi-VN')}
                                  đ
                                </span>
                              </div>
                            ) : (
                              <p className={styles.singleProductPrice}>
                                {(
                                  msg.productData.minPrice ??
                                  msg.productData.basePrice ??
                                  0
                                ).toLocaleString('vi-VN')}
                                đ
                              </p>
                            )}
                            {msg.productData._promotion?.code && (
                              <div className={styles.singleProductPromoTag}>
                                {msg.productData._promotion.code}
                              </div>
                            )}
                            <div className={styles.singleProductActions}>
                              <button
                                type="button"
                                className={styles.singleProductBtn}
                                onClick={() => navigate(`/product/${msg.productData.slug}`)}
                              >
                                Xem chi tiết
                              </button>
                              <button
                                className={styles.singleProductAddBtn}
                                onClick={() =>
                                  handleAddToCart({
                                    slug: msg.productData.slug,
                                    name: msg.productData.name,
                                  })
                                }
                              >
                                🛒 Thêm vào giỏ
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Product Cards */}
                      {msg.products && msg.products.length > 0 && (
                        <div className={styles.productCards}>
                          {msg.products.map((product, idx) => (
                            <div
                              key={idx}
                              className={styles.productCard}
                              onClick={() => handleViewProduct(product)}
                            >
                              {product.image && (
                                <img
                                  src={img(product.image, 400)}
                                  alt={product.name}
                                  className={styles.productImage}
                                  onError={(e) => {
                                    e.target.src = '/no-image.png';
                                  }}
                                />
                              )}
                              <div className={styles.productInfo}>
                                <h5 className={styles.productName}>{product.name}</h5>
                                {product.price && (
                                  <p className={styles.productPrice}>{product.price}đ</p>
                                )}
                                {product.rating && (
                                  <p className={styles.productRating}>⭐ {product.rating}/5</p>
                                )}
                              </div>
                              <div className={styles.productActions}>
                                <button
                                  className={styles.productLink}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewProduct(product);
                                  }}
                                >
                                  Xem chi tiết
                                </button>
                                <button
                                  className={styles.addToCartBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddToCart(product);
                                  }}
                                >
                                  🛒 Thêm vào giỏ
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <span className={styles.msgTime}>
                        {msg.timestamp.toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className={`${styles.message} ${styles.botMessage}`}>
                    <div className={styles.msgAvatar}>🤖</div>
                    <div className={styles.typingIndicator}>
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Quick Questions */}
          {messages.length === 1 && (
            <div className={styles.quickQuestions}>
              <p>💡 Câu hỏi gợi ý:</p>
              <div className={styles.quickBtns}>
                {quickQuestions.map((q, idx) => (
                  <button key={idx} onClick={() => handleQuickQuestion(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className={styles.chatInputWrapper}>
            <div className={styles.chatInput}>
              {chatMode === 'staff' && !isSessionResolved && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={handleAttachClick}
                    className={styles.attachBtn}
                    title="Gửi ảnh/video"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </>
              )}
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  isSessionResolved ? 'Vui lòng làm mới để chat tiếp...' : 'Nhập câu hỏi của bạn...'
                }
                rows={1}
                disabled={isSessionResolved}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || isSessionResolved}
                className={styles.sendBtn}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
            <p className={styles.disclaimer}>
              ℹ️ Thông tin chỉ mang tính tham khảo, được tư vấn bởi Trí Tuệ Nhân Tạo
            </p>
          </div>
        </div>
      )}

      {/* Variant Selection Modal */}
      {showVariantModal && productDetail && (
        <div className={styles.modalOverlay} onClick={() => setShowVariantModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Chọn phân loại hàng</h3>
              <button className={styles.modalClose} onClick={() => setShowVariantModal(false)}>
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalProduct}>
                <img
                  src={img(productDetail.images?.[0]?.publicId, 200)}
                  alt={productDetail.name}
                  className={styles.modalProductImage}
                />
                <div className={styles.modalProductInfo}>
                  <h4>{productDetail.name}</h4>
                  <p className={styles.modalPrice}>
                    {new Intl.NumberFormat('vi-VN').format(
                      selectedVariant?.price || productDetail.price,
                    )}
                    đ
                  </p>
                  {selectedVariant && (
                    <p className={styles.modalStock}>Kho: {selectedVariant.stock || 0}</p>
                  )}
                </div>
              </div>

              {/* Color Selection */}
              {(() => {
                const colors = [
                  ...new Set(productDetail.variants.map((v) => v.color).filter(Boolean)),
                ];
                return (
                  colors.length > 0 && (
                    <div className={styles.variantSection}>
                      <label>Màu sắc:</label>
                      <div className={styles.variantOptions}>
                        {colors.map((color) => (
                          <button
                            key={color}
                            className={`${styles.variantBtn} ${
                              selectedColor === color ? styles.active : ''
                            }`}
                            onClick={() => setSelectedColor(color)}
                          >
                            {color}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                );
              })()}

              {/* Size Selection */}
              {(() => {
                const sizes = [
                  ...new Set(
                    productDetail.variants
                      .filter((v) => !selectedColor || v.color === selectedColor)
                      .map((v) => v.size)
                      .filter(Boolean),
                  ),
                ];
                return (
                  sizes.length > 0 && (
                    <div className={styles.variantSection}>
                      <label>Kích thước:</label>
                      <div className={styles.variantOptions}>
                        {sizes.map((size) => (
                          <button
                            key={size}
                            className={`${styles.variantBtn} ${
                              selectedSize === size ? styles.active : ''
                            }`}
                            onClick={() => setSelectedSize(size)}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                );
              })()}
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowVariantModal(false)}>
                Hủy
              </button>
              <button
                className={styles.confirmBtn}
                onClick={handleConfirmAddToCart}
                disabled={!selectedVariant || (selectedVariant.stock || 0) === 0}
              >
                Thêm vào giỏ hàng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
