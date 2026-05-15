import express from "express";
import {
  createSubmission,
  listSubmissionsForStudent,
  listSubmissionsForAssignment,
  updateSubmissionStatus,
  downloadSubmissionFile,
} from "../controllers/submissionController.js";
import {
  uploadSubmission,
  cleanupSubmissionUpload,
  SUBMISSION_MAX_FILES,
} from "../middleware/submissionUpload.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

function uploadMany(req, res, next) {
  uploadSubmission.array("files", SUBMISSION_MAX_FILES)(req, res, (err) => {
    if (err) {
      cleanupSubmissionUpload(req);
      return res.status(400).json({ message: err.message || "Erreur upload" });
    }
    next();
  });
}

/** Ne pas passer par multer pour les soumissions JSON (lien GitHub) : évite tout conflit de parsing. */
function uploadMultipartUnlessJson(req, res, next) {
  const ct = String(req.headers["content-type"] || "").toLowerCase();
  if (ct.includes("application/json")) return next();
  return uploadMany(req, res, next);
}

// Student upload : JSON = lien GitHub ; multipart = champ "files" (projet)
router.post("/", requireAuth, requireRole("student"), uploadMultipartUnlessJson, createSubmission);

// Student history
router.get(
  "/student/:studentId",
  requireAuth,
  requireRole("student"),
  listSubmissionsForStudent
);

// Teacher: list all submissions for an assignment
router.get(
  "/assignment/:assignmentId",
  requireAuth,
  requireRole("teacher"),
  listSubmissionsForAssignment
);

// Teacher : mise à jour du statut de suivi (en attente → en cours d'évaluation → évalué)
router.patch("/:id/status", requireAuth, requireRole("teacher"), updateSubmissionStatus);

// Download file (teacher or owner student)
router.get("/:id/file", requireAuth, downloadSubmissionFile);

export default router;
