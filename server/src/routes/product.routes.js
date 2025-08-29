import { Router } from "express";
import * as ctrl from "../controllers/product.controller.js";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/", ctrl.list);
router.get("/:id", ctrl.getOne);

router.post("/", requireAuth, requireRole("admin","staff"), ctrl.create);
router.put("/:id", requireAuth, requireRole("admin","staff"), ctrl.update);
router.delete("/:id", requireAuth, requireRole("admin"), ctrl.remove);

export default router;
