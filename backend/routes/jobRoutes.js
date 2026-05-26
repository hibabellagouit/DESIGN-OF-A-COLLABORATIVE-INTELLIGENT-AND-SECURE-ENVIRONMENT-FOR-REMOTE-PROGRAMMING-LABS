import express from "express";
import {
  getJobStatus,
  getQueueInfo,
  enqueueSandboxRun,
  enqueueOllamaGrade,
} from "../controllers/jobController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/info", requireAuth, requireRole("teacher"), getQueueInfo);
router.get("/:id", requireAuth, requireRole("teacher"), getJobStatus);
router.post("/sandbox", requireAuth, requireRole("teacher"), enqueueSandboxRun);
router.post("/ollama", requireAuth, requireRole("teacher"), enqueueOllamaGrade);

export default router;
