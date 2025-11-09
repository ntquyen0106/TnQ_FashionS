import BotSession from '../models/BotSession.js';
import ChatMessage from '../models/ChatMessage.js';
import Product from '../models/Product.js';
import Policy from '../models/Policy.js';
import Category from '../models/Category.js';
import Promotion from '../models/Promotion.js';
import axios from 'axios';

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
        .select('name description slug variants categoryId ratingAvg attributes')
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

        return `${i + 1}. ${p.name} - ${p.categoryId?.name || 'N/A'}
   Giá: ${priceRange}, Còn: ${stock} sp, Rating: ${p.ratingAvg || 0}/5
   ${attrs ? `Đặc điểm: ${attrs}` : ''}
   Link: /products/${p.slug}`;
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
  async sendMessage({ sessionId, userId, text, customerInfo }) {
    // Get/create session
    const session = await this.getOrCreateSession(sessionId, userId, customerInfo);

    // Check if AI is enabled
    if (!session.aiEnabled) {
      // Save message but don't trigger AI
      const userMessage = await ChatMessage.create({
        sessionId,
        userId,
        from: 'user',
        text,
      });

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
    });

    // Get chat history (last 8 messages)
    const history = await ChatMessage.find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

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
- Trả lời ngắn gọn, dễ hiểu, thân thiện 😊
- LUÔN đề xuất sản phẩm CỤ THỂ với link
- KHÔNG bịa đặt thông tin không có trong dữ liệu
- Nếu khách hỏi phức tạp → "Để mình kết nối bạn với nhân viên tư vấn nhé!"
- Ưu tiên sản phẩm có rating cao và còn hàng

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
        }
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
  async sendStaffMessage({ sessionId, staffId, staffName, text }) {
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
    });

    return { message, session };
  },

  /**
   * Request staff help
   */
  async requestStaff(sessionId) {
    const session = await BotSession.findOne({ sessionId });

    if (!session) {
      throw { code: 404, message: 'Session not found' };
    }

    await BotSession.findByIdAndUpdate(session._id, {
      $set: {
        status: 'waiting_staff',
        aiEnabled: false,
      },
    });

    // Send auto message
    await ChatMessage.create({
      sessionId,
      from: 'bot',
      text: 'Đã chuyển cho nhân viên tư vấn. Vui lòng chờ trong giây lát nhé! 👨‍💼',
      confidence: 1,
    });

    return { success: true, message: 'Waiting for staff' };
  },

  /**
   * Staff list sessions
   */
  async listStaffSessions({ status, assignedToMe, staffId, page = 1, limit = 20 }) {
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (assignedToMe && staffId) {
      filter.assignedStaffId = staffId;
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
   * Toggle AI
   */
  async toggleAI(sessionId, enabled) {
    const session = await BotSession.findOneAndUpdate(
      { sessionId },
      { $set: { aiEnabled: enabled } },
      { new: true }
    );

    if (!session) {
      throw { code: 404, message: 'Session not found' };
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
      { new: true }
    );

    if (!session) {
      throw { code: 404, message: 'Session not found' };
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
