import express from "express";
import {
  registerStudent,
  loginStudent,
  listStudents,
} from "../controllers/studentController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", registerStudent);
router.post("/login", loginStudent);
router.get("/", requireAuth, requireRole("teacher"), listStudents);
export default router;

