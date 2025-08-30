import { Router } from "express";
import { postLogin, getMe, postLogout, postAddAddress, postRegister, postFirebaseLogin, postVerifyOtp, postResendOtp,postForgotPassword, postForgotVerify, postForgotReset,postFacebookLogin} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
const router = Router();

router.post("/login", postLogin);  // body: { email, password }
router.get("/me", requireAuth, getMe);
router.post("/logout", requireAuth, postLogout);
router.post("/add-address", requireAuth, postAddAddress);
router.post("/register", postRegister); // body: { email, password, name }
router.post("/firebase-login", postFirebaseLogin);
router.post("/verify-otp", postVerifyOtp); // body: { email, otp, password, name }
router.post("/resend-otp", postResendOtp);
router.post("/forgot", postForgotPassword);
router.post("/forgot/verify", postForgotVerify);
router.post("/forgot/reset", postForgotReset);
router.post("/facebook-login", postFacebookLogin);
export default router;
