import { Router } from "express";
import * as adminUserController from "../controllers/admin-user.controller.js";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";

const router = Router();

router.use(requireAuth, requireRole('admin'));

// User CRUD Operations  
router.get("/", adminUserController.getAllUsers);           // GET /admin/users?name&email&role&fromDate&toDate&page=1&size=10&sortBy&sortDirection=(asc|desc)
router.post("/", adminUserController.postCreateUser);       // POST /admin/users { email, name, password, role?, status? }
router.get("/:id", adminUserController.getUser);           // GET /admin/users/:id
router.put("/:id", adminUserController.putUpdateUser);     // PUT /admin/users/:id { email?, name?, role?, status? }  
router.delete("/:id", adminUserController.deleteOneUser);  // DELETE /admin/users/:id

export default router;