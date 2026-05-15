import express from "express";
import { runSubmissionInSandbox } from "../controllers/sandboxController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Teacher-only: execute a submission file in a locked-down Docker container (MVP: .py or .js)
router.post("/run-submission", requireAuth, requireRole("teacher"), runSubmissionInSandbox);

export default router;

