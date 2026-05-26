import express from "express";
import { registerTeacher, loginTeacher } from "../controllers/teacherController.js";
import {
  exportGradesCsv,
  getAiGradeCorrelation,
  getTeacherPending,
} from "../controllers/teacherDashboardController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", registerTeacher);
router.post("/login", loginTeacher);

router.get("/pending", requireAuth, requireRole("teacher"), getTeacherPending);
router.get("/export/grades.csv", requireAuth, requireRole("teacher"), exportGradesCsv);
router.get("/ai-correlation", requireAuth, requireRole("teacher"), getAiGradeCorrelation);

export default router;