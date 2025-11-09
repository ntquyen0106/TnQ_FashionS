import { chatbotService } from '../services/chatbot.service.js';
import Policy from '../models/Policy.js';

/**
 * @route   POST /api/chatbot/message
 * @desc    Send message (AI or staff will respond)
 * @access  Public (guest or logged in)
 */
export const postSendMessage = async (req, res) => {
  try {
    const { sessionId, text, customerInfo } = req.body;
    const userId = req.user?._id || null;

    if (!sessionId || !text?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'sessionId and text are required',
      });
    }

    const result = await chatbotService.sendMessage({
      sessionId,
      userId,
      text: text.trim(),
      customerInfo: customerInfo || {},
    });

    // Chỉ trả data cần thiết cho frontend
    res.json({
      success: true,
      data: {
        userMessage: {
          _id: result.userMessage._id,
          from: result.userMessage.from,
          text: result.userMessage.text,
          createdAt: result.userMessage.createdAt,
        },
        botMessage: result.botMessage
          ? {
              _id: result.botMessage._id,
              from: result.botMessage.from,
              text: result.botMessage.text,
              createdAt: result.botMessage.createdAt,
            }
          : null,
        session: {
          sessionId: result.session.sessionId,
          status: result.session.status,
          aiEnabled: result.session.aiEnabled,
        },
      },
    });
  } catch (error) {
    console.error('❌ [Chatbot Controller] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   GET /api/chatbot/history/:sessionId
 * @desc    Get chat history
 * @access  Public
 */
export const getHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit } = req.query;

    const messages = await chatbotService.getHistory(sessionId, limit ? parseInt(limit) : 50);

    // Chỉ trả fields cần thiết
    const simplifiedMessages = messages.map((m) => ({
      _id: m._id,
      from: m.from,
      text: m.text,
      createdAt: m.createdAt,
      staffName: m.staffName,
    }));

    res.json({
      success: true,
      data: { messages: simplifiedMessages },
    });
  } catch (error) {
    console.error('❌ [Chatbot Controller] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   POST /api/chatbot/request-staff
 * @desc    Request staff support
 * @access  Public
 */
export const postRequestStaff = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'sessionId is required',
      });
    }

    await chatbotService.requestStaff(sessionId);

    res.json({
      success: true,
      message: 'Staff requested. Please wait...',
    });
  } catch (error) {
    console.error('❌ [Chatbot Controller] Error:', error);
    res.status(error.code || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   POST /api/chatbot/staff/message
 * @desc    Staff send message
 * @access  Private (staff/admin)
 */
export const postStaffSendMessage = async (req, res) => {
  try {
    const { sessionId, text } = req.body;
    const staffId = req.user._id;
    const staffName = req.user.name || 'Staff';

    if (!sessionId || !text?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'sessionId and text are required',
      });
    }

    const result = await chatbotService.sendStaffMessage({
      sessionId,
      staffId,
      staffName,
      text: text.trim(),
    });

    res.json({
      success: true,
      data: {
        message: {
          _id: result.message._id,
          from: result.message.from,
          text: result.message.text,
          staffName: result.message.staffName,
          createdAt: result.message.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('❌ [Chatbot Controller] Error:', error);
    res.status(error.code || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   GET /api/chatbot/staff/sessions
 * @desc    List all chat sessions for staff
 * @access  Private (staff/admin)
 */
export const getStaffSessions = async (req, res) => {
  try {
    const { status, assignedToMe, page, limit } = req.query;
    const staffId = assignedToMe === 'true' ? req.user._id : null;

    const result = await chatbotService.listStaffSessions({
      status,
      assignedToMe: assignedToMe === 'true',
      staffId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });

    // Simplify response
    const simplifiedSessions = result.sessions.map((s) => ({
      sessionId: s.sessionId,
      status: s.status,
      aiEnabled: s.aiEnabled,
      customerInfo: s.customerInfo,
      lastMessageAt: s.lastMessageAt,
      assignedStaff: s.assignedStaffId ? { name: s.assignedStaffId.name } : null,
    }));

    res.json({
      success: true,
      data: {
        sessions: simplifiedSessions,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('❌ [Chatbot Controller] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   POST /api/chatbot/staff/toggle-ai
 * @desc    Toggle AI on/off
 * @access  Private (staff/admin)
 */
export const postToggleAI = async (req, res) => {
  try {
    const { sessionId, enabled } = req.body;

    if (!sessionId || typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'sessionId and enabled (boolean) are required',
      });
    }

    const session = await chatbotService.toggleAI(sessionId, enabled);

    res.json({
      success: true,
      data: {
        session: {
          sessionId: session.sessionId,
          aiEnabled: session.aiEnabled,
          status: session.status,
        },
      },
    });
  } catch (error) {
    console.error('❌ [Chatbot Controller] Error:', error);
    res.status(error.code || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   POST /api/chatbot/resolve
 * @desc    Mark session as resolved
 * @access  Public
 */
export const postResolveSession = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'sessionId is required',
      });
    }

    await chatbotService.resolveSession(sessionId);

    res.json({
      success: true,
      message: 'Session resolved',
    });
  } catch (error) {
    console.error('❌ [Chatbot Controller] Error:', error);
    res.status(error.code || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   DELETE /api/chatbot/session/:sessionId
 * @desc    Clear session
 * @access  Public
 */
export const deleteClearSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    await chatbotService.clearSession(sessionId);

    res.json({
      success: true,
      message: 'Session cleared',
    });
  } catch (error) {
    console.error('❌ [Chatbot Controller] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

// ============ TRAINING APIs (Admin/Staff) ============

/**
 * @route   POST /api/chatbot/training/policy
 * @desc    Add/Update training data (policies, FAQs, etc)
 * @access  Private (staff/admin)
 */
export const postTrainingData = async (req, res) => {
  try {
    const { type, title, content, order, metadata } = req.body;

    if (!type || !title || !content) {
      return res.status(400).json({
        success: false,
        message: 'type, title, and content are required',
      });
    }

    // Validate type
    const validTypes = ['shipping', 'return', 'payment', 'warranty', 'faq', 'about'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `type must be one of: ${validTypes.join(', ')}`,
      });
    }

    const policy = await Policy.create({
      type,
      title,
      content,
      order: order || 0,
      isActive: true,
      metadata: metadata || {},
    });

    res.json({
      success: true,
      message: 'Training data added',
      data: {
        _id: policy._id,
        type: policy.type,
        title: policy.title,
      },
    });
  } catch (error) {
    console.error('❌ [Training] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   PUT /api/chatbot/training/policy/:id
 * @desc    Update training data
 * @access  Private (staff/admin)
 */
export const putTrainingData = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, order, isActive, metadata } = req.body;

    const policy = await Policy.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(title && { title }),
          ...(content && { content }),
          ...(order !== undefined && { order }),
          ...(isActive !== undefined && { isActive }),
          ...(metadata && { metadata }),
        },
      },
      { new: true }
    );

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Training data not found',
      });
    }

    res.json({
      success: true,
      message: 'Training data updated',
      data: {
        _id: policy._id,
        type: policy.type,
        title: policy.title,
      },
    });
  } catch (error) {
    console.error('❌ [Training] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   GET /api/chatbot/training/policies
 * @desc    Get all training data
 * @access  Private (staff/admin)
 */
export const getTrainingData = async (req, res) => {
  try {
    const { type, isActive } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (isActive) filter.isActive = isActive === 'true';

    const policies = await Policy.find(filter).sort({ type: 1, order: 1 }).lean();

    res.json({
      success: true,
      data: {
        policies: policies.map((p) => ({
          _id: p._id,
          type: p.type,
          title: p.title,
          content: p.content,
          order: p.order,
          isActive: p.isActive,
        })),
      },
    });
  } catch (error) {
    console.error('❌ [Training] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   DELETE /api/chatbot/training/policy/:id
 * @desc    Delete training data
 * @access  Private (staff/admin)
 */
export const deleteTrainingData = async (req, res) => {
  try {
    const { id } = req.params;

    const policy = await Policy.findByIdAndDelete(id);

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Training data not found',
      });
    }

    res.json({
      success: true,
      message: 'Training data deleted',
    });
  } catch (error) {
    console.error('❌ [Training] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};
