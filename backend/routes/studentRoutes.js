import express from "express";
import {
  getMyStudentProfile,
  getMyGradesBreakdown,
  getStudentsRanking,
  getStudentsRankingForStudent,
  registerStudent,
  loginStudent,
  listStudents,
  patchStudentGithubUsername,
} from "../controllers/studentController.js";
import { requireAuth, requireRole, requireTeacherOrStudentSelfGithubParam } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", registerStudent);
router.post("/login", loginStudent);

router.get("/me", requireAuth, requireRole("student"), getMyStudentProfile);
router.get("/me/grades", requireAuth, requireRole("student"), getMyGradesBreakdown);
router.patch(
  "/:id/github",
  requireAuth,
  requireTeacherOrStudentSelfGithubParam,
  patchStudentGithubUsername,
);

router.get("/", requireAuth, requireRole("teacher"), listStudents);
router.get("/ranking", requireAuth, requireRole("teacher"), getStudentsRanking);
router.get("/ranking/me", requireAuth, requireRole("student"), getStudentsRankingForStudent);

export default router;
