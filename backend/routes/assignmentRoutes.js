import express from "express";
import Assignment from "../models/Assignment.js";
import {
  assignProject,
  validateAssignment,
  getAssignmentsForStudent,
  getSelectableProjectsForStudent,
  selectProjectForStudent,
} from "../controllers/assignmentController.js";

const router = express.Router();

// POST assigner projet
router.post("/", assignProject);

// POST valider
router.post("/validate", validateAssignment);

router.get("/student/:studentId", getAssignmentsForStudent);
router.get("/student/:studentId/selectable-projects", getSelectableProjectsForStudent);
router.post("/student/select-project", selectProjectForStudent);

// 🔥 IMPORTANT : GET pour React
router.get("/", async (req, res) => {
  const assignments = await Assignment.find()
    .populate("project")
    .populate("students");

  res.json(assignments);
});

export default router;