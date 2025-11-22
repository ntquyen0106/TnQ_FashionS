import User from '../models/User.js';

/**
 * Middleware để track last login time
 * Chỉ update nếu đã quá 5 phút kể từ lần update cuối (tránh overload DB)
 */
export const trackLastLogin = async (req, res, next) => {
  try {
    if (req.user && req.user._id) {
      const now = new Date();
      const lastLogin = req.user.lastLoginAt;

      // Chỉ update nếu chưa có hoặc đã qua 5 phút (300000ms)
      if (!lastLogin || now - lastLogin > 5 * 60 * 1000) {
        // Update không cần await để không block request
        User.findByIdAndUpdate(
          req.user._id,
          { lastLoginAt: now },
          { new: false },
        ).catch((err) => {
          // Silent fail - không block request
          console.error('[trackLastLogin] Error updating lastLoginAt:', err);
        });
      }
    }
  } catch (error) {
    // Silent fail - không block request
    console.error('[trackLastLogin] Unexpected error:', error);
  }
  next();
};
