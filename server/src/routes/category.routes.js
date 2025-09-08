import { Router } from "express";
import * as ctrl from "../controllers/category.controller.js";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
const router = Router();

//PUBLIC ROUTES
router.get("/", ctrl.getAllCategories);


//ADMIN ROUTES
router.post("/", requireAuth, requireRole("admin"), ctrl.createCategory);
router.put("/:id", requireAuth, requireRole("admin"), ctrl.updateCategory);
router.delete("/:id", requireAuth, requireRole("admin"), ctrl.deleteCategory);
export default router;