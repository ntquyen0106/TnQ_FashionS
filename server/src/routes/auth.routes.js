import { Router } from "express";
import { postLogin, getMe, postLogout, postAddAddress, postRegister, postFirebaseLogin, postVerifyOtp, postResendOtp} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
const router = Router();

router.post("/login", postLogin);  // body: { email, password }
router.get("/me", requireAuth, getMe);
router.post("/logout", requireAuth, postLogout);
router.post("/add-address", requireAuth, postAddAddress);
router.post("/register", postRegister); // body: { email, password }
router.post("/firebase-login", postFirebaseLogin);
router.post("/verify-otp", postVerifyOtp); // body: { email, otp, password, name }
router.post("/resend-otp", postResendOtp);
export default router;
