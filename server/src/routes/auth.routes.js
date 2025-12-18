import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = Router();

/* -------------------- AUTHENTICATION ROUTES -------------------- */
//api/auth/
// Login & Registration
router.post('/login', authController.postLogin); // { identifier, password, remember? } - identifier can be email or phone
router.post('/register', authController.postRegister); // { phoneNumber, email?, password, confirmPassword, name } - returns nextStep
router.post('/verify-phone', authController.postVerifyPhone); // { firebaseIdToken, phoneNumber, email?, password, name } - creates user after Firebase verification
router.post('/verify-otp', authController.postVerifyOtp); // { email, otp, password, name }
router.post('/resend-otp', authController.postResendOtp); // { email }

// Social Login
router.post('/firebase-login', authController.postFirebaseLogin); // { idToken, remember? }
router.post('/facebook-login', authController.postFacebookLogin); // { accessToken, remember? }
router.post('/add-phone', requireAuth, authController.postAddPhoneToGoogleUser); // {firebaseIdToken, phoneNumber } - Add phone to Google account 

// Password Reset
router.post('/forgot', authController.postForgotPassword); // { email }
router.post('/forgot/verify', authController.postForgotVerify); // { email, otp }
router.post('/forgot/verify-phone', authController.postForgotVerifyPhone); // { firebaseIdToken, phoneNumber }
router.post('/forgot/reset', authController.postForgotReset); // { email, newPassword, confirmNewPassword }

// Session Management
router.get('/me', requireAuth, authController.getMe); // Get current user
router.get('/socket-token', requireAuth, authController.getSocketToken); // Get short-lived token for Socket.IO
router.post('/logout', requireAuth, authController.postLogout);

router.post('/change-password-first', requireAuth, authController.postChangePasswordFirst);

export default router;
