import express from "express";
import Assignment from "../models/Assignment.js";
import {
  assignProject,
  validateAssignment,
  getAssignmentsForStudent,
  getSelectableProjectsForStudent,
  selectProjectForStudent,
} from "../controllers/assignmentController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// POST assigner projet
router.post("/", requireAuth, requireRole("teacher"), assignProject);

// POST valider
router.post("/validate", requireAuth, requireRole("teacher"), validateAssignment);

router.get("/student/:studentId", requireAuth, requireRole("student"), getAssignmentsForStudent);
router.get(
  "/student/:studentId/selectable-projects",
  requireAuth,
  requireRole("student"),
  getSelectableProjectsForStudent
);
router.post("/student/select-project", requireAuth, requireRole("student"), selectProjectForStudent);

// 🔥 IMPORTANT : GET pour React
router.get("/", requireAuth, requireRole("teacher"), async (req, res) => {
  const assignments = await Assignment.find()
    .populate("project")
    .populate("students");

  res.json(assignments);
});

export default router;