import { Router } from "express";
import { list, detail, create, update, remove } from "../controllers/product.controller.js";

const router = Router();
router.get("/", list);
router.get("/:id", detail);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
