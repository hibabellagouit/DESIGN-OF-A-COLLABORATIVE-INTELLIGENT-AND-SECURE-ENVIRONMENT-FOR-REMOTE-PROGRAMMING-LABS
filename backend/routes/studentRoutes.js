import express from "express";
import {
  registerStudent,
  loginStudent,
  listStudents,
} from "../controllers/studentController.js";

const router = express.Router();

router.post("/register", registerStudent);
router.post("/login", loginStudent);
router.get("/", listStudents);
export default router;

