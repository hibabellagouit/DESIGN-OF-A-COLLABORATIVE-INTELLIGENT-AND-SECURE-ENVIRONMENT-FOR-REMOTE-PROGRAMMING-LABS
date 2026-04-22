import express from "express";
import {
  createProject,
  getProjects,
  streamCahierFile,
} from "../controllers/projectController.js";
import { uploadCdc } from "../middleware/cdcUpload.js";

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

function uploadSingle(req, res, next) {
  uploadCdc.single("cahierFile")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Erreur upload" });
    }
    next();
  });
}

router.get("/", getProjects);

router.get("/:id/cdc", streamCahierFile);

router.post("/", ensureBodyParsed, uploadSingle, createProject);

export default router;
