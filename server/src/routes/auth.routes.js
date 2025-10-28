import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = Router();

/* -------------------- AUTHENTICATION ROUTES -------------------- */
//api/auth/
// Login & Registration
router.post('/login', authController.postLogin); // { email, password, remember? }
router.post('/register', authController.postRegister); // { email, password, name }
router.post('/verify-otp', authController.postVerifyOtp); // { email, otp, password, name }
router.post('/resend-otp', authController.postResendOtp); // { email }

// Social Login
router.post('/firebase-login', authController.postFirebaseLogin); // { idToken, remember? }
router.post('/facebook-login', authController.postFacebookLogin); // { accessToken, remember? }

// Password Reset
router.post('/forgot', authController.postForgotPassword); // { email }
router.post('/forgot/verify', authController.postForgotVerify); // { email, otp }
router.post('/forgot/reset', authController.postForgotReset); // { email, newPassword, confirmNewPassword }

// Session Management
router.get('/me', requireAuth, authController.getMe); // Get current user
router.post('/logout', requireAuth, authController.postLogout); // Logout

// First-login password change (no old password, requires auth)
router.post('/change-password-first', requireAuth, authController.postChangePasswordFirst);

export default router;
