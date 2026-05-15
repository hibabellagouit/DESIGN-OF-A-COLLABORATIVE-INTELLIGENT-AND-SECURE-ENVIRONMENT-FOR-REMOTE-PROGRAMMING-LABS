import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { extensionFromUploadName } from "../utils/uploadPath.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUBMISSIONS_DIR = path.join(__dirname, "../uploads/submissions");

/** Archives et code courant ; fichiers « racine » sans extension typiques. */
const allowedExt =
  /\.(zip|rar|7z|tar|gz|tgz|pdf|txt|md|js|ts|tsx|jsx|mjs|cjs|java|c|cpp|h|hpp|json|html|htm|css|scss|vue|py|go|php|rb|xml|yml|yaml|toml|ini|sql|sh|bat|kt|swift|rs|lock|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$/i;

const rootNameOk = /^(dockerfile|makefile|readme|license|gemfile|rakefile|procfile|\.gitignore|\.dockerignore)$/i;

export const SUBMISSION_MAX_FILES = 120;
export const SUBMISSION_MAX_FILE_BYTES = 12 * 1024 * 1024;
export const SUBMISSION_MAX_TOTAL_BYTES = 80 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    if (!req._submissionBundleId) {
      req._submissionBundleId = crypto.randomUUID();
    }
    const dir = path.join(SUBMISSIONS_DIR, "bundles", req._submissionBundleId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = extensionFromUploadName(file.originalname) || "";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const base = path.basename(file.originalname || "");
  if (rootNameOk.test(base)) {
    return cb(null, true);
  }
  if (!allowedExt.test(file.originalname || "")) {
    return cb(new Error("Type non autorisé pour un fichier du projet (code, config, images courantes, archive)"));
  }
  cb(null, true);
}

export const uploadSubmission = multer({
  storage,
  limits: {
    fileSize: SUBMISSION_MAX_FILE_BYTES,
    files: SUBMISSION_MAX_FILES,
  },
  fileFilter,
});

/** Supprime le dossier bundle créé pendant un upload (erreur multer ou validation). */
export function cleanupSubmissionUpload(req) {
  const id = req?._submissionBundleId;
  if (!id) return;
  try {
    const dir = path.join(SUBMISSIONS_DIR, "bundles", id);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

export { SUBMISSIONS_DIR };
