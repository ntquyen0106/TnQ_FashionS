import BotSession from '../models/BotSession.js';
import ChatMessage from '../models/ChatMessage.js';
import Product from '../models/Product.js';
import Policy from '../models/Policy.js';
import Category from '../models/Category.js';
import Promotion from '../models/Promotion.js';
import axios from 'axios';
import { getIO } from '../config/socket.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo';

/**
 * Hybrid Chatbot Service - AI + Staff Support
 */
export const chatbotService = {
  /**
   * Get or create bot session
   */
  async getOrCreateSession(sessionId, userId = null, customerInfo = {}) {
    let session = await BotSession.findOne({ sessionId });

    if (!session) {
      session = await BotSession.create({
        sessionId,
        userId,
        channel: 'web',
        status: 'active',
        aiEnabled: true,
        customerInfo: {
          name: customerInfo.name || '',
          email: customerInfo.email || '',
          phone: customerInfo.phone || '',
        },
        context: new Map(),
        lastMessageAt: new Date(),
      });
    }

    return session;
  },

  /**
   * Build comprehensive knowledge base
   */
  async buildKnowledgeBase() {
    const [products, categories, policies, promotions] = await Promise.all([
      Product.find({ status: 'active' })
        .select('name description slug variants categoryId ratingAvg attributes images')
        .populate('categoryId', 'name')
        .limit(30)
        .lean(),
      Category.find({ status: 'active' }).select('name description').lean(),
      Policy.find({ isActive: true }).select('type title content').lean(),
      Promotion.find({
        isActive: true,
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
      })
        .select('code discountType discountValue minOrderValue description')
        .lean(),
    ]);

    return { products, categories, policies, promotions };
  },

  /**
   * Format knowledge base for AI
   */
  formatKnowledgeForAI(kb) {
    const { products, categories, policies, promotions } = kb;

    // Format products
    const productList = products
      .map((p, i) => {
        const minPrice = Math.min(...p.variants.map((v) => v.price));
        const maxPrice = Math.max(...p.variants.map((v) => v.price));
        const stock = p.variants.reduce((sum, v) => sum + v.stock, 0);
        const priceRange =
          minPrice === maxPrice
            ? `${minPrice.toLocaleString('vi-VN')}đ`
            : `${minPrice.toLocaleString('vi-VN')}đ - ${maxPrice.toLocaleString('vi-VN')}đ`;

        const attrs = p.attributes
          ? Object.entries(p.attributes)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')
          : '';

        // Get primary image publicId or first image
        const primaryImage = p.images?.find((img) => img.isPrimary);
        const imagePublicId = primaryImage?.publicId || p.images?.[0]?.publicId || '';

        return `${i + 1}. **${p.name}** - ${p.categoryId?.name || 'N/A'}
   Giá: ${priceRange}, Còn: ${stock} sp, Rating: ${p.ratingAvg || 0}/5
   ${attrs ? `Đặc điểm: ${attrs}` : ''}${imagePublicId ? `, image: ${imagePublicId}` : ''}
   (/product/${p.slug})`;
      })
      .join('\n\n');

    // Format categories
    const categoryList = categories.map((c) => `- ${c.name}: ${c.description || ''}`).join('\n');

    // Format policies by type
    const policyGroups = {};
    policies.forEach((p) => {
      if (!policyGroups[p.type]) policyGroups[p.type] = [];
      policyGroups[p.type].push(p);
    });

    let policyText = '';
    Object.entries(policyGroups).forEach(([type, items]) => {
      const typeLabel = {
        shipping: 'VẬN CHUYỂN',
        return: 'ĐỔI TRẢ',
        payment: 'THANH TOÁN',
        warranty: 'BẢO HÀNH',
        faq: 'CÂU HỎI THƯỜNG GẶP',
        about: 'GIỚI THIỆU',
      }[type];

      policyText += `\n**${typeLabel}:**\n`;
      items.forEach((item) => {
        policyText += `${item.content}\n\n`;
      });
    });

    // Format promotions
    const promotionList = promotions
      .map((promo) => {
        const discountText =
          promo.discountType === 'percentage'
            ? `Giảm ${promo.discountValue}%`
            : `Giảm ${promo.discountValue.toLocaleString('vi-VN')}đ`;
        const minOrder = promo.minOrderValue
          ? ` (Đơn tối thiểu ${promo.minOrderValue.toLocaleString('vi-VN')}đ)`
          : '';
        return `- Mã: ${promo.code} - ${discountText}${minOrder}\n  ${promo.description || ''}`;
      })
      .join('\n');

    return {
      products: productList,
      categories: categoryList,
      policies: policyText,
      promotions: promotionList,
    };
  },

  /**
   * Send message from user
   */
  async sendMessage({ sessionId, userId, text, customerInfo, attachment = null, io = null }) {
    // Get/create session
    const session = await this.getOrCreateSession(sessionId, userId, customerInfo);

    // Check if AI is enabled
    if (!session.aiEnabled) {
      // Save message but don't trigger AI (waiting for staff)
      const userMessage = await ChatMessage.create({
        sessionId,
        userId,
        from: 'user',
        text,
        ...(attachment && { attachment }),
      });

      await BotSession.findByIdAndUpdate(session._id, {
        $set: {
          lastMessageAt: userMessage.createdAt,
          updatedAt: new Date(),
        },
      });

      // Emit to staff in this session's chat room
      if (io) {
        console.log(`[Chatbot Service] Emitting user message to room chat:${sessionId}`);
        io.to(`chat:${sessionId}`).emit('new_message', {
          _id: userMessage._id,
          sessionId,
          from: 'user',
          text: userMessage.text,
          attachment: userMessage.attachment,
          createdAt: userMessage.createdAt,
        });
        console.log(`[Chatbot Service] ✅ User message emitted`);
      }

      return {
        userMessage,
        botMessage: null,
        session,
        message: 'Waiting for staff response',
      };
    }

    // Save user message
    const userMessage = await ChatMessage.create({
      sessionId,
      userId,
      from: 'user',
      text,
      ...(attachment && { attachment }),
    });

    // Get chat history (last 8 messages)
    const history = await ChatMessage.find({ sessionId }).sort({ createdAt: -1 }).limit(8).lean();

    // Build context for AI
    const messages = history.reverse().map((msg) => ({
      role: msg.from === 'user' ? 'user' : 'assistant',
      content: msg.text,
    }));

    // Get AI response
    const botResponse = await this.getAIResponse(text, messages);

    // Save bot message
    const botMessage = await ChatMessage.create({
      sessionId,
      userId,
      from: 'bot',
      text: botResponse,
      confidence: 0.9,
    });

    // Realtime emit BOTH user & bot messages so staff dashboard (and any other listeners) get them immediately
    if (io) {
      try {
        io.to(`chat:${sessionId}`).emit('new_message', {
          _id: userMessage._id,
          sessionId,
          from: 'user',
          text: userMessage.text,
          attachment: userMessage.attachment,
          createdAt: userMessage.createdAt,
        });
        io.to(`chat:${sessionId}`).emit('new_message', {
          _id: botMessage._id,
          sessionId,
          from: 'bot',
          text: botMessage.text,
          createdAt: botMessage.createdAt,
        });
      } catch (emitErr) {
        console.error('[Chatbot Service] Emit error (AI path):', emitErr.message);
      }
    }

    // Update session
    await BotSession.findByIdAndUpdate(session._id, {
      $set: {
        lastIntent: 'general_chat',
        'context.lastQuery': text,
        lastMessageAt: new Date(),
      },
    });

    return {
      userMessage,
      botMessage,
      session,
    };
  },

  /**
   * Get AI response with full knowledge base
   */
  async getAIResponse(userMessage, chatHistory = []) {
    try {
      const kb = await this.buildKnowledgeBase();
      const formatted = this.formatKnowledgeForAI(kb);

      const systemPrompt = `Bạn là trợ lý AI của cửa hàng thời trang TnQ Fashion.

**NHIỆM VỤ:**
- Tư vấn sản phẩm thời trang (áo, quần, váy, phụ kiện)
- Giải đáp về giá cả, chính sách, khuyến mãi
- Hướng dẫn chọn size, phối đồ
- Hỗ trợ tìm sản phẩm phù hợp

**QUY TẮC:**
- Trả lời lịch sự, thân thiện với xưng hô "Anh/Chị"
- KHÔNG bịa đặt thông tin không có trong dữ liệu
- Nếu khách hỏi phức tạp → "Để em kết nối Anh/Chị với nhân viên tư vấn nhé!"
- Ưu tiên sản phẩm có rating cao và còn hàng

**FORMAT KHI TRẢ LỜI SẢN PHẨM:**
BẮT BUỘC có 2 phần:
1. Câu dẫn lịch sự (VD: "Dạ, em xin gửi Anh/Chị danh sách một số áo thun nữ size S mà shop hiện có:")
2. JSON object ngay sau đó

**SCHEMA JSON:**
{ "type": "product_list", "items": [ { "name": "Tên sản phẩm", "slug": "slug-san-pham", "image": "/uploads/products/hinh.jpg", "price": 179000, "rating": 4.5 } ] }

**VÍ DỤ HOÀN CHỈNH:**
Dạ, em xin gửi Anh/Chị danh sách một số áo thun nữ size S mà shop hiện có:
{ "type": "product_list", "items": [ { "name": "Áo thun nữ basic trắng", "slug": "ao-thun-nu-basic-trang", "image": "/uploads/products/ao-thun-nu-basic-trang-1.jpg", "price": 179000, "rating": 4.5 } ] }

Nếu câu hỏi về chính sách/thông tin chung → chỉ trả lời văn bản, KHÔNG dùng JSON.

**DANH MỤC SẢN PHẨM:**
${formatted.categories}

**SẢN PHẨM HIỆN CÓ:**
${formatted.products}

**CHƯƠNG TRÌNH KHUYẾN MÃI:**
${formatted.promotions || 'Hiện tại chưa có khuyến mãi đặc biệt.'}

**CHÍNH SÁCH CỬA HÀNG:**
${formatted.policies}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.slice(-6),
        { role: 'user', content: userMessage },
      ];

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: OPENROUTER_MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 800,
          top_p: 0.9,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:5173',
            'X-Title': 'TnQ Fashion Chatbot',
          },
          timeout: 30000,
        },
      );

      const aiContent = response.data.choices?.[0]?.message?.content?.trim();

      if (!aiContent) {
        console.error('[Chatbot] AI trả về rỗng');
        return 'Xin lỗi, tôi đang gặp sự cố. Bạn có muốn chat với nhân viên không? 😅';
      }

      return aiContent;
    } catch (error) {
      console.error('[Chatbot] Lỗi:', error.response?.data?.error || error.message);

      if (error.code === 'ECONNABORTED') {
        return 'Kết nối bị timeout. Bạn có muốn chat với nhân viên không? ⏱️';
      }

      return 'Xin lỗi, tôi gặp lỗi. Để mình kết nối bạn với nhân viên nhé! 👨‍💼';
    }
  },

  /**
   * Staff send message
   */
  async sendStaffMessage({
    sessionId,
    staffId,
    staffName,
    text,
    attachment = null,
    productData = null,
    io = null,
  }) {
    const session = await BotSession.findOne({ sessionId });

    if (!session) {
      throw { code: 404, message: 'Session not found' };
    }

    // Disable AI when staff joins
    await BotSession.findByIdAndUpdate(session._id, {
      $set: {
        status: 'with_staff',
        aiEnabled: false,
        assignedStaffId: staffId,
        lastMessageAt: new Date(),
      },
    });

    // Save staff message
    const message = await ChatMessage.create({
      sessionId,
      userId: session.userId,
      from: 'staff',
      text,
      staffId,
      staffName,
      ...(attachment && { attachment }),
      ...(productData && { metadata: new Map([['productData', productData]]) }),
    });

    // Emit message to customer
    if (io) {
      console.log(`[Chatbot Service] Emitting staff message to room chat:${sessionId}`);
      io.to(`chat:${sessionId}`).emit('new_message', {
        _id: message._id,
        sessionId,
        from: 'staff',
        text: message.text,
        staffName,
        attachment: message.attachment,
        productData:
          productData ||
          (message.metadata &&
            (message.metadata.get
              ? message.metadata.get('productData')
              : message.metadata.productData)) ||
          null,
        createdAt: message.createdAt,
      });
      console.log(`[Chatbot Service] ✅ Staff message emitted`);
    }

    return { message, session };
  },

  /**
   * Request staff help
   */
  async requestStaff(sessionId, io = null, customerInfo = {}) {
    let session = await BotSession.findOne({ sessionId });

    // Create session if not exists
    if (!session) {
      console.log(`[Chatbot] Session ${sessionId} not found, creating new session...`);
      session = await this.getOrCreateSession(sessionId, null, customerInfo);
    }

    // Update session with customer info if provided
    await BotSession.findByIdAndUpdate(session._id, {
      $set: {
        status: 'waiting_staff',
        aiEnabled: false,
        updatedAt: new Date(),
        ...(customerInfo && Object.keys(customerInfo).length > 0 && { customerInfo }),
      },
    });

    // Reload session to get updated data
    session = await BotSession.findById(session._id);

    // Send auto message
    const autoMsg = await ChatMessage.create({
      sessionId,
      from: 'bot',
      text: 'Đã chuyển cho nhân viên tư vấn. Vui lòng chờ trong giây lát nhé! 👨‍💼',
      confidence: 1,
    });

    await BotSession.findByIdAndUpdate(session._id, {
      $set: {
        lastMessageAt: autoMsg.createdAt,
        updatedAt: new Date(),
      },
    });

    // Emit notification to all staff
    if (io) {
      io.to('staff-room').emit('new_staff_request', {
        sessionId,
        customerName: session.customerInfo?.name || 'Khách hàng',
        timestamp: new Date(),
      });
      // Also emit the auto-message to the chat room so both sides see it if open
      io.to(`chat:${sessionId}`).emit('new_message', {
        _id: autoMsg._id,
        sessionId,
        from: 'bot',
        text: autoMsg.text,
        createdAt: autoMsg.createdAt,
      });
    }

    return { success: true, message: 'Waiting for staff' };
  },

  /**
   * Staff accepts a waiting session
   */
  async acceptSession(sessionId, staffId, staffName, io = null) {
    const session = await BotSession.findOne({ sessionId });

    if (!session) {
      throw { code: 404, message: 'Session not found' };
    }

    // If already assigned to another staff, block
    if (session.assignedStaffId && String(session.assignedStaffId) !== String(staffId)) {
      throw { code: 409, message: 'Session already accepted by another staff' };
    }

    // Update assignment
    session.status = 'with_staff';
    session.aiEnabled = false;
    session.assignedStaffId = staffId;
    session.lastMessageAt = new Date();
    await session.save();

    // Notify all staff so others remove from waiting list
    if (io) {
      io.to('staff-room').emit('session_accepted', {
        sessionId,
        staffId,
        staffName,
        timestamp: new Date().toISOString(),
      });
      // Notify the actual chat room so customer UI can switch to staff mode immediately
      io.to(`chat:${sessionId}`).emit('session_update', {
        sessionId,
        status: session.status,
        aiEnabled: session.aiEnabled,
        staffId,
        staffName,
      });
      // Also emit an explicit AI toggle event for existing listener logic (if any future usage)
      io.to(`chat:${sessionId}`).emit('ai_toggled', {
        sessionId,
        aiEnabled: session.aiEnabled,
      });
    }

    return { success: true, session };
  },

  /**
   * Staff list sessions
   */
  async listStaffSessions({
    status,
    assignedToMe,
    staffId,
    includeWaitingAndMine,
    page = 1,
    limit = 20,
  }) {
    let filter = {};

    if (includeWaitingAndMine && staffId) {
      // 'all' filter: waiting_staff OR (assigned to me with_staff) OR (assigned to me resolved)
      filter.$or = [
        { status: 'waiting_staff' },
        { assignedStaffId: staffId, status: 'with_staff' },
        { assignedStaffId: staffId, status: 'resolved' },
      ];
    } else {
      // Build filter conditions
      if (status) {
        filter.status = status;
      }

      if (assignedToMe && staffId) {
        filter.assignedStaffId = staffId;
      }

      // Safety: if status explicitly 'with_staff', ensure we do NOT include waiting_staff
      if (status === 'with_staff') {
        filter.status = 'with_staff';
      }
    }

    const sessions = await BotSession.find(filter)
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name email')
      .populate('assignedStaffId', 'name')
      .lean();

    const total = await BotSession.countDocuments(filter);

    return {
      sessions,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    };
  },

  /**
   * Get chat history
   */
  async getHistory(sessionId, limit = 50) {
    const messages = await ChatMessage.find({ sessionId })
      .sort({ createdAt: 1 })
      .limit(limit)
      .populate('userId', 'name email')
      .lean();

    return messages;
  },

  /**
   * Get session info
   */
  async getSessionInfo(sessionId) {
    const session = await BotSession.findOne({ sessionId })
      .populate('assignedStaffId', 'name')
      .lean();

    return session;
  },

  /**
   * Toggle AI
   */
  async toggleAI(sessionId, enabled) {
    const session = await BotSession.findOneAndUpdate(
      { sessionId },
      { $set: { aiEnabled: enabled } },
      { new: true },
    );

    if (!session) {
      throw { code: 404, message: 'Session not found' };
    }

    // Emit ai_toggled to the chat room so clients can react
    try {
      const io = getIO();
      io.to(`chat:${sessionId}`).emit('ai_toggled', {
        sessionId,
        aiEnabled: session.aiEnabled,
      });
    } catch (e) {
      // Socket may not be initialized in some environments; log and continue
      console.warn('[Chatbot Service] getIO() unavailable:', e.message || e);
    }

    return session;
  },

  /**
   * Resolve session
   */
  async resolveSession(sessionId) {
    const session = await BotSession.findOneAndUpdate(
      { sessionId },
      { $set: { status: 'resolved', aiEnabled: false } },
      { new: true },
    ).populate('assignedStaffId', 'name');

    if (!session) {
      throw { code: 404, message: 'Session not found' };
    }

    // Emit socket event to notify customer
    const io = getIO();
    if (io) {
      io.to(`chat:${sessionId}`).emit('session_resolved', {
        sessionId,
        message: 'Cuộc trò chuyện đã kết thúc. Cảm ơn bạn đã sử dụng dịch vụ!',
        staffName: session.assignedStaffId?.name || 'Nhân viên',
        timestamp: new Date().toISOString(),
      });
    }

    return session;
  },

  /**
   * Clear session
   */
  async clearSession(sessionId) {
    await ChatMessage.deleteMany({ sessionId });
    await BotSession.deleteOne({ sessionId });
    return { success: true };
  },
};
