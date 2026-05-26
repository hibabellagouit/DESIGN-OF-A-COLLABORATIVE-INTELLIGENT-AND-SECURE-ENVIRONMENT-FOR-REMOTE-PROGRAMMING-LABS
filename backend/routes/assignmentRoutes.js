import express from "express";
import Assignment from "../models/Assignment.js";
import {
  assignProject,
  validateAssignment,
  gradeAssignmentTeam,
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

// PATCH note d’équipe (50 %) + calcul commits (50 %)
router.patch("/:id/grade-team", requireAuth, requireRole("teacher"), gradeAssignmentTeam);

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
    .populate("students", "name email currentLevel githubUsername")
    .populate({
      path: "team",
      select: "name leader",
      populate: { path: "leader", select: "name email" },
    })
    .lean();

  res.json(assignments);
});

export default router;