import Policy from '../models/Policy.js';

/**
 * @route   GET /api/training/policies
 * @desc    Get all policies (grouped by type for easy management)
 * @access  Private (staff/admin)
 */
export const getAllPolicies = async (req, res) => {
  try {
    const { type, isActive } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const policies = await Policy.find(filter).sort({ type: 1, order: 1 }).lean();

    // Group by type for frontend
    const grouped = policies.reduce((acc, policy) => {
      if (!acc[policy.type]) acc[policy.type] = [];
      acc[policy.type].push({
        _id: policy._id,
        title: policy.title,
        content: policy.content,
        order: policy.order,
        isActive: policy.isActive,
        metadata: policy.metadata,
        createdAt: policy.createdAt,
        updatedAt: policy.updatedAt,
      });
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        policies: grouped,
        total: policies.length,
        types: Object.keys(grouped),
      },
    });
  } catch (error) {
    console.error('[Training] Lỗi getAllPolicies:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   POST /api/training/policy
 * @desc    Create new policy
 * @access  Private (staff/admin)
 */
export const createPolicy = async (req, res) => {
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

    res.status(201).json({
      success: true,
      message: 'Policy created successfully',
      data: {
        _id: policy._id,
        type: policy.type,
        title: policy.title,
        content: policy.content,
        order: policy.order,
        isActive: policy.isActive,
        metadata: policy.metadata,
      },
    });
  } catch (error) {
    console.error('[Training] Lỗi createPolicy:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   GET /api/training/policy/:id
 * @desc    Get single policy by ID
 * @access  Private (staff/admin)
 */
export const getPolicyById = async (req, res) => {
  try {
    const { id } = req.params;

    const policy = await Policy.findById(id).lean();

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Policy not found',
      });
    }

    res.json({
      success: true,
      data: policy,
    });
  } catch (error) {
    console.error('[Training] Lỗi getPolicyById:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   PUT /api/training/policy/:id
 * @desc    Update policy
 * @access  Private (staff/admin)
 */
export const updatePolicy = async (req, res) => {
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
        message: 'Policy not found',
      });
    }

    res.json({
      success: true,
      message: 'Policy updated successfully',
      data: {
        _id: policy._id,
        type: policy.type,
        title: policy.title,
        content: policy.content,
        order: policy.order,
        isActive: policy.isActive,
        metadata: policy.metadata,
      },
    });
  } catch (error) {
    console.error('[Training] Lỗi updatePolicy:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   DELETE /api/training/policy/:id
 * @desc    Delete policy
 * @access  Private (admin only)
 */
export const deletePolicy = async (req, res) => {
  try {
    const { id } = req.params;

    const policy = await Policy.findByIdAndDelete(id);

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Policy not found',
      });
    }

    res.json({
      success: true,
      message: 'Policy deleted successfully',
    });
  } catch (error) {
    console.error('[Training] Lỗi deletePolicy:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   PATCH /api/training/policy/:id/toggle
 * @desc    Toggle policy active status
 * @access  Private (staff/admin)
 */
export const togglePolicyStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const policy = await Policy.findById(id);

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Policy not found',
      });
    }

    policy.isActive = !policy.isActive;
    await policy.save();

    res.json({
      success: true,
      message: `Policy ${policy.isActive ? 'activated' : 'deactivated'}`,
      data: {
        _id: policy._id,
        title: policy.title,
        isActive: policy.isActive,
      },
    });
  } catch (error) {
    console.error('[Training] Lỗi togglePolicyStatus:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};


