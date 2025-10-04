import { Router } from "express";
import { postLogin, getMe, postLogout, postAddAddress, postRegister, postFirebaseLogin, postVerifyOtp, postResendOtp,postForgotPassword, postForgotVerify, postForgotReset, postSetDefaultAddress, getAllUsers, postCreateUser, putUpdateUser, getUser, deleteOneUser} from "../controllers/auth.controller.js";
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

//-------------------- ADMIN UTILITIE,-------------------
router.post("/admin/create-user", postCreateUser);   // bodyRequest: email, name, password, role, status
router.put("/admin/update-user/:id", putUpdateUser); //bodyRequest: email, name, role, status (trường nào không nhập thì mặc định là không update nữa)
router.get("/admin/get-user/:id", getUser);
router.get("/admin/get-all-users", getAllUsers); //query name, email, role, fromDate, toDate, page=1, limit=10
router.delete("/admin/delete/:id", deleteOneUser);
export default router;
