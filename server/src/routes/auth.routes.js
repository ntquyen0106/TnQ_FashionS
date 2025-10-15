import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
const router = Router();

//Basic routes
router.post("/login", authController.postLogin);  // body: { email, password }
router.get("/me", requireAuth, authController.getMe);
router.post("/logout", requireAuth, authController.postLogout);
router.post("/add-address", requireAuth, authController.postAddAddress);
router.post("/register", authController.postRegister); // body: { email, password, name }
router.post("/firebase-login", authController.postFirebaseLogin);
router.post("/verify-otp", authController.postVerifyOtp); // body: { email, otp, password, name }
router.post("/resend-otp", authController.postResendOtp);
router.post("/forgot", authController.postForgotPassword);
router.post("/forgot/verify", authController.postForgotVerify);
router.post("/forgot/reset", authController.postForgotReset);
router.post("/add-address", requireAuth, authController.postAddAddress); // body: { address }
router.post("/set-default-address", requireAuth, authController.postSetDefaultAddress); // body: { addressId }
router.put("/change-password", requireAuth, authController.putChangePassword); // body: { oldPassword, newPassword, confirmNewPassword }
//-------------------- ADMIN UTILITIE,-------------------
router.post("/admin/create-user", requireAuth, authController.postCreateUser);   // bodyRequest: email, name, password, role, status
router.put("/admin/update-user/:id", requireAuth, authController.putUpdateUser); //bodyRequest: email, name, role, status (trường nào không nhập thì mặc định là không update nữa)
router.get("/admin/get-user/:id", requireAuth, authController.getUser);
router.get("/admin/get-all-users", requireAuth, authController.getAllUsers); //query name, email, role, fromDate, toDate, page=1, limit=10
router.delete("/admin/delete/:id", requireAuth, authController.deleteOneUser);
export default router;
