import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { trackLastLogin } from "../middlewares/trackLastLogin.js";

const router = Router();

/* -------------------- USER PROFILE & SETTINGS ROUTES -------------------- */
// All routes require authentication
router.use(requireAuth, trackLastLogin);

// Profile Management
router.get("/profile", userController.getProfile);                    // Get my profile  
router.put("/profile", userController.putProfile);                    // Update profile { name?, email? }
router.put("/password", userController.putChangePassword);            // Change password { oldPassword, newPassword, confirmNewPassword }

// Address Management
router.get("/addresses", userController.getAddresses);               // Get all my addresses
router.post("/addresses", userController.postAddAddress);            // Add new address { address }
router.put("/addresses/:addressId", userController.putUpdateAddress); // Update specific address
router.delete("/addresses/:addressId", userController.deleteAddress); // Delete specific address
router.delete("/addresses", userController.clearAddresses);          // Clear all addresses
router.patch("/addresses/:addressId/default", userController.postSetDefaultAddress); // Set default address

export default router;