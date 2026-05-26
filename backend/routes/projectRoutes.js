import express from "express";
import {
  createProject,
  getProjects,
  getProjectById,
  getProjectDetailWithGroups,
  updateProject,
  deleteProject,
  streamCahierFile,
  streamComposeFile,
} from "../controllers/projectController.js";
import { uploadProjectArtifacts } from "../middleware/projectUpload.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

const jsonParser = express.json();

/**
 * multipart → laisser multer remplir req.body.
 * Sinon, si req.body est encore vide (JSON sans Content-Type correct, etc.), re-tenter le parse JSON.
 */
function ensureBodyParsed(req, res, next) {
  const ct = (req.headers["content-type"] || "").toLowerCase();
  if (ct.includes("multipart/form-data")) {
    return next();
  }
  if (req.body !== undefined && req.body !== null) {
    return next();
  }
  jsonParser(req, res, (err) => {
    if (err) return next(err);
    if (req.body === undefined || req.body === null) {
      req.body = {};
    }
    next();
  });
}

function uploadProjectFields(req, res, next) {
  uploadProjectArtifacts(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Erreur upload" });
    }
    next();
  });
}

router.get("/", requireAuth, getProjects);

router.get(
  "/:id/detail",
  requireAuth,
  requireRole("teacher"),
  getProjectDetailWithGroups
);

router.get("/:id", requireAuth, getProjectById);

router.get("/:id/cdc", requireAuth, streamCahierFile);
router.get("/:id/compose", requireAuth, streamComposeFile);

router.post("/", requireAuth, requireRole("teacher"), ensureBodyParsed, uploadProjectFields, createProject);

router.put(
  "/:id",
  requireAuth,
  requireRole("teacher"),
  ensureBodyParsed,
  uploadProjectFields,
  updateProject
);

router.delete("/:id", requireAuth, requireRole("teacher"), deleteProject);

export default router;
