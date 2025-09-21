import { Router } from "express";
import { postLogin, getMe, postLogout, postAddAddress, postRegister, postFirebaseLogin, postVerifyOtp, postResendOtp,postForgotPassword, postForgotVerify, postForgotReset, postSetDefaultAddress, getAllUsers} from "../controllers/auth.controller.js";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
const router = Router();


//Basic routes
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
router.post("/add-address", requireAuth, postAddAddress); // body: { address }
router.post("/set-default-address", requireAuth, postSetDefaultAddress); // body: { addressId }

//-------------------- ADMIN UTILITIES --------------------
router.get("/admin/users", requireAuth, requireRole("admin"), getAllUsers);
// router.post("/admin/change-role/:id", requireAuth, requireRole("admin"), postChangeUserRole); // body: { role }
// router.post("/admin/create-user", requireAuth, requireRole("admin"), postCreateUser); // body: { email, password, name, role }
// router.put("/admin/update-user/:id", requireAuth, requireRole("admin"), postUpdateUser); // body: { email, password, name, role }
// router.delete("/admin/delete-user/:id", requireAuth, requireRole("admin"), postDeleteUser);
export default router;
