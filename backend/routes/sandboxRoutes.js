import express from "express";
import {
  runSubmissionInSandbox,
  stopSubmissionSandboxRun,
  refreshSubmissionSandboxLinksRun,
} from "../controllers/sandboxController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Teacher-only: exécuter une soumission via docker compose (docker-compose.yml à la racine)
router.post("/run-submission", requireAuth, requireRole("teacher"), runSubmissionInSandbox);
router.post("/stop-submission", requireAuth, requireRole("teacher"), stopSubmissionSandboxRun);
router.post(
  "/refresh-links",
  requireAuth,
  requireRole("teacher"),
  refreshSubmissionSandboxLinksRun
);

export default router;

