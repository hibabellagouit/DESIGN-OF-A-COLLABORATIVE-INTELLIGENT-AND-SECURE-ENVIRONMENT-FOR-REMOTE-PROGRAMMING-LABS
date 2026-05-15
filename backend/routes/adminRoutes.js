import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  loginAdmin,
  firstSetupAdmin,
  listUsers,
  patchUserDisabled,
  getSecurityPolicy,
  updateSecurityPolicy,
  listAuditLogs,
  createAdmin,
} from "../controllers/adminController.js";

const router = express.Router();

router.post("/login", loginAdmin);
router.post("/first-setup", firstSetupAdmin);

router.get("/users", requireAuth, requireRole("admin"), listUsers);
router.patch("/users/:role/:id", requireAuth, requireRole("admin"), patchUserDisabled);
router.post("/admins", requireAuth, requireRole("admin"), createAdmin);

router.get("/security-policy", requireAuth, requireRole("admin"), getSecurityPolicy);
router.put("/security-policy", requireAuth, requireRole("admin"), updateSecurityPolicy);

router.get("/audit-logs", requireAuth, requireRole("admin"), listAuditLogs);

export default router;
